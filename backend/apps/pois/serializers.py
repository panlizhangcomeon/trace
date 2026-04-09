"""
POI serializers.
"""
from rest_framework import serializers
from .models import POI


class POISerializer(serializers.ModelSerializer):
    class Meta:
        model = POI
        fields = ['id', 'latitude', 'longitude', 'name', 'type', 'icon', 'note', 'tags', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_tags(self, value):
        valid_tags = POI.VALID_TAGS
        invalid_tags = set(value) - set(valid_tags)
        if invalid_tags:
            raise serializers.ValidationError(f'无效的标签: {list(invalid_tags)}')
        return value

    def validate_latitude(self, value):
        if value < -90 or value > 90:
            raise serializers.ValidationError('纬度必须在 -90 到 90 之间')
        return value

    def validate_longitude(self, value):
        if value < -180 or value > 180:
            raise serializers.ValidationError('经度必须在 -180 到 180 之间')
        return value


class POICreateSerializer(POISerializer):
    class Meta(POISerializer.Meta):
        fields = ['id', 'latitude', 'longitude', 'name', 'type', 'icon', 'note', 'tags', 'created_at']


class POISearchSerializer(serializers.Serializer):
    search = serializers.CharField(required=False, allow_blank=True)
    tags = serializers.CharField(required=False, allow_blank=True)
    type = serializers.ChoiceField(choices=POI.TYPE_CHOICES, required=False)
    latitude = serializers.DecimalField(max_digits=10, decimal_places=8, required=False)
    longitude = serializers.DecimalField(max_digits=11, decimal_places=8, required=False)
    radius = serializers.IntegerField(required=False, min_value=0)
