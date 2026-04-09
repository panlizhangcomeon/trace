"""
Trip serializers.
"""
from rest_framework import serializers
from .models import Trip
from apps.routes.serializers import RouteSerializer


class TripSerializer(serializers.ModelSerializer):
    routes = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = ['id', 'name', 'destination', 'start_date', 'routes', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_routes(self, obj):
        routes = obj.routes.select_related().prefetch_related('route_pois__poi').order_by('day_number', 'order_index')
        return RouteSerializer(routes, many=True).data


class TripCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = ['id', 'name', 'destination', 'start_date', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_start_date(self, value):
        from datetime import date
        if value and value < date.today():
            raise serializers.ValidationError('开始日期必须是今天或未来日期')
        return value


class SmartTripDraftRequestSerializer(serializers.Serializer):
    user_text = serializers.CharField(min_length=1, max_length=8000)
    locale = serializers.CharField(max_length=32, required=False, default='zh-CN', allow_blank=True)


class SmartTripCommitTripMetaSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, allow_null=True, required=False, allow_blank=True)
    destination = serializers.CharField(max_length=255, allow_null=True, required=False, allow_blank=True)
    start_date = serializers.DateField(allow_null=True, required=False)


class SmartTripCommitRequestSerializer(serializers.Serializer):
    draft = serializers.JSONField()
    trip = SmartTripCommitTripMetaSerializer(required=False)
