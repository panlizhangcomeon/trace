"""
POI views.
"""
import math
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from django.conf import settings

from .models import POI
from .serializers import POISerializer, POICreateSerializer, POISearchSerializer
from services.baidu_poi_service import BaiduPOIService


class POIViewSet(viewsets.ModelViewSet):
    """
    POI ViewSet - provides CRUD operations for POIs.

    list: GET /api/v1/pois/
    create: POST /api/v1/pois/
    retrieve: GET /api/v1/pois/{id}/
    update: PUT /api/v1/pois/{id}/
    destroy: DELETE /api/v1/pois/{id}/
    search: GET /api/v1/pois/search/?search=xxx&tags=yyy
    """
    queryset = POI.objects.all()
    serializer_class = POISerializer

    def get_serializer_class(self):
        if self.action == 'create':
            return POICreateSerializer
        return POISerializer

    def get_queryset(self):
        queryset = POI.objects.all()

        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(name__icontains=search)

        tags = self.request.query_params.get('tags', None)
        if tags:
            tag_list = tags.split(',')
            for tag in tag_list:
                queryset = queryset.filter(tags__contains=tag.strip())

        poi_type = self.request.query_params.get('type', None)
        if poi_type:
            queryset = queryset.filter(type=poi_type)

        return queryset

    @action(detail=False, methods=['get'])
    def search(self, request):
        """
        Search for real-world places using Baidu Maps POI API.
        GET /api/v1/pois/search/?search=故宫&region=北京

        Returns real-world places from Baidu Maps.
        """
        query = request.query_params.get('search', '').strip()
        if not query:
            # 空搜索返回空结果，不报错
            return Response({'count': 0, 'results': []})

        region = request.query_params.get('region', '全国')
        limit = int(request.query_params.get('limit', 20))

        baidu_service = BaiduPOIService(ak=settings.BAIDU_MAP_AK)
        results = baidu_service.search(
            query=query,
            region=region,
            limit=min(limit, 50),
        )

        formatted_results = [
            baidu_service.format_poi_result(r) for r in results
        ]

        return Response({
            'count': len(formatted_results),
            'results': formatted_results,
        })

    @action(detail=False, methods=['get'], url_path='geosearch')
    def geosearch(self, request):
        """
        Search for places using Baidu Maps POI API.
        GET /api/v1/pois/geosearch/?q=前海中心&region=深圳

        Returns real-world places from Baidu Maps, not just local database POIs.
        """
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({'error': 'Query parameter "q" is required'}, status=status.HTTP_400_BAD_REQUEST)

        limit = int(request.query_params.get('limit', 10))
        region = request.query_params.get('region', '全国')

        baidu_service = BaiduPOIService(ak=settings.BAIDU_MAP_AK)
        results = baidu_service.search(
            query=query,
            region=region,
            limit=min(limit, 50),
        )

        formatted_results = [
            baidu_service.format_poi_result(r) for r in results
        ]

        return Response({
            'count': len(formatted_results),
            'results': formatted_results,
        })
