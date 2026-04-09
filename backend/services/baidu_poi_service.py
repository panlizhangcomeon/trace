"""
Baidu Maps POI search service.
"""
import requests
import logging
from typing import List, Optional, Dict, Any, Tuple

logger = logging.getLogger(__name__)


class BaiduAPIError(Exception):
    """Baidu Place API returned non-zero status (e.g. invalid AK, quota)."""


class BaiduSearchTransientError(Exception):
    """Network/timeout for a single query — caller may skip one stop."""


class BaiduPOIService:
    """
    Client for Baidu Maps POI Search API.

    API Docs: https://lbsyun.baidu.com/index.php?title=webapi/guide/webservice-placeapi

    Usage:
        - Search POIs: https://api.map.baidu.com/place/v2/search?query=关键词&region=城市&ak=AK
    """

    BASE_URL = "https://api.map.baidu.com"
    DEFAULT_TIMEOUT = 10
    DEFAULT_LIMIT = 10

    def __init__(self, ak: str):
        self.ak = ak

    def _place_search_request(
        self,
        query: str,
        region: str,
        limit: int,
        scope: int,
    ) -> Tuple[int, List[Dict[str, Any]], str]:
        """
        Returns (baidu_status, results, message) from JSON body.
        Raises BaiduSearchTransientError on HTTP/timeout failures.
        """
        params = {
            'query': query.strip(),
            'region': region,
            'ak': self.ak,
            'output': 'json',
            'scope': scope,
            'page_size': min(limit, 50),
            'page_num': 0,
        }
        headers = {'Accept': 'application/json'}

        try:
            response = requests.get(
                f"{self.BASE_URL}/place/v2/search",
                params=params,
                headers=headers,
                timeout=self.DEFAULT_TIMEOUT,
            )
            response.raise_for_status()
        except requests.Timeout as e:
            raise BaiduSearchTransientError('timeout') from e
        except requests.RequestException as e:
            raise BaiduSearchTransientError(str(e)) from e

        try:
            data = response.json()
        except ValueError as e:
            raise BaiduSearchTransientError('invalid JSON response') from e

        status = data.get('status')
        msg = data.get('message', '') or ''
        results = data.get('results', []) or []
        if not isinstance(results, list):
            results = []

        if status is None:
            return -1, [], 'missing status'

        return int(status), results, msg

    def search(
        self,
        query: str,
        region: str = "全国",
        limit: int = DEFAULT_LIMIT,
        scope: int = 1,
    ) -> List[Dict[str, Any]]:
        """
        Search for POIs using Baidu Maps API.

        On API/business errors or network issues, returns [] (legacy behavior for POI search endpoint).
        """
        if not query or not query.strip():
            logger.warning("Empty search query provided")
            return []

        try:
            status, results, msg = self._place_search_request(query, region, limit, scope)
        except BaiduSearchTransientError as e:
            logger.error(f"Baidu POI transient error: {e}")
            return []

        if status != 0:
            logger.error(f"Baidu POI API error: status={status}, msg={msg}")
            return []

        logger.info(f"Baidu POI search: '{query}' in '{region}' returned {len(results)} results")
        return results

    def search_strict(
        self,
        query: str,
        region: str = "全国",
        limit: int = DEFAULT_LIMIT,
        scope: int = 1,
    ) -> List[Dict[str, Any]]:
        """
        Same as search but:
        - Baidu JSON status != 0 -> BaiduAPIError (global failure).
        - Network/timeout -> BaiduSearchTransientError (per-stop).
        """
        if not query or not query.strip():
            return []

        status, results, msg = self._place_search_request(query, region, limit, scope)

        if status != 0:
            raise BaiduAPIError(f"status={status}, message={msg}")

        logger.info(f"Baidu POI search_strict: '{query}' in '{region}' returned {len(results)} results")
        return results

    def format_poi_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format Baidu POI result to a standardized structure.

        Args:
            result: Raw Baidu POI result dictionary

        Returns:
            Formatted dictionary with normalized keys
        """
        location = result.get('location', {})
        return {
            'uid': result.get('uid'),
            'name': result.get('name'),
            'latitude': location.get('lat'),
            'longitude': location.get('lng'),
            'address': result.get('address'),
            'province': result.get('province'),
            'city': result.get('city'),
            'district': result.get('area'),
            'type': result.get('type'),
            'type_code': result.get('tag'),
            'telephone': result.get('telephone'),
            'detail_url': result.get('detail_url'),
        }
