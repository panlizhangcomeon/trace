"""
Trip models.
"""
import uuid
from django.db import models
from django.core.exceptions import ValidationError
from datetime import date


class Trip(models.Model):
    """
    Trip - 行程
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, null=True, blank=True)
    destination = models.CharField(max_length=255, null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'trips'
        ordering = ['-created_at']

    def __str__(self):
        return self.name or f"Trip {self.id}"

    def clean(self):
        if self.start_date and self.start_date < date.today():
            raise ValidationError({'start_date': '开始日期必须是今天或未来日期'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
