"""
Contract tests: POST /api/v1/trips/ai-commit/
"""
from unittest.mock import patch

import pytest
from django.urls import reverse

VALID_BODY = {
    'draft': {
        'schema_version': '1',
        'trip_summary': {'title_hint': '契约测', 'destination_summary': '测'},
        'origin': {'label': 'o'},
        'days': [
            {
                'day_index': 1,
                'city_context': '深圳',
                'stops': [{'display_name': '深圳湾', 'search_query': '深圳湾公园'}],
            }
        ],
    },
    'trip': {'name': '契约行程', 'destination': '深圳', 'start_date': None},
}


@pytest.mark.django_db
class TestSmartTripCommitContract:
    def setup_method(self):
        from rest_framework.test import APIClient

        self.client = APIClient()

    def test_reverse_url(self):
        url = reverse('trip-ai-commit')
        assert url == '/api/v1/trips/ai-commit/'

    @patch('services.smart_trip_builder.BaiduPOIService')
    def test_ai_commit_success_201(self, MockBaidu):
        instance = MockBaidu.return_value
        instance.search_strict.return_value = [
            {'name': '深圳湾公园', 'location': {'lat': 22.5, 'lng': 113.9}, 'address': '南山'}
        ]
        instance.format_poi_result.side_effect = lambda r: {
            'name': r['name'],
            'latitude': r['location']['lat'],
            'longitude': r['location']['lng'],
        }

        response = self.client.post('/api/v1/trips/ai-commit/', VALID_BODY, format='json')
        assert response.status_code == 201
        assert 'trip' in response.data
        assert 'warnings' in response.data
        assert response.data['trip']['name'] == '契约行程'
        assert 'routes' in response.data['trip']

    def test_invalid_draft_422(self):
        bad = {
            'draft': {'schema_version': '1', 'trip_summary': {}, 'origin': {}, 'days': []},
            'trip': {},
        }
        response = self.client.post('/api/v1/trips/ai-commit/', bad, format='json')
        assert response.status_code == 422
        assert response.data.get('error') == 'draft_validation_failed'

    @patch('services.smart_trip_builder.BaiduPOIService')
    def test_baidu_global_error_503(self, MockBaidu):
        from services.baidu_poi_service import BaiduAPIError

        instance = MockBaidu.return_value
        instance.search_strict.side_effect = BaiduAPIError('status=300')

        response = self.client.post('/api/v1/trips/ai-commit/', VALID_BODY, format='json')
        assert response.status_code == 503
        assert response.data.get('error') == 'baidu_unavailable'
