"""
Unit tests for OSRM client.
"""
import pytest
from unittest.mock import patch, MagicMock
from apps.traffic.views import OSRMClient


class TestOSRMClient:
    """Test OSRM client functionality."""

    @patch('apps.traffic.views.requests.get')
    def test_get_route_success(self, mock_get):
        """Test successful route retrieval."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            'code': 'Ok',
            'routes': [{
                'distance': 15000,
                'duration': 1800,
                'geometry': 'mock_polyline'
            }]
        }
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        client = OSRMClient()
        result = client.get_route([[102.8, 25.0], [102.9, 25.1]])

        assert result is not None
        assert result['distance'] == 15000
        assert result['duration'] == 1800
        assert result['geometry'] == 'mock_polyline'

    @patch('apps.traffic.views.requests.get')
    def test_get_route_osrm_error(self, mock_get):
        """Test OSRM returns error."""
        mock_response = MagicMock()
        mock_response.json.return_value = {'code': 'NoRoute'}
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        client = OSRMClient()
        result = client.get_route([[102.8, 25.0], [102.9, 25.1]])

        assert result is None

    @patch('apps.traffic.views.requests.get')
    def test_get_route_network_error(self, mock_get):
        """Test network error handling."""
        import requests
        mock_get.side_effect = requests.RequestException("Network error")

        client = OSRMClient()
        result = client.get_route([[102.8, 25.0], [102.9, 25.1]])

        assert result is None
