"""Unit tests for smart_trip_geocode."""
from unittest.mock import MagicMock

import pytest

from services.itinerary_schema import Day, Stop
from services.smart_trip_geocode import resolve_stop_international


def test_resolve_stop_international_calls_nominatim_with_country():
    day = Day(
        day_index=1,
        city_context='Tokyo',
        country_code='jp',
        stops=[],
    )
    stop = Stop(display_name='东京迪士尼', search_query='Tokyo Disneyland')
    nom = MagicMock()
    nom.search.return_value = [
        {
            'place_id': 1,
            'lat': '35.6329',
            'lon': '139.8804',
            'display_name': 'Tokyo Disneyland, Urayasu',
            'name': 'Tokyo Disneyland',
            'type': 'theme_park',
            'class': 'tourism',
            'address': {'city': 'Urayasu', 'country': 'Japan'},
            'osm_type': 'way',
            'osm_id': 99,
        }
    ]
    nom.format_as_geoplace.side_effect = lambda r: {
        'name': r['name'],
        'latitude': float(r['lat']),
        'longitude': float(r['lon']),
    }
    warnings = []
    out = resolve_stop_international(day, stop, nom, warnings, interval_sec=0.0)
    assert out is not None
    assert out['name'] == 'Tokyo Disneyland'
    nom.search.assert_called_once()
    kw = nom.search.call_args.kwargs
    assert 'Tokyo' in kw['query'] or 'Tokyo Disneyland' in kw['query']
    assert kw.get('country_codes') == 'jp'
