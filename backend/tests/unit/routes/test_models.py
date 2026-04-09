"""
Unit tests for Route models.
"""
import pytest
from apps.pois.models import POI
from apps.routes.models import Route, RoutePOI


@pytest.mark.django_db
class TestRouteModel:
    """Test Route model behavior."""

    def test_route_creation(self):
        """Test creating a route."""
        route = Route.objects.create(
            name='大理Day1',
            color='#FF6B81',
            day_number=1
        )
        assert route.id is not None
        assert route.name == '大理Day1'
        assert route.color == '#FF6B81'
        assert route.day_number == 1

    def test_route_default_color(self):
        """Test route default color is pink."""
        route = Route.objects.create(name='Test Route')
        assert route.color == '#FF6B81'


@pytest.mark.django_db
class TestRoutePOIModel:
    """Test RoutePOI junction model."""

    def test_route_poi_creation(self):
        """Test creating a RoutePOI."""
        poi1 = POI.objects.create(
            latitude=25.0, longitude=102.0,
            name='POI 1', type='attraction'
        )
        poi2 = POI.objects.create(
            latitude=25.1, longitude=102.1,
            name='POI 2', type='attraction'
        )
        route = Route.objects.create(name='Test Route')

        route_poi1 = RoutePOI.objects.create(route=route, poi=poi1, order_index=0)
        route_poi2 = RoutePOI.objects.create(route=route, poi=poi2, order_index=1)

        assert route_poi1.order_index == 0
        assert route_poi2.order_index == 1
        assert route.route_pois.count() == 2

    def test_route_poi_ordering(self):
        """Test that RoutePOIs are ordered by order_index."""
        poi1 = POI.objects.create(
            latitude=25.0, longitude=102.0,
            name='POI 1', type='attraction'
        )
        poi2 = POI.objects.create(
            latitude=25.1, longitude=102.1,
            name='POI 2', type='attraction'
        )
        poi3 = POI.objects.create(
            latitude=25.2, longitude=102.2,
            name='POI 3', type='attraction'
        )
        route = Route.objects.create(name='Test Route')

        RoutePOI.objects.create(route=route, poi=poi3, order_index=2)
        RoutePOI.objects.create(route=route, poi=poi1, order_index=0)
        RoutePOI.objects.create(route=route, poi=poi2, order_index=1)

        ordered_pois = list(route.route_pois.order_by('order_index'))
        assert ordered_pois[0].poi.name == 'POI 1'
        assert ordered_pois[1].poi.name == 'POI 2'
        assert ordered_pois[2].poi.name == 'POI 3'
