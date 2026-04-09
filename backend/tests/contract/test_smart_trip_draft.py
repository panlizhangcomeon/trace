"""
Contract tests: POST /api/v1/trips/ai-draft/
"""
import json
from unittest.mock import patch

import pytest
from django.urls import reverse

from services.itinerary_schema import ItineraryDraftV1


def _valid_draft_json() -> str:
    d = {
        'schema_version': '1',
        'trip_summary': {'title_hint': '标题', 'destination_summary': '概要'},
        'origin': {'label': '出发'},
        'days': [
            {
                'day_index': 1,
                'city_context': '杭州',
                'stops': [{'display_name': '西湖'}],
            }
        ],
    }
    ItineraryDraftV1.model_validate(d)
    return json.dumps(d, ensure_ascii=False)


@pytest.mark.django_db
class TestSmartTripDraftContract:
    def setup_method(self):
        from rest_framework.test import APIClient

        self.client = APIClient()

    def test_reverse_url(self):
        # DRF @action url_name defaults to method name (ai_draft), url_path is ai-draft
        url = reverse('trip-ai_draft')
        assert url == '/api/v1/trips/ai-draft/'

    @patch('apps.trips.views.chat_completion')
    def test_ai_draft_success(self, mock_llm):
        mock_llm.return_value = _valid_draft_json()
        response = self.client.post(
            '/api/v1/trips/ai-draft/',
            {'user_text': '我想去杭州一天', 'locale': 'zh-CN'},
            format='json',
        )
        assert response.status_code == 200
        assert 'draft' in response.data
        assert response.data['draft']['schema_version'] == '1'

    def test_empty_user_text_400(self):
        response = self.client.post('/api/v1/trips/ai-draft/', {'user_text': ''}, format='json')
        assert response.status_code == 400
        assert response.data.get('error') == 'bad_request'

    def test_user_text_too_long_400(self):
        response = self.client.post(
            '/api/v1/trips/ai-draft/',
            {'user_text': 'x' * 8001},
            format='json',
        )
        assert response.status_code == 400

    @patch('apps.trips.views.chat_completion')
    def test_invalid_llm_json_422(self, mock_llm):
        mock_llm.return_value = 'not json at all'
        response = self.client.post(
            '/api/v1/trips/ai-draft/',
            {'user_text': 'hello'},
            format='json',
        )
        assert response.status_code == 422
        assert response.data.get('error') == 'draft_validation_failed'

    @patch('apps.trips.views.chat_completion')
    def test_llm_timeout_504(self, mock_llm):
        from services.llm_client import LLMTimeoutError

        mock_llm.side_effect = LLMTimeoutError('timeout')
        response = self.client.post(
            '/api/v1/trips/ai-draft/',
            {'user_text': 'hello'},
            format='json',
        )
        assert response.status_code == 504
        assert response.data.get('error') == 'llm_timeout'

    @patch('apps.trips.views.chat_completion')
    def test_llm_unavailable_503(self, mock_llm):
        from services.llm_client import LLMUnavailableError

        mock_llm.side_effect = LLMUnavailableError('down')
        response = self.client.post(
            '/api/v1/trips/ai-draft/',
            {'user_text': 'hello'},
            format='json',
        )
        assert response.status_code == 503
        assert response.data.get('error') == 'llm_unavailable'
