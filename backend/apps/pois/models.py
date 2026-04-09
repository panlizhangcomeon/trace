"""
POI (兴趣点) models.
"""
import uuid
from django.db import models


class POI(models.Model):
    """
    POI - 兴趣点/标点
    """
    TYPE_CHOICES = [
        ('attraction', '景点'),
        ('food', '美食'),
        ('accommodation', '住宿'),
        ('checkin', '打卡'),
        ('supply', '补给'),
    ]

    VALID_TAGS = [
        'local_secret',
        'non_commercial',
        'couple_friendly',
        'hiking',
        'scenic_view',
        'popular',
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    latitude = models.DecimalField(max_digits=10, decimal_places=8)
    longitude = models.DecimalField(max_digits=11, decimal_places=8)
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    icon = models.CharField(max_length=100, null=True, blank=True)
    note = models.TextField(null=True, blank=True)
    tags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pois'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['type']),
            models.Index(fields=['latitude', 'longitude']),
        ]

    def __str__(self):
        return f"{self.name} ({self.latitude}, {self.longitude})"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.latitude < -90 or self.latitude > 90:
            raise ValidationError({'latitude': '纬度必须在 -90 到 90 之间'})
        if self.longitude < -180 or self.longitude > 180:
            raise ValidationError({'longitude': '经度必须在 -180 到 180 之间'})
        invalid_tags = set(self.tags) - set(self.VALID_TAGS)
        if invalid_tags:
            raise ValidationError({'tags': f'无效的标签: {invalid_tags}'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
