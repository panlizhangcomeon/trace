"""
Unit tests for POI models.
"""
import pytest
from apps.pois.models import POI
from django.core.exceptions import ValidationError


@pytest.mark.django_db
class TestPOIModel:
    """Test POI model validation and behavior."""

    def test_poi_creation_valid(self):
        """Test creating a valid POI."""
        poi = POI.objects.create(
            latitude=25.0968,
            longitude=102.8463,
            name='大理古城',
            type='attraction',
            tags=['local_secret']
        )
        assert poi.id is not None
        assert poi.name == '大理古城'
        assert poi.type == 'attraction'
        assert 'local_secret' in poi.tags

    def test_poi_latitude_validation(self):
        """Test latitude must be between -90 and 90."""
        poi = POI(
            latitude=100.0,  # Invalid
            longitude=102.0,
            name='Test',
            type='attraction'
        )
        with pytest.raises(ValidationError) as exc_info:
            poi.clean()
        assert 'latitude' in exc_info.value.message_dict

    def test_poi_longitude_validation(self):
        """Test longitude must be between -180 and 180."""
        poi = POI(
            latitude=25.0,
            longitude=200.0,  # Invalid
            name='Test',
            type='attraction'
        )
        with pytest.raises(ValidationError) as exc_info:
            poi.clean()
        assert 'longitude' in exc_info.value.message_dict

    def test_poi_invalid_tags(self):
        """Test that invalid tags are rejected."""
        poi = POI(
            latitude=25.0,
            longitude=102.0,
            name='Test',
            type='attraction',
            tags=['invalid_tag']
        )
        with pytest.raises(ValidationError) as exc_info:
            poi.clean()
        assert 'tags' in exc_info.value.message_dict

    def test_poi_valid_types(self):
        """Test all valid POI types."""
        valid_types = ['attraction', 'food', 'accommodation', 'checkin', 'supply']
        for poi_type in valid_types:
            poi = POI.objects.create(
                latitude=25.0,
                longitude=102.0,
                name=f'Test {poi_type}',
                type=poi_type
            )
            assert poi.type == poi_type
