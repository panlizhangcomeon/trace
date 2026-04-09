"""
Unit tests for smart_trip_builder (mock Baidu).
"""
from unittest.mock import MagicMock

import pytest

from apps.pois.models import POI
from apps.routes.models import Route
from apps.trips.models import Trip
from services.itinerary_schema import ItineraryDraftV1
from services.smart_trip_builder import commit_draft, find_reusable_poi


def _draft_two_days() -> ItineraryDraftV1:
    return ItineraryDraftV1.model_validate(
        {
            'schema_version': '1',
            'trip_summary': {'title_hint': '测试', 'destination_summary': '滇西北'},
            'origin': {'label': '昆明'},
            'days': [
                {
                    'day_index': 1,
                    'city_context': '丽江',
                    'stops': [
                        {
                            'display_name': '古城',
                            'duration_minutes': 120,
                            'notes': '闲逛',
                            'travel_hint': '',
                        },
                        {
                            'display_name': '玉龙雪山',
                            'travel_hint': '包车前往',
                        },
                    ],
                },
                {
                    'day_index': 2,
                    'city_context': '大理',
                    'stops': [{'display_name': '洱海'}],
                },
            ],
        }
    )


@pytest.mark.django_db
class TestSmartTripBuilder:
    def test_multi_day_routes_and_order(self):
        draft = _draft_two_days()

        baidu = MagicMock()
        baidu.search_strict.return_value = [
            {
                'name': '测点',
                'location': {'lat': 26.8721, 'lng': 100.23},
                'address': '路1号',
            }
        ]
        baidu.format_poi_result.side_effect = lambda r: {
            'name': r['name'],
            'latitude': r['location']['lat'],
            'longitude': r['location']['lng'],
        }

        trip, warnings = commit_draft(
            draft,
            {'name': '我的行', 'destination': '云南', 'start_date': None},
            baidu=baidu,
        )

        assert Trip.objects.filter(id=trip.id).exists()
        routes = list(Route.objects.filter(trip=trip).order_by('day_number'))
        assert len(routes) == 2
        assert routes[0].day_number == 1
        assert routes[0].color == '#8b4513'
        assert '第1天' in (routes[0].name or '')
        assert routes[0].route_pois.count() == 2
        assert routes[1].route_pois.count() == 1

        rp0 = routes[0].route_pois.order_by('order_index').first()
        assert rp0.order_index == 0
        assert rp0.segment_note is None
        rp1 = routes[0].route_pois.order_by('order_index')[1]
        assert rp1.segment_note == '包车前往'

    def test_poi_dedupe_by_name_and_coords(self):
        draft = ItineraryDraftV1.model_validate(
            {
                'schema_version': '1',
                'trip_summary': {'title_hint': 't', 'destination_summary': 'd'},
                'origin': {'label': 'o'},
                'days': [
                    {
                        'day_index': 1,
                        'city_context': '同城',
                        'stops': [
                            {'display_name': '同景'},
                            {'display_name': '同景'},
                        ],
                    }
                ],
            }
        )

        baidu = MagicMock()
        baidu.search_strict.return_value = [
            {'name': '同景', 'location': {'lat': 22.123456789, 'lng': 113.987654321}}
        ]
        baidu.format_poi_result.side_effect = lambda r: {
            'name': r['name'],
            'latitude': r['location']['lat'],
            'longitude': r['location']['lng'],
        }

        trip, _warnings = commit_draft(draft, {}, baidu=baidu)
        assert POI.objects.filter(name='同景').count() == 1
        assert Route.objects.get(trip=trip).route_pois.count() == 2

    def test_skip_stop_collects_warning(self):
        draft = ItineraryDraftV1.model_validate(
            {
                'schema_version': '1',
                'trip_summary': {'title_hint': 't', 'destination_summary': 'd'},
                'origin': {'label': 'o'},
                'days': [
                    {
                        'day_index': 1,
                        'city_context': '无结果市',
                        'stops': [{'display_name': '不存在景点'}],
                    }
                ],
            }
        )
        baidu = MagicMock()
        baidu.search_strict.return_value = []

        trip, warnings = commit_draft(draft, {}, baidu=baidu)
        assert warnings and warnings[0]['code'] == 'poi_search_empty'
        assert trip.routes.count() == 1
        assert trip.routes.first().route_pois.count() == 0

    def test_international_commit_uses_nominatim_mock(self):
        draft = ItineraryDraftV1.model_validate(
            {
                'schema_version': '1',
                'trip_geo_scope': 'international',
                'trip_summary': {'title_hint': 'JP', 'destination_summary': 'Tokyo'},
                'origin': {'label': 'NRT'},
                'days': [
                    {
                        'day_index': 1,
                        'city_context': 'Tokyo',
                        'country_code': 'jp',
                        'stops': [{'display_name': '塔', 'search_query': 'Tokyo Tower'}],
                    }
                ],
            }
        )
        nom = MagicMock()
        nom.search.return_value = [
            {
                'place_id': 1,
                'lat': '35.6586',
                'lon': '139.7454',
                'display_name': 'Tokyo Tower',
                'name': 'Tokyo Tower',
                'type': 'tower',
                'class': 'tourism',
                'address': {},
                'osm_type': 'node',
                'osm_id': 1,
            }
        ]
        nom.format_as_geoplace.side_effect = lambda r: {
            'name': r['name'],
            'latitude': float(r['lat']),
            'longitude': float(r['lon']),
        }
        trip, _w = commit_draft(draft, {}, baidu=MagicMock(), nominatim=nom)
        assert trip.routes.first().route_pois.count() == 1
        nom.search.assert_called()


@pytest.mark.django_db
def test_find_reusable_poi_rounding():
    p = POI.objects.create(
        name='重复点',
        latitude='22.123451',
        longitude='113.987651',
        type='attraction',
        tags=[],
    )
    found = find_reusable_poi('重复点', 22.123454999, 113.987654444)
    assert found is not None
    assert found.id == p.id
