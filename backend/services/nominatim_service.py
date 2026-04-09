"""
Nominatim service for OpenStreetMap geocoding and place search.
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Any, Dict, List, Optional

import requests
from django.conf import settings as django_settings

logger = logging.getLogger(__name__)

# Nominatim usage policy: at most ~1 request per second per application.
_nominatim_rate_lock = threading.Lock()
_nominatim_last_request_mono = 0.0


class NominatimService:
    """
    Client for Nominatim API (public OSM instance).

    Usage:
        - Search: GET /search?q=...&format=json&limit=10
    """

    DEFAULT_TIMEOUT = 10
    DEFAULT_LIMIT = 10

    def __init__(
        self,
        base_url: str | None = None,
        user_agent: str | None = None,
        min_interval_sec: float | None = None,
    ):
        self.base_url = (base_url or "").rstrip("/")
        self.user_agent = user_agent or ""
        self.min_interval_sec = min_interval_sec

    def _effective_base_url(self) -> str:
        return (self.base_url or getattr(django_settings, "NOMINATIM_BASE_URL", "")).rstrip(
            "/"
        ) or "https://nominatim.openstreetmap.org"

    def _effective_user_agent(self) -> str:
        """
        OSMF 要求 User-Agent 能标识应用；http 库默认 UA 会被拒。
        建议在环境变量中设置「应用名/版本 (联系邮箱或项目 URL)」。
        """
        return (
            self.user_agent
            or getattr(django_settings, "NOMINATIM_USER_AGENT", "").strip()
            or "TraceTravelRoutePlanner/1.0 (set NOMINATIM_USER_AGENT per OSMF nominatim policy)"
        )

    def _build_headers(self) -> Dict[str, str]:
        headers: Dict[str, str] = {
            "User-Agent": self._effective_user_agent(),
            "Accept": "application/json",
        }
        referer = getattr(django_settings, "NOMINATIM_REFERER", "").strip()
        if referer:
            headers["Referer"] = referer
        return headers

    def _request_proxies(self) -> Optional[Dict[str, str]]:
        return getattr(django_settings, "NOMINATIM_REQUEST_PROXIES", None)

    def _effective_min_interval(self) -> float:
        if self.min_interval_sec is not None:
            return float(self.min_interval_sec)
        return float(getattr(django_settings, "NOMINATIM_MIN_INTERVAL_SEC", 1.1))

    def _respect_rate_limit(self) -> None:
        """Serialize outbound Nominatim calls to respect public instance limits."""
        interval = self._effective_min_interval()
        if interval <= 0:
            return
        global _nominatim_last_request_mono
        with _nominatim_rate_lock:
            now = time.monotonic()
            wait = interval - (now - _nominatim_last_request_mono)
            if wait > 0:
                time.sleep(wait)
            _nominatim_last_request_mono = time.monotonic()

    def search(
        self,
        query: str,
        limit: int = DEFAULT_LIMIT,
        country_codes: Optional[str] = None,
        viewbox: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        if not query or not query.strip():
            logger.warning("Empty Nominatim search query")
            return []

        params: Dict[str, Any] = {
            "q": query.strip(),
            "format": "json",
            "limit": min(limit, 50),
            "addressdetails": 1,
        }
        if country_codes:
            params["countrycodes"] = country_codes
        if viewbox:
            params["viewbox"] = viewbox
            params["bounded"] = 1

        headers = self._build_headers()

        self._respect_rate_limit()
        try:
            response = requests.get(
                f"{self._effective_base_url()}/search",
                params=params,
                headers=headers,
                timeout=self.DEFAULT_TIMEOUT,
                proxies=self._request_proxies(),
            )
            if response.status_code == 403:
                logger.warning(
                    "Nominatim 403 Access denied (常见原因：User-Agent/Referer 不符合 "
                    "https://operations.osmfoundation.org/policies/nominatim/ ，或出口 IP 被封禁如部分代理/VPS)。"
                )
                return []
            if response.status_code == 429:
                logger.warning("Nominatim returned 429 Too Many Requests for query=%r", query[:80])
                return []
            response.raise_for_status()
            data = response.json()
        except requests.Timeout:
            logger.error("Nominatim search timed out query=%r", query[:80])
            return []
        except requests.RequestException as e:
            logger.error("Nominatim search failed: %s", e)
            return []

        if not isinstance(data, list):
            return []

        logger.info("Nominatim search: %r returned %s results", query[:80], len(data))
        return data

    def reverse(
        self,
        latitude: float,
        longitude: float,
        zoom: int = 18,
    ) -> Optional[Dict[str, Any]]:
        params = {
            "lat": latitude,
            "lon": longitude,
            "format": "json",
            "addressdetails": 1,
            "zoom": zoom,
        }
        headers = self._build_headers()
        self._respect_rate_limit()
        try:
            response = requests.get(
                f"{self._effective_base_url()}/reverse",
                params=params,
                headers=headers,
                timeout=self.DEFAULT_TIMEOUT,
                proxies=self._request_proxies(),
            )
            if response.status_code == 403:
                logger.warning("Nominatim 403 Access denied on reverse geocode")
                return None
            response.raise_for_status()
            data = response.json()
        except requests.Timeout:
            logger.error("Nominatim reverse timed out")
            return None
        except requests.RequestException as e:
            logger.error("Nominatim reverse failed: %s", e)
            return None

        if isinstance(data, dict) and "error" in data:
            logger.warning("Nominatim reverse not found: %s, %s", latitude, longitude)
            return None
        return data if isinstance(data, dict) else None

    def format_place_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Verbose normalized shape (legacy)."""
        return {
            "osm_id": result.get("place_id"),
            "name": (result.get("display_name") or "").split(",")[0],
            "full_name": result.get("display_name"),
            "latitude": float(result.get("lat", 0)),
            "longitude": float(result.get("lon", 0)),
            "type": result.get("type", "unknown"),
            "category": result.get("class"),
            "address": result.get("address", {}),
            "importance": result.get("importance", 0),
        }

    def format_as_geoplace(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Align with Baidu `format_poi_result` / frontend GeoPlace.
        """
        addr = result.get("address") or {}
        if not isinstance(addr, dict):
            addr = {}
        name = (result.get("name") or "").strip() or (
            (result.get("display_name") or "").split(",")[0].strip()
        )
        lat = float(result.get("lat", 0))
        lon = float(result.get("lon", 0))
        osm_type = (result.get("osm_type") or "").lower()
        osm_id = result.get("osm_id")
        detail_url = ""
        if osm_type in ("node", "way", "relation") and osm_id is not None:
            detail_url = f"https://www.openstreetmap.org/{osm_type}/{osm_id}"
        place_id = result.get("place_id")
        uid = f"nominatim:{place_id}" if place_id is not None else f"nominatim:{osm_type}:{osm_id}"
        return {
            "uid": uid,
            "name": name,
            "latitude": lat,
            "longitude": lon,
            "address": result.get("display_name") or "",
            "province": addr.get("state") or addr.get("region") or "",
            "city": addr.get("city")
            or addr.get("town")
            or addr.get("village")
            or addr.get("municipality")
            or "",
            "district": addr.get("suburb")
            or addr.get("quarter")
            or addr.get("neighbourhood")
            or addr.get("city_district")
            or "",
            "type": result.get("type") or "",
            "type_code": result.get("class") or "",
            "telephone": "",
            "detail_url": detail_url,
        }


_nominatim_singleton: NominatimService | None = None
_singleton_lock = threading.Lock()


def get_nominatim_service() -> NominatimService:
    """Process-wide singleton so rate limiting is shared across requests."""
    global _nominatim_singleton
    with _singleton_lock:
        if _nominatim_singleton is None:
            _nominatim_singleton = NominatimService()
        return _nominatim_singleton
