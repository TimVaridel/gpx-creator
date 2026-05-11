export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  name?: string;
  elevation?: number;
}

export interface Route {
  id: string;
  name: string;
  waypoints: Waypoint[];
  totalDistance?: number;
  totalElevation?: number;
}

export type DrawingMode = 'idle' | 'drawing' | 'editing';
