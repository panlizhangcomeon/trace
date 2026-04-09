"""
POI views.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import POI
from .serializers import POISerializer, POICreateSerializer, POISearchSerializer
from services.poi_external_search import search_external_places


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
        Search for real-world places.
        GET /api/v1/pois/search/?search=故宫&region=北京
        GET /api/v1/pois/search/?search=Eiffel+Tower&geo_scope=international&country=fr

        - geo_scope=domestic (default): Baidu Maps POI API.
        - geo_scope=international: public Nominatim (optional `country` = ISO 3166-1 alpha-2).

        Duplicate queries are cached; Nominatim calls are rate-limited server-side.
        """
        query = request.query_params.get('search', '').strip()
        if not query:
            # 空搜索返回空结果，不报错
            return Response({'count': 0, 'results': [], 'provider': None, 'cached': False})

        region = request.query_params.get('region', '全国')
        limit = int(request.query_params.get('limit', 20))
        geo_scope = request.query_params.get('geo_scope')
        country = request.query_params.get('country', '').strip().lower() or None

        formatted_results, provider, cached = search_external_places(
            query,
            geo_scope=geo_scope,
            region=region,
            limit=limit,
            country_codes=country,
        )

        return Response({
            'count': len(formatted_results),
            'results': formatted_results,
            'provider': provider,
            'cached': cached,
        })

    @action(detail=False, methods=['get'], url_path='geosearch')
    def geosearch(self, request):
        """
        Search for places (alias of search semantics with `q` param).
        GET /api/v1/pois/geosearch/?q=前海中心&region=深圳
        GET /api/v1/pois/geosearch/?q=Colosseum&geo_scope=international&country=it
        """
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({'error': 'Query parameter "q" is required'}, status=status.HTTP_400_BAD_REQUEST)

        limit = int(request.query_params.get('limit', 10))
        region = request.query_params.get('region', '全国')
        geo_scope = request.query_params.get('geo_scope')
        country = request.query_params.get('country', '').strip().lower() or None

        formatted_results, provider, cached = search_external_places(
            query,
            geo_scope=geo_scope,
            region=region,
            limit=limit,
            country_codes=country,
        )

        return Response({
            'count': len(formatted_results),
            'results': formatted_results,
            'provider': provider,
            'cached': cached,
        })
