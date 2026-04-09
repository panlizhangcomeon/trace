"""
Persist ItineraryDraftV1 as Trip / Route / POI / RoutePOI with Baidu or Nominatim geocoding.
"""
from __future__ import annotations

import logging
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Dict, List, Tuple

from django.conf import settings
from django.db import transaction

from apps.pois.models import POI
from apps.routes.models import Route, RoutePOI
from apps.trips.models import Trip
from services.baidu_poi_service import BaiduPOIService, BaiduAPIError
from services.itinerary_schema import ItineraryDraftV1, Day, Stop
from services.nominatim_service import NominatimService, get_nominatim_service
from services.smart_trip_geocode import resolve_stop_domestic, resolve_stop_international

logger = logging.getLogger(__name__)

DEFAULT_ROUTE_COLOR = '#8b4513'


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
    nominatim: NominatimService | None = None,
) -> Tuple[Trip, List[Dict[str, Any]]]:
    """
    Create Trip, Routes, POIs, RoutePOIs inside a transaction.
    Returns (trip, warnings). Warnings for skipped stops (empty search / transient error).

    Baidu / Nominatim 检索在事务外按天、按站点严格串行；每次实际请求结束后休眠对应 interval，避免超频。
    """
    svc = baidu or BaiduPOIService(ak=settings.BAIDU_MAP_AK)
    international = draft.trip_geo_scope == 'international'
    nom: NominatimService | None = nominatim
    if international and nom is None:
        nom = get_nominatim_service()
    warnings: List[Dict[str, Any]] = []
    interval_baidu = float(getattr(settings, 'BAIDU_SMART_COMMIT_INTERVAL_SEC', 0.35))
    interval_nominatim = float(getattr(settings, 'NOMINATIM_SMART_COMMIT_INTERVAL_SEC', 1.15))

    name = trip_meta.get('name') or draft.trip_summary.title_hint
    destination = trip_meta.get('destination') or draft.trip_summary.destination_summary
    start_date = trip_meta.get('start_date')

    resolved_days: List[Tuple[Day, List[Dict[str, Any] | None]]] = []
    for day in draft.days:
        formatted_by_stop: List[Dict[str, Any] | None] = []
        for stop in day.stops:
            if international:
                assert nom is not None
                formatted_by_stop.append(
                    resolve_stop_international(day, stop, nom, warnings, interval_nominatim)
                )
            else:
                formatted_by_stop.append(
                    resolve_stop_domestic(day, stop, svc, warnings, interval_baidu)
                )
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
