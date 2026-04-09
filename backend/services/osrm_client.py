"""
OSRM client service for route calculation.
"""
import requests
import logging
from typing import List, Optional, Dict, Any
from django.conf import settings

logger = logging.getLogger(__name__)


class OSRMService:
    """
    Client for OSRM (OpenStreetMap Routing Machine) API.

    Used for calculating routes between POIs and getting traffic information.
    """

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url or settings.OSRM_URL
        self.timeout = 10

    def get_route(
        self,
        coordinates: List[List[float]],
        profile: str = 'driving'
    ) -> Optional[Dict[str, Any]]:
        """
        Get route between coordinates.

        Args:
            coordinates: List of [longitude, latitude] pairs
            profile: Routing profile (driving, cycling, walking)

        Returns:
            Dict with distance (meters), duration (seconds), and geometry
        """
        if len(coordinates) < 2:
            logger.warning("At least 2 coordinates required for routing")
            return None

        coords_str = ';'.join([f"{lng},{lat}" for lng, lat in coordinates])
        url = f"{self.base_url}/route/v1/{profile}/{coords_str}"

        try:
            response = requests.get(
                url,
                params={
                    'overview': 'full',
                    'geometries': 'polyline',
                    'steps': 'false',
                },
                timeout=self.timeout
            )
            response.raise_for_status()
            data = response.json()

            if data.get('code') != 'Ok':
                logger.error(f"OSRM error: {data.get('message', 'Unknown error')}")
                return None

            route = data['routes'][0]
            return {
                'distance': route['distance'],
                'duration': route['duration'],
                'geometry': route['geometry'],
            }

        except requests.Timeout:
            logger.error(f"OSRM request timed out after {self.timeout}s")
            return None
        except requests.RequestException as e:
            logger.error(f"OSRM request failed: {e}")
            return None

    def get_route_for_mode(
        self,
        coordinates: List[List[float]],
        mode: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get route for specific transport mode.

        Args:
            coordinates: List of [longitude, latitude] pairs
            mode: Transport mode (bus, subway, taxi, walk, bicycle, etc.)

        Returns:
            Dict with route information or None
        """
        profile_map = {
            'bus': 'driving',
            'subway': 'driving',
            'taxi': 'driving',
            'walk': 'foot',
            'bicycle': 'cycling',
            'motorcycle': 'driving',
            'ferry': 'driving',
            'shuttle': 'driving',
            'hiking': 'foot',
        }

        profile = profile_map.get(mode, 'driving')
        return self.get_route(coordinates, profile)

    def is_route_available(
        self,
        from_coord: List[float],
        to_coord: List[float],
        mode: str = 'driving'
    ) -> bool:
        """
        Check if a route is available between two points.

        Args:
            from_coord: [longitude, latitude] of start
            to_coord: [longitude, latitude] of end
            mode: Transport mode

        Returns:
            True if route exists
        """
        result = self.get_route_for_mode([from_coord, to_coord], mode)
        return result is not None
