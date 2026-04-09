"""
Traffic serializers.
"""
from rest_framework import serializers
from .models import TrafficOption


class TrafficOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrafficOption
        fields = [
            'id', 'from_poi', 'to_poi', 'mode', 'duration_minutes',
            'cost', 'operating_hours', 'couple_friendly_tags', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def validate_couple_friendly_tags(self, value):
        valid_tags = TrafficOption.COUPLE_FRIENDLY_TAGS
        invalid_tags = set(value) - set(valid_tags)
        if invalid_tags:
            raise serializers.ValidationError(f'无效的情侣友好标签: {list(invalid_tags)}')
        return value


class TrafficOptionsResponseSerializer(serializers.Serializer):
    from_poi_id = serializers.UUIDField()
    to_poi_id = serializers.UUIDField()
    options = TrafficOptionSerializer(many=True)


class RouteTrafficRequestSerializer(serializers.Serializer):
    route_id = serializers.UUIDField()
