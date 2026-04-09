from django.contrib import admin
from .models import POI


@admin.register(POI)
class POIAdmin(admin.ModelAdmin):
    list_display = ['name', 'type', 'latitude', 'longitude', 'created_at']
    list_filter = ['type', 'tags']
    search_fields = ['name', 'note']
