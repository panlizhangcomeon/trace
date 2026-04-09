"""
Contract tests for POI API endpoints.
"""
import pytest
from rest_framework.test import APIClient
from apps.pois.models import POI


@pytest.mark.django_db
class TestPOIContract:
    """Contract tests for POI API."""

    def setup_method(self):
        self.client = APIClient()

    def test_create_poi_contract(self):
        """POST /api/v1/pois/ - Create POI."""
        data = {
            'latitude': 25.0968,
            'longitude': 102.8463,
            'name': '大理古城',
            'type': 'attraction',
            'note': '傍晚拍照最佳',
            'tags': ['local_secret', 'couple_friendly']
        }
        response = self.client.post('/api/v1/pois/', data, format='json')

        assert response.status_code == 201
        assert 'id' in response.data
        assert response.data['name'] == '大理古城'
        assert response.data['latitude'] == '25.09680000'
        assert 'local_secret' in response.data['tags']

    def test_list_pois_contract(self):
        """GET /api/v1/pois/ - List POIs."""
        POI.objects.create(
            latitude=25.0, longitude=102.0,
            name='Test POI', type='attraction'
        )
        response = self.client.get('/api/v1/pois/')

        assert response.status_code == 200
        assert 'results' in response.data
        assert len(response.data['results']) >= 1

    def test_search_pois_contract(self):
        """GET /api/v1/pois/search/ - Search POIs."""
        POI.objects.create(
            latitude=25.0, longitude=102.0,
            name='大理古城', type='attraction'
        )
        response = self.client.get('/api/v1/pois/search/?search=大理')

        assert response.status_code == 200
        assert 'count' in response.data
        assert 'results' in response.data
        assert response.data.get('provider') in ('baidu', 'nominatim', None)
        assert 'cached' in response.data

    def test_update_poi_contract(self):
        """PUT /api/v1/pois/{id}/ - Update POI."""
        poi = POI.objects.create(
            latitude=25.0, longitude=102.0,
            name='Original Name', type='attraction'
        )
        data = {'name': 'Updated Name'}
        response = self.client.put(f'/api/v1/pois/{poi.id}/', data, format='json')

        assert response.status_code == 200
        assert response.data['name'] == 'Updated Name'

    def test_delete_poi_contract(self):
        """DELETE /api/v1/pois/{id}/ - Delete POI."""
        poi = POI.objects.create(
            latitude=25.0, longitude=102.0,
            name='To Delete', type='attraction'
        )
        response = self.client.delete(f'/api/v1/pois/{poi.id}/')

        assert response.status_code == 204
        assert POI.objects.count() == 0
