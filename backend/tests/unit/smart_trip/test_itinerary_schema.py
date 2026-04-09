"""
Unit tests for ItineraryDraftV1 schema.
"""
import pytest
from pydantic import ValidationError

from services.itinerary_schema import ItineraryDraftV1


def _minimal_valid() -> dict:
    return {
        'schema_version': '1',
        'trip_summary': {
            'title_hint': '泰北慢行',
            'destination_summary': '清迈与周边',
        },
        'origin': {'label': '上海浦东机场'},
        'days': [
            {
                'day_index': 1,
                'city_context': '清迈',
                'stops': [
                    {
                        'display_name': '塔佩门',
                        'search_query': '清迈 塔佩门',
                        'duration_minutes': 60,
                        'notes': '拍照',
                    }
                ],
            },
            {
                'day_index': 2,
                'city_context': '清迈',
                'stops': [{'display_name': '素贴山'}],
            },
        ],
    }


def test_valid_fixture():
    d = ItineraryDraftV1.model_validate(_minimal_valid())
    assert d.days[0].day_index == 1
    assert d.days[1].day_index == 2
    assert d.days[0].stops[0].display_name == '塔佩门'


def test_day_index_not_consecutive_fails():
    data = _minimal_valid()
    data['days'] = [
        {'day_index': 1, 'city_context': 'A', 'stops': []},
        {'day_index': 3, 'city_context': 'B', 'stops': []},
    ]
    with pytest.raises(ValidationError):
        ItineraryDraftV1.model_validate(data)


def test_day_index_duplicate_fails():
    data = _minimal_valid()
    data['days'] = [
        {'day_index': 1, 'city_context': 'A', 'stops': []},
        {'day_index': 1, 'city_context': 'B', 'stops': []},
    ]
    with pytest.raises(ValidationError):
        ItineraryDraftV1.model_validate(data)


def test_segments_optional():
    data = _minimal_valid()
    data['segments'] = [
        {'city_label': '清迈', 'days': 2},
    ]
    d = ItineraryDraftV1.model_validate(data)
    assert d.segments is not None
    assert len(d.segments) == 1


def test_stops_optional_fields_omitted():
    data = _minimal_valid()
    data['days'] = [{'day_index': 1, 'city_context': 'X', 'stops': [{'display_name': '仅名称'}]}]
    d = ItineraryDraftV1.model_validate(data)
    assert d.days[0].stops[0].search_query is None
