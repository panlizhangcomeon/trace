"""
Contract tests for Route API endpoints.
"""
import pytest
from rest_framework.test import APIClient
from apps.pois.models import POI
from apps.routes.models import Route


@pytest.mark.django_db
class TestRouteContract:
    """Contract tests for Route API."""

    def setup_method(self):
        self.client = APIClient()

    def test_create_route_contract(self):
        """POST /api/v1/routes/ - Create Route."""
        data = {
            'name': '大理Day1：苍山小众徒步线',
            'color': '#FF6B81',
            'day_number': 1
        }
        response = self.client.post('/api/v1/routes/', data, format='json')

        assert response.status_code == 201
        assert 'id' in response.data
        assert response.data['name'] == '大理Day1：苍山小众徒步线'

    def test_get_route_detail_contract(self):
        """GET /api/v1/routes/{id}/ - Get Route Detail."""
        route = Route.objects.create(name='Test Route')
        response = self.client.get(f'/api/v1/routes/{route.id}/')

        assert response.status_code == 200
        assert response.data['name'] == 'Test Route'
        assert 'pois' in response.data

    def test_connect_pois_to_route_contract(self):
        """POST /api/v1/routes/{id}/connect/ - Connect POIs to Route."""
        poi1 = POI.objects.create(
            latitude=25.0, longitude=102.0,
            name='POI 1', type='attraction'
        )
        poi2 = POI.objects.create(
            latitude=25.1, longitude=102.1,
            name='POI 2', type='attraction'
        )
        route = Route.objects.create(name='Test Route')

        data = {
            'poi_ids': [str(poi1.id), str(poi2.id)],
            'order': [0, 1]
        }
        response = self.client.post(f'/api/v1/routes/{route.id}/connect/', data, format='json')

        assert response.status_code == 200
        assert response.data['route_id'] == str(route.id)
        assert len(response.data['pois']) == 2

    def test_connect_empty_clears_route_pois(self):
        """POST connect with empty poi_ids removes all stops from the route."""
        poi1 = POI.objects.create(
            latitude=25.0, longitude=102.0, name='POI 1', type='attraction'
        )
        route = Route.objects.create(name='Test Route')
        self.client.post(
            f'/api/v1/routes/{route.id}/connect/',
            {'poi_ids': [str(poi1.id)]},
            format='json',
        )
        clear = self.client.post(
            f'/api/v1/routes/{route.id}/connect/',
            {'poi_ids': []},
            format='json',
        )
        assert clear.status_code == 200
        assert clear.data['pois'] == []

    def test_update_route_contract(self):
        """PUT /api/v1/routes/{id}/ - Update Route."""
        route = Route.objects.create(name='Original Name')
        data = {'name': 'Updated Route Name'}
        response = self.client.put(f'/api/v1/routes/{route.id}/', data, format='json')

        assert response.status_code == 200
        assert response.data['name'] == 'Updated Route Name'

    def test_delete_route_contract(self):
        """DELETE /api/v1/routes/{id}/ - Delete Route."""
        route = Route.objects.create(name='To Delete')
        response = self.client.delete(f'/api/v1/routes/{route.id}/')

        assert response.status_code == 204
        assert Route.objects.count() == 0
