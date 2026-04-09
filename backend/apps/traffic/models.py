"""
Traffic models.
"""
import uuid
from django.db import models
from apps.pois.models import POI


class TrafficOption(models.Model):
    """
    TrafficOption - 交通方案
    """
    MODE_CHOICES = [
        ('bus', '公交'),
        ('subway', '地铁'),
        ('taxi', '出租车'),
        ('walk', '步行'),
        ('bicycle', '自行车'),
        ('motorcycle', '摩托车'),
        ('ferry', '渡轮'),
        ('shuttle', '班车'),
        ('hiking', '徒步'),
    ]

    COUPLE_FRIENDLY_TAGS = [
        'double_seat',
        'smooth_route',
        'safe_night',
        'scenic_route',
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    from_poi = models.ForeignKey(
        POI,
        on_delete=models.CASCADE,
        related_name='departure_traffic'
    )
    to_poi = models.ForeignKey(
        POI,
        on_delete=models.CASCADE,
        related_name='arrival_traffic'
    )
    mode = models.CharField(max_length=20, choices=MODE_CHOICES)
    duration_minutes = models.IntegerField()
    cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    operating_hours = models.CharField(max_length=100, null=True, blank=True)
    couple_friendly_tags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'traffic_options'
        ordering = ['duration_minutes']
        indexes = [
            models.Index(fields=['from_poi', 'to_poi']),
            models.Index(fields=['mode']),
        ]

    def __str__(self):
        return f"{self.from_poi.name} → {self.to_poi.name} ({self.get_mode_display()})"

    def clean(self):
        from django.core.exceptions import ValidationError
        invalid_tags = set(self.couple_friendly_tags) - set(self.COUPLE_FRIENDLY_TAGS)
        if invalid_tags:
            raise ValidationError({'couple_friendly_tags': f'无效的情侣友好标签: {invalid_tags}'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
