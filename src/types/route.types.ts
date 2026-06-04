/** ── Modélisation unifiée : Waypoint + Groups (source de vérité unique) ─── */

// ════════════════════════════════════════════════════════════
// TYPES DE BASE
// ════════════════════════════════════════════════════════════

export interface Waypoint {
  id: string;                              // unique: uuid ou 'wp-1'
  lat: number;                             // latitude WGS84
  lng: number;                             // longitude WGS84
  name?: string;                           // nom du lieu
  elevation?: number;                      // altitude (m)
  direct?: boolean;                        // true = segment en ligne droite depuis précédent
  locality?: string;                       // via géocodage inverse
}

export type RoutingProfile = 'driving-car' | 'cycling-regular' | 'foot-walking';

export interface Route {
  id: string;
  name: string;
  waypoints:        Waypoint[];
  totalDistance?:   number;                // Σ dist(segment[i]) pour i = 1..N-1  
                                           // NB: ne comprend PAS duration manuel si specified 
  totalElevation?:  number;                // gain - descente net en mètre
  duration?:         number;                // durée OSRM totale en secondes
  createdAt:        Date;                  // timestamp de création/import
  profile:          RoutingProfile;        // 'cycling' par défaut
  routeGeometry?:   [number, number][];    // polyline OSRM du tracé optimisé
}

// ════════════════════════════════════════════════════════════  
// GROUPES (sont dérivés des waypoints + persistants dans state)
// ════════════════════════════════════════════════════════════

/** Group = plage continue de segments entre 2 waypoints */
export interface Group {
  id: string;

  /** index du waypoint START (inclus) */
  fromWpIndex: number;

  /** index du waypoint END (inclus). Range = [fromWpIndex, toWpIndex] */
  toWpIndex: number;

  /** Vitesse km/h pour ce groupe (default 60) */
  speedKmh: number;

  /** Durée manuelle en heures — si null, auto-calculée depuis speedKmh + distance */
  manualDurationH: number | null;

  /** Pause en heures (pour le planning temporel) */
  pauseH: number;

  /** Remarque textuelle */
  remark: string;

  /** Groupe déplié (waypoints internes visibles) */
  expanded: boolean;
}

/** PlanningRow pour export = un groupe + horaires calculés */
export interface PlanningRow {
  group: Group;
  fromLabel: string;
  toLabel: string;
  distKm: number;
  durationH: number;
  beginDate: string;
  beginTime: string;
  endDate: string;
  endTime: string;
}

export type DrawingMode   = 'idle'      | 'drawing'        | 'editing';
