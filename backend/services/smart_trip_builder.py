"""
Persist ItineraryDraftV1 as Trip / Route / POI / RoutePOI with Baidu geocoding.
"""
from __future__ import annotations

import logging
import time
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Dict, List, Tuple

from django.conf import settings
from django.db import transaction

from apps.pois.models import POI
from apps.routes.models import Route, RoutePOI
from apps.trips.models import Trip
from services.baidu_poi_service import BaiduPOIService, BaiduAPIError, BaiduSearchTransientError
from services.itinerary_schema import ItineraryDraftV1, Day, Stop

logger = logging.getLogger(__name__)

DEFAULT_ROUTE_COLOR = '#8b4513'
WARNING_POI_SEARCH_EMPTY = 'poi_search_empty'
WARNING_POI_SEARCH_ERROR = 'poi_search_error'


def _round_coord_key(lat: float, lng: float) -> Tuple[str, str]:
    return (f'{round(lat, 5):.5f}', f'{round(lng, 5):.5f}')


def find_reusable_poi(name: str, lat: float, lng: float) -> POI | None:
    rlat, rlng = _round_coord_key(lat, lng)
    for poi in POI.objects.filter(name=name):
        if _round_coord_key(float(poi.latitude), float(poi.longitude)) == (rlat, rlng):
            return poi
    return None


def _stop_note(stop: Stop) -> str | None:
    parts: List[str] = []
    if stop.duration_minutes is not None:
        parts.append(f'停留约 {stop.duration_minutes} 分钟')
    if stop.notes:
        parts.append(stop.notes)
    return ' · '.join(parts) if parts else None


def _segment_note_for_index(stops: List[Stop], index: int) -> str | None:
    """路段备注：指向当前站的出行说明放在该站点的 travel_hint（首站无路段）。"""
    if index <= 0:
        return None
    hint = stops[index].travel_hint
    return hint if hint else None


def _quantize_coord(value: float) -> Decimal:
    return Decimal(str(value)).quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)


def commit_draft(
    draft: ItineraryDraftV1,
    trip_meta: Dict[str, Any],
    *,
    baidu: BaiduPOIService | None = None,
) -> Tuple[Trip, List[Dict[str, Any]]]:
    """
    Create Trip, Routes, POIs, RoutePOIs inside a transaction.
    Returns (trip, warnings). Warnings for skipped stops (empty search / transient error).

    Baidu place 检索在事务外按天、按站点严格串行执行；每次实际请求结束后休眠
    ``settings.BAIDU_SMART_COMMIT_INTERVAL_SEC``，避免触发并发/QPS 限流。
    """
    svc = baidu or BaiduPOIService(ak=settings.BAIDU_MAP_AK)
    warnings: List[Dict[str, Any]] = []
    interval_sec = float(getattr(settings, 'BAIDU_SMART_COMMIT_INTERVAL_SEC', 0.35))

    name = trip_meta.get('name') or draft.trip_summary.title_hint
    destination = trip_meta.get('destination') or draft.trip_summary.destination_summary
    start_date = trip_meta.get('start_date')

    resolved_days: List[Tuple[Day, List[Dict[str, Any] | None]]] = []
    for day in draft.days:
        formatted_by_stop: List[Dict[str, Any] | None] = []
        for stop in day.stops:
            formatted_by_stop.append(_resolve_stop_for_commit(day, stop, svc, warnings, interval_sec))
        resolved_days.append((day, formatted_by_stop))

    with transaction.atomic():
        trip = Trip.objects.create(
            name=name[:255] if name else None,
            destination=destination[:255] if destination else None,
            start_date=start_date,
        )

        for day, formatted_by_stop in resolved_days:
            _commit_day_resolved(trip, day, formatted_by_stop)

    return trip, warnings


def _resolve_stop_for_commit(
    day: Day,
    stop: Stop,
    svc: BaiduPOIService,
    warnings: List[Dict[str, Any]],
    interval_sec: float,
) -> Dict[str, Any] | None:
    """Call Baidu for one stop; sleep after each real request (non-empty query) when interval_sec > 0."""
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


def _commit_day_resolved(
    trip: Trip,
    day: Day,
    formatted_by_stop: List[Dict[str, Any] | None],
) -> None:
    route = Route.objects.create(
        trip=trip,
        name=f'第{day.day_index}天 · {day.city_context}'[:255],
        color=DEFAULT_ROUTE_COLOR,
        day_number=day.day_index,
        order_index=day.day_index,
    )

    order_index = 0
    stops = day.stops

    for si, stop in enumerate(stops):
        formatted = formatted_by_stop[si]
        if formatted is None:
            continue

        lat = formatted.get('latitude')
        lng = formatted.get('longitude')
        lat_f, lng_f = float(lat), float(lng)
        lat_d, lng_d = _quantize_coord(lat_f), _quantize_coord(lng_f)
        poi_name = (formatted.get('name') or stop.display_name)[:255]

        poi = find_reusable_poi(poi_name, lat_f, lng_f)
        if poi is None:
            poi = POI.objects.create(
                name=poi_name,
                latitude=lat_d,
                longitude=lng_d,
                type='attraction',
                icon=None,
                note=None,
                tags=[],
            )

        RoutePOI.objects.create(
            route=route,
            poi=poi,
            order_index=order_index,
            stop_note=_stop_note(stop),
            segment_note=_segment_note_for_index(stops, si),
        )
        order_index += 1
