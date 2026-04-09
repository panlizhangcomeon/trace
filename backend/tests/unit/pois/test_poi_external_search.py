"""Unit tests for cached external POI search routing."""
from unittest.mock import MagicMock, patch

import pytest
from django.core.cache import cache

from services.poi_external_search import search_external_places


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
def test_domestic_uses_baidu_and_caches():
    raw = [
        {
            'name': '测试点',
            'location': {'lat': 39.9, 'lng': 116.4},
            'uid': 'u1',
            'address': '路1号',
            'province': '京',
            'city': '北京',
            'area': '区',
            'type': 'life',
            'tag': 'tag',
        }
    ]
    with patch('services.baidu_poi_service.BaiduPOIService') as m_cls:
        inst = MagicMock()
        m_cls.return_value = inst
        inst.search.return_value = raw
        inst.format_poi_result.side_effect = lambda r: {'name': r['name'], 'latitude': 1, 'longitude': 2}

        r1, p1, c1 = search_external_places('故宫', geo_scope='domestic', region='北京', limit=5)
        r2, p2, c2 = search_external_places('故宫', geo_scope='domestic', region='北京', limit=5)

    assert p1 == 'baidu' and p2 == 'baidu'
    assert c1 is False and c2 is True
    assert inst.search.call_count == 1
    assert len(r1) == 1 and r1 == r2


@pytest.mark.django_db
def test_international_uses_nominatim_and_caches():
    raw = [
        {
            'place_id': 99,
            'lat': '48.858',
            'lon': '2.294',
            'display_name': 'Eiffel Tower, Paris',
            'name': 'Eiffel Tower',
            'type': 'attraction',
            'class': 'tourism',
            'address': {'city': 'Paris', 'country': 'France'},
            'osm_type': 'way',
            'osm_id': 123,
        }
    ]
    with patch('services.nominatim_service.get_nominatim_service') as gns:
        nom = MagicMock()
        gns.return_value = nom
        nom.search.return_value = raw
        nom.format_as_geoplace.side_effect = lambda r: {'uid': 'x', 'name': r['name']}

        r1, p1, c1 = search_external_places(
            'Eiffel', geo_scope='international', region='Paris', limit=3, country_codes='fr'
        )
        r2, p2, c2 = search_external_places(
            'Eiffel', geo_scope='international', region='Paris', limit=3, country_codes='fr'
        )

    assert p1 == 'nominatim' and p2 == 'nominatim'
    assert c1 is False and c2 is True
    assert nom.search.call_count == 1
    nom.search.assert_called_once()
    call_kw = nom.search.call_args.kwargs
    assert 'Paris' in call_kw['query']
    assert call_kw['country_codes'] == 'fr'


@pytest.mark.django_db
def test_domestic_empty_not_cached_so_second_call_hits_baidu_again():
    with patch('services.baidu_poi_service.BaiduPOIService') as m_cls:
        inst = MagicMock()
        m_cls.return_value = inst
        inst.search.return_value = []
        inst.format_poi_result.side_effect = lambda r: r

        search_external_places('nope', geo_scope='domestic', region='全国', limit=5)
        search_external_places('nope', geo_scope='domestic', region='全国', limit=5)

    assert inst.search.call_count == 2


@pytest.mark.django_db
def test_international_invalid_country_codes_sanitized_to_none():
    with patch('services.nominatim_service.get_nominatim_service') as gns:
        nom = MagicMock()
        gns.return_value = nom
        nom.search.return_value = []
        nom.format_as_geoplace.side_effect = lambda r: r

        search_external_places(
            'Tokyo Disneyland',
            geo_scope='international',
            region='全国',
            limit=5,
            country_codes='日本',
        )

    kw = nom.search.call_args.kwargs
    assert kw.get('country_codes') is None


@pytest.mark.django_db
def test_international_retries_without_country_when_filtered_empty():
    raw_hit = [
        {
            'place_id': 1,
            'lat': '35.63',
            'lon': '139.88',
            'display_name': 'Tokyo Disneyland',
            'name': 'Tokyo Disneyland',
            'type': 'theme_park',
            'class': 'tourism',
            'address': {},
            'osm_type': 'way',
            'osm_id': 1,
        }
    ]
    with patch('services.nominatim_service.get_nominatim_service') as gns:
        nom = MagicMock()
        gns.return_value = nom
        nom.search.side_effect = [[], raw_hit]
        nom.format_as_geoplace.side_effect = lambda r: {
            'name': r['name'],
            'latitude': float(r['lat']),
            'longitude': float(r['lon']),
        }

        results, provider, cached = search_external_places(
            'Tokyo Disneyland',
            geo_scope='international',
            region='全国',
            limit=5,
            country_codes='xx',
        )

    assert provider == 'nominatim'
    assert cached is False
    assert len(results) == 1
    assert nom.search.call_count == 2
    assert nom.search.call_args_list[0].kwargs.get('country_codes') == 'xx'
    assert nom.search.call_args_list[1].kwargs.get('country_codes') is None
