import type { Waypoint } from '../types/route.types';

const OSRM_URL = 'https://router.project-osrm.org/route/v1';

export type RoutingProfile = 'driving-car' | 'cycling-regular' | 'foot-walking';

export interface RouteGeometry {
  coordinates: [number, number][]; // [lng, lat]
  distance: number; // en mètres
  duration: number; // en secondes
}

const profileMap: Record<RoutingProfile, string> = {
  'driving-car':      'driving',
  'cycling-regular':  'bike',
  'foot-walking':     'foot',
};

export async function getRoute(
  waypoints: Waypoint[],
  profile: RoutingProfile = 'driving-car'
): Promise<RouteGeometry | null> {
  if (waypoints.length < 2) return null;

  const osrmProfile = profileMap[profile];
  const coords = waypoints.map(wp => `${wp.lng},${wp.lat}`).join(';');
  const url = `${OSRM_URL}/${osrmProfile}/${coords}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur OSRM:', errorText);
      return null;
    }

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes?.[0]) {
      console.error('❌ OSRM pas de route:', data.code);
      return null;
    }

    const route = data.routes[0];

    return {
      coordinates: route.geometry.coordinates,
      distance:    route.distance,
      duration:    route.duration,
    };
  } catch (error) {
    console.error('Erreur routing:', error);
    return null;
  }
}
