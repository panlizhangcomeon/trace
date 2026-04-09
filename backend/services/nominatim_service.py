"""
Nominatim service for OpenStreetMap geocoding and place search.
"""
import requests
import logging
from typing import List, Optional, Dict, Any
from urllib.parse import quote

logger = logging.getLogger(__name__)


class NominatimService:
    """
    Client for Nominatim API (OpenStreetMap's official geocoding service).

    Usage:
        - Search by name: https://nominatim.openstreetmap.org/search?q=关键词&format=json&limit=10
        - Reverse geocoding: https://nominatim.openstreetmap.org/reverse?lat=...&lon=...&format=json
    """

    BASE_URL = "https://nominatim.openstreetmap.org"
    DEFAULT_TIMEOUT = 10
    DEFAULT_LIMIT = 10

    def search(
        self,
        query: str,
        limit: int = DEFAULT_LIMIT,
        country_codes: Optional[str] = None,
        viewbox: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search for places by name using Nominatim.

        Args:
            query: Search query (e.g., "前海中心", "Shanghai")
            limit: Maximum number of results to return
            country_codes: Restrict results to specific countries (e.g., "cn" for China)
            viewbox: Bounding box to restrict search (format: "left,bottom,right,top")

        Returns:
            List of place dictionaries with keys: place_id, lat, lon, display_name, type, etc.
        """
        if not query or not query.strip():
            logger.warning("Empty search query provided")
            return []

        params = {
            'q': query.strip(),
            'format': 'json',
            'limit': limit,
            'addressdetails': 1,
        }

        if country_codes:
            params['countrycodes'] = country_codes

        if viewbox:
            params['viewbox'] = viewbox
            params['bounded'] = 1

        headers = {
            'User-Agent': 'TravelRoutePlanner/1.0',
            'Accept': 'application/json',
        }

        try:
            response = requests.get(
                f"{self.BASE_URL}/search",
                params=params,
                headers=headers,
                timeout=self.DEFAULT_TIMEOUT
            )
            response.raise_for_status()
            data = response.json()

            logger.info(f"Nominatim search: '{query}' returned {len(data)} results")
            return data

        except requests.Timeout:
            logger.error(f"Nominatim request timed out for query: {query}")
            return []
        except requests.RequestException as e:
            logger.error(f"Nominatim request failed: {e}")
            return []

    def reverse(
        self,
        latitude: float,
        longitude: float,
        zoom: int = 18
    ) -> Optional[Dict[str, Any]]:
        """
        Reverse geocode coordinates to get place information.

        Args:
            latitude: Latitude coordinate
            longitude: Longitude coordinate
            zoom: Level of detail (0-18, higher = more detail)

        Returns:
            Place dictionary or None if not found
        """
        params = {
            'lat': latitude,
            'lon': longitude,
            'format': 'json',
            'addressdetails': 1,
            'zoom': zoom,
        }

        headers = {
            'User-Agent': 'TravelRoutePlanner/1.0',
            'Accept': 'application/json',
        }

        try:
            response = requests.get(
                f"{self.BASE_URL}/reverse",
                params=params,
                headers=headers,
                timeout=self.DEFAULT_TIMEOUT
            )
            response.raise_for_status()
            data = response.json()

            if 'error' in data:
                logger.warning(f"Nominatim reverse geocode not found: {latitude}, {longitude}")
                return None

            return data

        except requests.Timeout:
            logger.error(f"Nominatim reverse request timed out")
            return None
        except requests.RequestException as e:
            logger.error(f"Nominatim reverse request failed: {e}")
            return None

    def format_place_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format Nominatim result to a standardized POI-like structure.

        Args:
            result: Raw Nominatim result dictionary

        Returns:
            Formatted dictionary with normalized keys
        """
        return {
            'osm_id': result.get('place_id'),
            'name': result.get('display_name', '').split(',')[0],
            'full_name': result.get('display_name'),
            'latitude': float(result.get('lat', 0)),
            'longitude': float(result.get('lon', 0)),
            'type': result.get('type', 'unknown'),
            'category': result.get('class'),
            'address': result.get('address', {}),
            'importance': result.get('importance', 0),
        }


# Singleton instance
nominatim_service = NominatimService()
