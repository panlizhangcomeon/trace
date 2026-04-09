"""
Resolve smart-trip draft stops to geocoded POI-shaped dicts (Baidu or Nominatim).
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List

from services.baidu_poi_service import (
    BaiduAPIError,
    BaiduPOIService,
    BaiduSearchTransientError,
)
from services.itinerary_schema import Day, Stop
from services.nominatim_service import NominatimService

logger = logging.getLogger(__name__)

WARNING_POI_SEARCH_EMPTY = 'poi_search_empty'
WARNING_POI_SEARCH_ERROR = 'poi_search_error'


def _international_query(stop: Stop, day: Day) -> str:
    q = (stop.search_query or stop.display_name or '').strip()
    r = (day.city_context or '').strip()
    if r and r not in ('全国', '全球', 'global', 'worldwide'):
        return f'{q} {r}'.strip()
    return q


def resolve_stop_domestic(
    day: Day,
    stop: Stop,
    svc: BaiduPOIService,
    warnings: List[Dict[str, Any]],
    interval_sec: float,
) -> Dict[str, Any] | None:
    query = (stop.search_query or stop.display_name or '').strip()
    region = day.city_context or '全国'
    transient_failed = False
    raw_results: List[Dict[str, Any]] | None = None
    try:
        raw_results = svc.search_strict(query=query, region=region, limit=10)
    except BaiduAPIError:
        logger.warning(
            'Baidu global API error during smart trip commit',
            extra={'day_index': day.day_index, 'query_len': len(query)},
        )
        raise
    except BaiduSearchTransientError as e:
        logger.info(
            'Baidu transient error, skipping stop',
            extra={'day_index': day.day_index, 'display_name': stop.display_name, 'err': str(e)},
        )
        warnings.append(
            {
                'day_index': day.day_index,
                'stop_display_name': stop.display_name,
                'code': WARNING_POI_SEARCH_ERROR,
            }
        )
        transient_failed = True
    finally:
        if query and interval_sec > 0:
            time.sleep(interval_sec)

    if transient_failed:
        return None

    if not raw_results:
        warnings.append(
            {
                'day_index': day.day_index,
                'stop_display_name': stop.display_name,
                'code': WARNING_POI_SEARCH_EMPTY,
            }
        )
        return None

    formatted = svc.format_poi_result(raw_results[0])
    lat = formatted.get('latitude')
    lng = formatted.get('longitude')
    if lat is None or lng is None:
        warnings.append(
            {
                'day_index': day.day_index,
                'stop_display_name': stop.display_name,
                'code': WARNING_POI_SEARCH_EMPTY,
            }
        )
        return None

    return formatted


def resolve_stop_international(
    day: Day,
    stop: Stop,
    nominatim: NominatimService,
    warnings: List[Dict[str, Any]],
    interval_sec: float,
) -> Dict[str, Any] | None:
    query = _international_query(stop, day)
    cc = day.country_code
    try:
        raw_results = nominatim.search(
            query=query,
            limit=10,
            country_codes=cc,
        )
    finally:
        if query and interval_sec > 0:
            time.sleep(interval_sec)

    if not raw_results:
        warnings.append(
            {
                'day_index': day.day_index,
                'stop_display_name': stop.display_name,
                'code': WARNING_POI_SEARCH_EMPTY,
            }
        )
        return None

    formatted = nominatim.format_as_geoplace(raw_results[0])
    lat = formatted.get('latitude')
    lng = formatted.get('longitude')
    if lat is None or lng is None:
        warnings.append(
            {
                'day_index': day.day_index,
                'stop_display_name': stop.display_name,
                'code': WARNING_POI_SEARCH_EMPTY,
            }
        )
        return None

    return formatted
