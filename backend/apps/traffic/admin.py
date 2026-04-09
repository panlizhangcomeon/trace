from django.contrib import admin
from .models import TrafficOption


@admin.register(TrafficOption)
class TrafficOptionAdmin(admin.ModelAdmin):
    list_display = ['from_poi', 'to_poi', 'mode', 'duration_minutes', 'cost', 'created_at']
    list_filter = ['mode', 'couple_friendly_tags']
    search_fields = ['from_poi__name', 'to_poi__name']
