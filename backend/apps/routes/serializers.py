"""
Route serializers.
"""
from rest_framework import serializers
from .models import Route, RoutePOI
from apps.pois.serializers import POISerializer


class RoutePOISerializer(serializers.ModelSerializer):
    poi = POISerializer(read_only=True)

    class Meta:
        model = RoutePOI
        fields = [
            'id',
            'poi',
            'order_index',
            'stop_note',
            'segment_note',
            'created_at',
        ]


class RoutePOINotesUpdateSerializer(serializers.ModelSerializer):
    """PATCH 仅更新站点备注与路段备注"""

    class Meta:
        model = RoutePOI
        fields = ['stop_note', 'segment_note']


class RouteSerializer(serializers.ModelSerializer):
    pois = serializers.SerializerMethodField()

    class Meta:
        model = Route
        fields = ['id', 'trip', 'name', 'color', 'day_number', 'order_index', 'pois', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_pois(self, obj):
        route_pois = obj.route_pois.select_related('poi').order_by('order_index')
        return RoutePOISerializer(route_pois, many=True).data


class RouteCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Route
        fields = ['id', 'trip', 'name', 'color', 'day_number', 'order_index', 'created_at']
        read_only_fields = ['id', 'created_at']


class RouteConnectSerializer(serializers.Serializer):
    poi_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=True,
    )
    order = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True
    )

    def validate(self, data):
        poi_ids = data.get('poi_ids', [])
        order = data.get('order', [])

        if len(poi_ids) != len(set(poi_ids)):
            raise serializers.ValidationError('poi_ids contains duplicates')

        if order and len(order) != len(poi_ids):
            raise serializers.ValidationError('order length must match poi_ids length')

        if order and len(order) != len(set(order)):
            raise serializers.ValidationError('order contains duplicates')

        return data
