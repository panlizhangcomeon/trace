from django.contrib import admin
from .models import Trip


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ['name', 'destination', 'start_date', 'created_at']
    list_filter = ['destination', 'start_date']
    search_fields = ['name', 'destination']
