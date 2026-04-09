"""
Route views.
"""
from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction

from .models import Route, RoutePOI
from .serializers import (
    RouteSerializer,
    RouteCreateSerializer,
    RouteConnectSerializer,
    RoutePOINotesUpdateSerializer,
    RoutePOISerializer,
)
from apps.pois.models import POI


class RoutePOINotesViewSet(mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """
    PATCH /api/v1/routes/route-pois/{id}/
    更新路线关联上：站点备注(stop_note)、路段备注(segment_note)
    """

    queryset = RoutePOI.objects.select_related('route', 'poi').all()
    serializer_class = RoutePOINotesUpdateSerializer
    http_method_names = ['patch', 'head', 'options']

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(RoutePOISerializer(instance).data)


class RouteViewSet(viewsets.ModelViewSet):
    """
    Route ViewSet - provides CRUD operations for Routes.

    list: GET /api/v1/routes/
    create: POST /api/v1/routes/
    retrieve: GET /api/v1/routes/{id}/
    update: PUT /api/v1/routes/{id}/
    destroy: DELETE /api/v1/routes/{id}/
    connect: POST /api/v1/routes/{id}/connect/
    """
    queryset = Route.objects.all()

    def get_serializer_class(self):
        if self.action == 'create':
            return RouteCreateSerializer
        return RouteSerializer

    def get_queryset(self):
        queryset = Route.objects.all()

        trip_id = self.request.query_params.get('trip_id', None)
        if trip_id:
            queryset = queryset.filter(trip_id=trip_id)

        day_number = self.request.query_params.get('day_number', None)
        if day_number:
            queryset = queryset.filter(day_number=day_number)

        return queryset.prefetch_related('route_pois__poi')

    @action(detail=True, methods=['post'])
    def connect(self, request, pk=None):
        """
        Connect POIs to a route.
        POST /api/v1/routes/{id}/connect/
        {
            "poi_ids": ["uuid1", "uuid2", "uuid3"],
            "order": [0, 1, 2]  // optional, defaults to sequential
        }
        """
        route = self.get_object()
        serializer = RouteConnectSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {'error': {'code': 'VALIDATION_ERROR', 'message': 'Invalid data', 'details': serializer.errors}},
                status=status.HTTP_400_BAD_REQUEST
            )

        poi_ids = serializer.validated_data['poi_ids']
        order = serializer.validated_data.get('order') or list(range(len(poi_ids)))

        try:
            pois_list = list(POI.objects.filter(id__in=poi_ids))
            if len(pois_list) != len(poi_ids):
                return Response(
                    {'error': {'code': 'NOT_FOUND', 'message': 'One or more POIs not found'}},
                    status=status.HTTP_404_NOT_FOUND
                )

            poi_map = {poi.id: poi for poi in pois_list}

            with transaction.atomic():
                RoutePOI.objects.filter(route=route).delete()

                for idx, poi_id in enumerate(poi_ids):
                    poi = poi_map.get(poi_id)
                    if not poi:
                        raise ValueError(f"POI {poi_id} not found")
                    RoutePOI.objects.create(
                        route=route,
                        poi=poi,
                        order_index=order[idx]
                    )

            route.refresh_from_db()
            response_serializer = RouteSerializer(route)
            return Response({
                'route_id': str(route.id),
                'pois': response_serializer.data['pois'],
                'message': 'Route updated'
            })

        except Exception as e:
            return Response(
                {'error': {'code': 'INTERNAL_ERROR', 'message': str(e)}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
