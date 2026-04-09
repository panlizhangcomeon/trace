"""
Route models.
"""
import uuid
from django.db import models
from apps.pois.models import POI


class Route(models.Model):
    """
    Route - 路线
    """
    DEFAULT_COLOR = '#FF6B81'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip = models.ForeignKey(
        'trips.Trip',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='routes'
    )
    name = models.CharField(max_length=255, null=True, blank=True)
    color = models.CharField(max_length=7, default=DEFAULT_COLOR)
    day_number = models.IntegerField(default=1)
    order_index = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'routes'
        ordering = ['day_number', 'order_index']
        indexes = [
            models.Index(fields=['trip', 'day_number']),
        ]

    def __str__(self):
        return self.name or f"Route {self.id}"


class RoutePOI(models.Model):
    """
    RoutePOI - 路线与POI的关联表 (junction table)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name='route_pois')
    poi = models.ForeignKey(POI, on_delete=models.CASCADE, related_name='poi_routes')
    order_index = models.IntegerField()
    stop_note = models.TextField(
        null=True,
        blank=True,
        help_text='本站在当日路线中的备注，如到达/停留时间',
    )
    segment_note = models.TextField(
        null=True,
        blank=True,
        help_text='从上一站到本站的交通方式或路段备注（第一站通常为空）',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'route_pois'
        ordering = ['order_index']
        unique_together = [['route', 'order_index']]
        indexes = [
            models.Index(fields=['route', 'order_index']),
        ]

    def __str__(self):
        return f"{self.route.name} - {self.poi.name} (order: {self.order_index})"
