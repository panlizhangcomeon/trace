"""
Unit tests for couple-friendly filtering.
"""
import pytest
from apps.pois.models import POI
from apps.traffic.models import TrafficOption


@pytest.mark.django_db
class TestCoupleFriendlyFiltering:
    """Test couple-friendly traffic filtering."""

    def test_filter_by_couple_friendly_tags(self):
        """Test filtering traffic options by couple-friendly tags."""
        poi1 = POI.objects.create(
            latitude=25.0, longitude=102.0,
            name='Start', type='attraction'
        )
        poi2 = POI.objects.create(
            latitude=25.1, longitude=102.1,
            name='End', type='attraction'
        )

        TrafficOption.objects.create(
            from_poi=poi1, to_poi=poi2,
            mode='bicycle',
            duration_minutes=45,
            cost=30.00,
            couple_friendly_tags=['double_seat', 'smooth_route']
        )
        TrafficOption.objects.create(
            from_poi=poi1, to_poi=poi2,
            mode='bus',
            duration_minutes=30,
            cost=5.00,
            couple_friendly_tags=[]
        )

        couple_options = TrafficOption.objects.filter(
            from_poi=poi1,
            to_poi=poi2,
            couple_friendly_tags__len__gt=0
        )

        assert couple_options.count() == 1
        assert couple_options.first().mode == 'bicycle'
        assert 'double_seat' in couple_options.first().couple_friendly_tags
