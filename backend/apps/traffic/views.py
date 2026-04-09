"""
Traffic views.
"""
import requests
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.conf import settings

from .models import TrafficOption
from .serializers import TrafficOptionSerializer, RouteTrafficRequestSerializer
from apps.routes.models import Route, RoutePOI

logger = logging.getLogger(__name__)


class TrafficViewSet(viewsets.ModelViewSet):
    """
    Traffic ViewSet - provides traffic options retrieval.

    list: GET /api/v1/traffic/options/
    get_options: GET /api/v1/traffic/options/?from_poi_id=xxx&to_poi_id=yyy&couple_friendly=true
    get_route_traffic: POST /api/v1/traffic/route-traffic/
    """
    queryset = TrafficOption.objects.all()
    serializer_class = TrafficOptionSerializer

    @action(detail=False, methods=['get'])
    def options(self, request):
        """
        Get traffic options between two POIs.
        GET /api/v1/traffic/options/?from_poi_id=xxx&to_poi_id=yyy&couple_friendly=true&modes=bus,taxi
        """
        from_poi_id = request.query_params.get('from_poi_id')
        to_poi_id = request.query_params.get('to_poi_id')
        couple_friendly = request.query_params.get('couple_friendly', 'false').lower() == 'true'
        modes = request.query_params.get('modes', None)

        if not from_poi_id or not to_poi_id:
            return Response(
                {'error': {'code': 'VALIDATION_ERROR', 'message': 'from_poi_id and to_poi_id are required'}},
                status=status.HTTP_400_BAD_REQUEST
            )

        queryset = TrafficOption.objects.filter(from_poi_id=from_poi_id, to_poi_id=to_poi_id)

        if couple_friendly:
            queryset = queryset.filter(couple_friendly_tags__len__gt=0)

        if modes:
            mode_list = [m.strip() for m in modes.split(',')]
            queryset = queryset.filter(mode__in=mode_list)

        queryset = queryset.order_by('duration_minutes')[:20]
        serializer = TrafficOptionSerializer(queryset, many=True)

        return Response({
            'from_poi_id': from_poi_id,
            'to_poi_id': to_poi_id,
            'options': serializer.data
        })

    @action(detail=False, methods=['post'])
    def route_traffic(self, request):
        """
        Get traffic options for all segments of a route.
        POST /api/v1/traffic/route-traffic/
        {"route_id": "uuid"}
        """
        serializer = RouteTrafficRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': {'code': 'VALIDATION_ERROR', 'message': 'Invalid data', 'details': serializer.errors}},
                status=status.HTTP_400_BAD_REQUEST
            )

        route_id = serializer.validated_data['route_id']

        try:
            route = Route.objects.prefetch_related('route_pois__poi').get(id=route_id)
        except Route.DoesNotExist:
            return Response(
                {'error': {'code': 'NOT_FOUND', 'message': 'Route not found'}},
                status=status.HTTP_404_NOT_FOUND
            )

        route_pois = route.route_pois.select_related('poi').order_by('order_index')
        pois = [rp.poi for rp in route_pois]

        segments = []
        for i in range(len(pois) - 1):
            from_poi = pois[i]
            to_poi = pois[i + 1]

            traffic_options = TrafficOption.objects.filter(
                from_poi=from_poi,
                to_poi=to_poi
            ).order_by('duration_minutes')[:10]

            segments.append({
                'from_poi_id': str(from_poi.id),
                'to_poi_id': str(to_poi.id),
                'options': TrafficOptionSerializer(traffic_options, many=True).data
            })

        return Response({
            'route_id': str(route_id),
            'segments': segments
        })


class OSRMClient:
    """
    OSRM (OpenStreetMap Routing Machine) client for route calculation.
    """

    def __init__(self, base_url=None):
        self.base_url = base_url or settings.OSRM_URL

    def get_route(self, coordinates, profile='driving'):
        """
        Get route between coordinates using OSRM.

        Args:
            coordinates: List of [lng, lat] pairs
            profile: routing profile (driving, cycling, walking)

        Returns:
            dict with distance, duration, and geometry
        """
        coords = ';'.join([f"{lng},{lat}" for lng, lat in coordinates])
        url = f"{self.base_url}/route/v1/{profile}/{coords}"

        try:
            response = requests.get(url, params={'overview': 'full', 'geometries': 'polyline'}, timeout=10)
            response.raise_for_status()
            data = response.json()

            if data.get('code') != 'Ok':
                logger.error(f"OSRM error: {data}")
                return None

            route = data['routes'][0]
            return {
                'distance': route['distance'],
                'duration': route['duration'],
                'geometry': route['geometry'],
            }
        except requests.RequestException as e:
            logger.error(f"OSRM request failed: {e}")
            return None
