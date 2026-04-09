"""
Route URL configuration.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RouteViewSet, RoutePOINotesViewSet

router = DefaultRouter()
router.register(r'route-pois', RoutePOINotesViewSet, basename='route-poi')
router.register(r'', RouteViewSet, basename='route')

urlpatterns = [
    path('', include(router.urls)),
]
