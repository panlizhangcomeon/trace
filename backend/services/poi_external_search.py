"""
External POI search with provider selection (Baidu domestic / Nominatim international),
response caching, and Nominatim-friendly rate limiting inside the client.
"""
from __future__ import annotations

import hashlib
import logging
import re
from typing import Any, Dict, List, Tuple

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

# Bump when cache semantics change (e.g. stop caching empty hits) to invalidate stale entries.
_CACHE_KEY_PREFIX = "trace:poi_geosearch:v2"


def _normalize_geo_scope(raw: str | None) -> str:
    s = (raw or "domestic").strip().lower()
    if s in ("international", "intl", "overseas", "foreign", "abroad"):
        return "international"
    return "domestic"


def _poi_search_cache_key(provider: str, *parts: str) -> str:
    payload = "\x1f".join(parts)
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:32]
    return f"{_CACHE_KEY_PREFIX}:{provider}:{digest}"


def _international_query(query: str, region: str) -> str:
    q = query.strip()
    r = (region or "").strip()
    if r and r not in ("全国", "全球", "global", "worldwide"):
        return f"{q} {r}".strip()
    return q


def _sanitize_country_codes(raw: str | None) -> str | None:
    """
    Nominatim `countrycodes` expects comma-separated ISO 3166-1 alpha-2 (e.g. jp,fr).
    Reject non-ASCII / wrong length so mistaken input (e.g. 日本) does not zero out results.
    """
    if not raw:
        return None
    parts = re.split(r"[,，\s]+", raw.strip().lower())
    valid: List[str] = []
    for p in parts:
        p = p.strip()
        if len(p) == 2 and p.isalpha() and p.isascii():
            valid.append(p)
    if not valid:
        return None
    return ",".join(dict.fromkeys(valid))


def _nominatim_formatted_results(
    nom: Any,
    q_eff: str,
    limit_capped: int,
    country_codes: str | None,
) -> List[Dict[str, Any]]:
    raw = nom.search(query=q_eff, limit=limit_capped, country_codes=country_codes)
    out: List[Dict[str, Any]] = []
    for r in raw or []:
        try:
            out.append(nom.format_as_geoplace(r))
        except (TypeError, ValueError, KeyError):
            logger.debug("Skipping malformed Nominatim hit for query=%r", q_eff[:80], exc_info=True)
    return out


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

    Empty results are not cached (avoids locking in failed/timeouts). Cache key version v2.
    """
    scope = _normalize_geo_scope(geo_scope)
    limit_capped = min(max(1, limit), 50)
    ttl = int(getattr(settings, "POI_GEOSEARCH_CACHE_TTL", 86400))
    qstrip = query.strip()

    if scope == "domestic":
        provider = "baidu"
        region_eff = region or "全国"
        key = _poi_search_cache_key(provider, qstrip, region_eff, str(limit_capped))
        cached = cache.get(key)
        if cached is not None and len(cached) > 0:
            logger.debug("POI geosearch cache hit provider=%s", provider)
            return list(cached), provider, True

        from services.baidu_poi_service import BaiduPOIService

        svc = BaiduPOIService(ak=settings.BAIDU_MAP_AK)
        raw = svc.search(query=qstrip, region=region_eff, limit=limit_capped)
        formatted = [svc.format_poi_result(r) for r in raw]
        if formatted:
            cache.set(key, formatted, timeout=ttl)
        return formatted, provider, False

    provider = "nominatim"
    q_eff = _international_query(query, region)
    cc = _sanitize_country_codes(country_codes)
    key = _poi_search_cache_key(provider, q_eff, str(limit_capped), cc or "")
    cached = cache.get(key)
    if cached is not None and len(cached) > 0:
        logger.debug("POI geosearch cache hit provider=%s", provider)
        return list(cached), provider, True

    from services.nominatim_service import get_nominatim_service

    nom = get_nominatim_service()
    formatted = _nominatim_formatted_results(nom, q_eff, limit_capped, cc or None)
    if not formatted and cc:
        logger.info(
            "Nominatim empty with countrycodes=%r, retrying without country filter query=%r",
            cc,
            q_eff[:80],
        )
        formatted = _nominatim_formatted_results(nom, q_eff, limit_capped, None)
        key = _poi_search_cache_key(provider, q_eff, str(limit_capped), "")
        if formatted:
            cache.set(key, formatted, timeout=ttl)
        return formatted, provider, False

    if formatted:
        cache.set(key, formatted, timeout=ttl)
    return formatted, provider, False
