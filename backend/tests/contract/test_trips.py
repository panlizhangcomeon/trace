"""
Contract tests for Trip API endpoints.
"""
import pytest
from rest_framework.test import APIClient
from apps.trips.models import Trip


@pytest.mark.django_db
class TestTripContract:
    """Contract tests for Trip API."""

    def setup_method(self):
        self.client = APIClient()

    def test_create_trip_contract(self):
        """POST /api/v1/trips/ - Create Trip."""
        data = {
            'name': '大理情侣游',
            'destination': '大理',
            'start_date': '2026-05-01'
        }
        response = self.client.post('/api/v1/trips/', data, format='json')

        assert response.status_code == 201
        assert 'id' in response.data
        assert response.data['name'] == '大理情侣游'

    def test_list_trips_contract(self):
        """GET /api/v1/trips/ - List Trips."""
        Trip.objects.create(name='Trip 1', destination='大理')
        response = self.client.get('/api/v1/trips/')

        assert response.status_code == 200
        assert 'results' in response.data

    def test_get_trip_detail_contract(self):
        """GET /api/v1/trips/{id}/ - Get Trip Detail."""
        trip = Trip.objects.create(name='Test Trip', destination='大理')
        response = self.client.get(f'/api/v1/trips/{trip.id}/')

        assert response.status_code == 200
        assert response.data['name'] == 'Test Trip'
        assert 'routes' in response.data

    def test_update_trip_contract(self):
        """PUT /api/v1/trips/{id}/ - Update Trip."""
        trip = Trip.objects.create(name='Original Name')
        data = {'name': 'Updated Name'}
        response = self.client.put(f'/api/v1/trips/{trip.id}/', data, format='json')

        assert response.status_code == 200
        assert response.data['name'] == 'Updated Name'

    def test_delete_trip_contract(self):
        """DELETE /api/v1/trips/{id}/ - Delete Trip."""
        trip = Trip.objects.create(name='To Delete')
        response = self.client.delete(f'/api/v1/trips/{trip.id}/')

        assert response.status_code == 204
        assert Trip.objects.count() == 0
