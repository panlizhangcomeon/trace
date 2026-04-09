"""
Contract tests for Traffic API endpoints.
"""
import pytest
from rest_framework.test import APIClient
from apps.pois.models import POI
from apps.traffic.models import TrafficOption


@pytest.mark.django_db
class TestTrafficContract:
    """Contract tests for Traffic API."""

    def setup_method(self):
        self.client = APIClient()

    def test_get_traffic_options_contract(self):
        """GET /api/v1/traffic/options/ - Get Traffic Options."""
        poi1 = POI.objects.create(
            latitude=25.0, longitude=102.0,
            name='Start', type='attraction'
        )
        poi2 = POI.objects.create(
            latitude=25.1, longitude=102.1,
            name='End', type='attraction'
        )
        TrafficOption.objects.create(
            from_poi=poi1, to_poi=poi2,
            mode='bicycle',
            duration_minutes=45,
            cost=30.00
        )

        response = self.client.get(
            f'/api/v1/traffic/options/?from_poi_id={poi1.id}&to_poi_id={poi2.id}'
        )

        assert response.status_code == 200
        assert 'options' in response.data
        assert len(response.data['options']) >= 1

    def test_get_route_traffic_contract(self):
        """POST /api/v1/traffic/route-traffic/ - Get Route Traffic."""
        from apps.routes.models import Route, RoutePOI

        poi1 = POI.objects.create(
            latitude=25.0, longitude=102.0,
            name='Start', type='attraction'
        )
        poi2 = POI.objects.create(
            latitude=25.1, longitude=102.1,
            name='End', type='attraction'
        )
        route = Route.objects.create(name='Test Route')
        RoutePOI.objects.create(route=route, poi=poi1, order_index=0)
        RoutePOI.objects.create(route=route, poi=poi2, order_index=1)

        response = self.client.post(
            '/api/v1/traffic/route-traffic/',
            {'route_id': str(route.id)},
            format='json'
        )

        assert response.status_code == 200
        assert 'segments' in response.data
        assert len(response.data['segments']) == 1
