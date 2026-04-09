from django.contrib import admin
from .models import Route, RoutePOI


class RoutePOIInline(admin.TabularInline):
    model = RoutePOI
    extra = 1


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ['name', 'trip', 'day_number', 'color', 'created_at']
    list_filter = ['day_number', 'trip']
    inlines = [RoutePOIInline]
