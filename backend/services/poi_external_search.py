"""
External POI search with provider selection (Baidu domestic / Nominatim international),
response caching, and Nominatim-friendly rate limiting inside the client.
"""
from __future__ import annotations

import hashlib
import logging
from typing import Any, Dict, List, Tuple

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


def _normalize_geo_scope(raw: str | None) -> str:
    s = (raw or "domestic").strip().lower()
    if s in ("international", "intl", "overseas", "foreign", "abroad"):
        return "international"
    return "domestic"


def _poi_search_cache_key(provider: str, *parts: str) -> str:
    payload = "\x1f".join(parts)
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:32]
    return f"trace:poi_geosearch:v1:{provider}:{digest}"


def _international_query(query: str, region: str) -> str:
    q = query.strip()
    r = (region or "").strip()
    if r and r not in ("全国", "全球", "global", "worldwide"):
        return f"{q} {r}".strip()
    return q


def search_external_places(
    query: str,
    *,
    geo_scope: str | None,
    region: str,
    limit: int,
    country_codes: str | None = None,
) -> Tuple[List[Dict[str, Any]], str, bool]:
    """
    Returns (formatted_results, provider, hit_cache).

    - domestic: Baidu Place API (existing behavior).
    - international: public Nominatim (rate-limited in NominatimService).
    """
    scope = _normalize_geo_scope(geo_scope)
    limit_capped = min(max(1, limit), 50)
    ttl = int(getattr(settings, "POI_GEOSEARCH_CACHE_TTL", 86400))

    if scope == "domestic":
        provider = "baidu"
        region_eff = region or "全国"
        key = _poi_search_cache_key(provider, query.strip(), region_eff, str(limit_capped))
        cached = cache.get(key)
        if cached is not None:
            logger.debug("POI geosearch cache hit provider=%s", provider)
            return list(cached), provider, True

        from services.baidu_poi_service import BaiduPOIService

        svc = BaiduPOIService(ak=settings.BAIDU_MAP_AK)
        raw = svc.search(query=query.strip(), region=region_eff, limit=limit_capped)
        formatted = [svc.format_poi_result(r) for r in raw]
        cache.set(key, formatted, timeout=ttl)
        return formatted, provider, False

    provider = "nominatim"
    q_eff = _international_query(query, region)
    cc = (country_codes or "").strip().lower() or ""
    key = _poi_search_cache_key(provider, q_eff, str(limit_capped), cc)
    cached = cache.get(key)
    if cached is not None:
        logger.debug("POI geosearch cache hit provider=%s", provider)
        return list(cached), provider, True

    from services.nominatim_service import get_nominatim_service

    nom = get_nominatim_service()
    raw = nom.search(
        query=q_eff,
        limit=limit_capped,
        country_codes=cc or None,
    )
    formatted = [nom.format_as_geoplace(r) for r in raw]
    cache.set(key, formatted, timeout=ttl)
    return formatted, provider, False
