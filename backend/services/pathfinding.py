"""
Route chaining service - handles automatic route connection between days.
"""
import logging
from typing import List, Optional
from apps.routes.models import Route, RoutePOI
from apps.pois.models import POI

logger = logging.getLogger(__name__)


class RouteChainingService:
    """
    Service for handling route chaining between consecutive days.

    When a trip has multiple days, the service ensures seamless connection
    between routes by linking the end of one day's route to the start of
    the next day's route.
    """

    @staticmethod
    def get_last_poi_of_day(trip_id: str, day_number: int) -> Optional[POI]:
        """
        Get the last POI of a specific day.

        Args:
            trip_id: The trip UUID
            day_number: The day number

        Returns:
            The last POI or None if no routes exist for that day
        """
        last_route = (
            Route.objects
            .filter(trip_id=trip_id, day_number=day_number)
            .prefetch_related('route_pois__poi')
            .order_by('-order_index')
            .first()
        )

        if not last_route:
            return None

        last_routepoi = (
            last_route.route_pois
            .select_related('poi')
            .order_by('-order_index')
            .first()
        )

        return last_routepoi.poi if last_routepoi else None

    @staticmethod
    def get_first_poi_of_day(trip_id: str, day_number: int) -> Optional[POI]:
        """
        Get the first POI of a specific day.

        Args:
            trip_id: The trip UUID
            day_number: The day number

        Returns:
            The first POI or None if no routes exist for that day
        """
        first_route = (
            Route.objects
            .filter(trip_id=trip_id, day_number=day_number)
            .prefetch_related('route_pois__poi')
            .order_by('order_index')
            .first()
        )

        if not first_route:
            return None

        first_routepoi = (
            first_route.route_pois
            .select_related('poi')
            .order_by('order_index')
            .first()
        )

        return first_routepoi.poi if first_routepoi else None

    @staticmethod
    def calculate_connection_distance(from_poi: POI, to_poi: POI) -> float:
        """
        Calculate the distance between two POIs in meters.

        Uses Haversine formula for accurate distance calculation.

        Args:
            from_poi: Starting POI
            to_poi: Ending POI

        Returns:
            Distance in meters
        """
        import math

        R = 6371000  # Earth's radius in meters

        lat1 = float(from_poi.latitude)
        lon1 = float(from_poi.longitude)
        lat2 = float(to_poi.latitude)
        lon2 = float(to_poi.longitude)

        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = (
            math.sin(delta_phi / 2) ** 2 +
            math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c

    @staticmethod
    def is_seamless_connection(from_poi: POI, to_poi: POI, threshold_meters: float = 50.0) -> bool:
        """
        Check if two POIs are close enough for seamless connection.

        Args:
            from_poi: Ending POI of previous day
            to_poi: Starting POI of next day
            threshold_meters: Maximum distance for seamless connection (default 50m)

        Returns:
            True if connection is seamless
        """
        distance = RouteChainingService.calculate_connection_distance(from_poi, to_poi)
        return distance <= threshold_meters

    @staticmethod
    def suggest_connection_poi(current_last_poi: POI, day_routes: List[Route]) -> Optional[POI]:
        """
        Suggest a POI for connecting current day's end to next day's start.

        This is used when there's no direct seamless connection between days.
        It looks for nearby POIs in the next day's routes that could serve as
        connection points.

        Args:
            current_last_poi: The last POI of the current day
            day_routes: Routes of the next day

        Returns:
            Suggested POI or None
        """
        all_pois = []
        for route in day_routes:
            route_pois = route.route_pois.select_related('poi').all()
            for routepoi in route_pois:
                distance = RouteChainingService.calculate_connection_distance(
                    current_last_poi, routepoi.poi
                )
                all_pois.append((routepoi.poi, distance))

        if not all_pois:
            return None

        # Sort by distance and return the nearest
        all_pois.sort(key=lambda x: x[1])
        nearest_poi, distance = all_pois[0]

        # Only suggest if within reasonable distance (500m)
        if distance <= 500:
            return nearest_poi

        return None
