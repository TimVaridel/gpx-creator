export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  name?: string;
  elevation?: number;
  direct?: boolean; // segment depuis le point précédent = ligne droite
}

export type RoutingProfile = 'driving-car' | 'cycling-regular' | 'foot-walking';

export interface Route {
  id: string;
  name: string;
  waypoints: Waypoint[];
  totalDistance?: number;
  totalElevation?: number;
  createdAt: Date;
  profile: RoutingProfile;
  routeGeometry?: [number, number][];
  duration?: number;
}

export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  name?: string;
  elevation?: number;
  direct?: boolean;
  locality?: string; // "1131 Tolochenaz" — via géocodage inverse
}

export type DrawingMode = 'idle' | 'drawing' | 'editing';
