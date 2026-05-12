import type { Waypoint } from '../types/route.types';

const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY;
const ORS_URL = 'https://api.openrouteservice.org/v2/directions';

export type RoutingProfile = 'driving-car' | 'cycling-regular' | 'foot-walking';

export interface RouteGeometry {
  coordinates: [number, number][]; // [lng, lat]
  distance: number; // en mètres
  duration: number; // en secondes
}

export async function getRoute(
  waypoints: Waypoint[],
  profile: RoutingProfile = 'driving-car'
): Promise<RouteGeometry | null> {
  if (waypoints.length < 2) return null;

  // ── DEBUG ──────────────────────────────────────────────
  console.log('🔑 API Key présente ?', !!ORS_API_KEY);
  console.log('🔑 API Key (10 premiers car.):', ORS_API_KEY?.substring(0, 10));
  console.log('🔑 Longueur clé:', ORS_API_KEY?.length);
  console.log('📍 Waypoints envoyés:', waypoints);
  // ───────────────────────────────────────────────────────

  const coordinates = waypoints.map(wp => [wp.lng, wp.lat]);

  try {
    const response = await fetch(`${ORS_URL}/${profile}/geojson`, {
      method: 'POST',
      headers: {
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ coordinates }),
    });

    console.log('📡 Status réponse:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur ORS:', errorText);
      return null;
    }

    const data = await response.json();
    const feature = data.features[0];

    return {
      coordinates: feature.geometry.coordinates,
      distance: feature.properties.summary.distance,
      duration: feature.properties.summary.duration,
    };
  } catch (error) {
    console.error('Erreur routing:', error);
    return null;
  }
}
