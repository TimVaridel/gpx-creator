import { useState, useCallback, useEffect, useRef } from 'react';
import type { Waypoint, Route, RoutingProfile } from '../types/route.types';
import { getRoute } from '../services/routingService';
import { reverseGeocode } from '../services/geocoding';

const generateId = () => Math.random().toString(36).substring(2, 9);

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeGeometryLength(geometry: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < geometry.length; i++) {
    total += haversineMeters(
      geometry[i - 1][0], geometry[i - 1][1],
      geometry[i][0],     geometry[i][1],
    );
  }
  return total;
}

async function enrichWithLocality(
  id: string,
  lat: number,
  lng: number,
  setRoute: React.Dispatch<React.SetStateAction<Route>>,
) {
  const locality = await reverseGeocode(lat, lng);
  if (!locality) return;
  setRoute(prev => ({
    ...prev,
    waypoints: prev.waypoints.map(wp =>
      wp.id === id ? { ...wp, locality } : wp,
    ),
  }));
}

export const useRoute = () => {
  const [route, setRoute] = useState<Route>({
    id: generateId(),
    name: 'Mon itinéraire',
    waypoints: [],
    totalDistance: 0,
    createdAt: new Date(),
    profile: 'driving-car',
  });

  const [isCalculating,    setIsCalculating]    = useState(false);
  const [autoCalculate,    setAutoCalculate]    = useState(true);
  const [segmentDistances, setSegmentDistances] = useState<number[]>([]);
  const [segmentDurations, setSegmentDurations] = useState<number[]>([]);

  const waypointsRef = useRef(route.waypoints);
  const profileRef   = useRef(route.profile);

  const calculateRoute = useCallback(async (
    waypoints: Waypoint[],
    profile: RoutingProfile,
  ) => {
    if (waypoints.length < 2) {
      setRoute(prev => ({
        ...prev,
        routeGeometry: undefined,
        totalDistance: 0,
        duration: 0,
      }));
      setSegmentDistances([]);
      setSegmentDurations([]);
      return;
    }

    setIsCalculating(true);

    const allSegments: [number, number][][] = [];
    const segDists: number[] = new Array(waypoints.length).fill(0);
    const segDurs:  number[] = new Array(waypoints.length).fill(0);
    let totalDistance = 0;
    let totalDuration = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to   = waypoints[i + 1];

      if (to.direct) {
        const d = haversineMeters(from.lat, from.lng, to.lat, to.lng);
        allSegments.push([[from.lat, from.lng], [to.lat, to.lng]]);
        totalDistance   += d;
        segDists[i + 1]  = d / 1000;
        // pas de durée OSRM pour un segment direct
      } else {
        const result = await getRoute([from, to], profile);
        if (result) {
          const seg: [number, number][] = result.coordinates.map(
            ([lng, lat]) => [lat, lng],
          );
          allSegments.push(seg);
          totalDistance   += result.distance;
          totalDuration   += result.duration;
          segDists[i + 1]  = result.distance / 1000;
          segDurs[i + 1]   = result.duration;
        }
      }
    }

    setIsCalculating(false);

    const geometry: [number, number][] = [];
    allSegments.forEach((seg, i) => {
      if (i === 0) geometry.push(...seg);
      else geometry.push(...seg.slice(1));
    });

    setRoute(prev => ({
      ...prev,
      routeGeometry: geometry,
      totalDistance,
      duration: totalDuration,
    }));
    setSegmentDistances(segDists);
    setSegmentDurations(segDurs);
  }, []);

  useEffect(() => {
    if (!autoCalculate) return;
    waypointsRef.current = route.waypoints;
    profileRef.current   = route.profile;

    // ✅ Appel dans une fonction async locale pour éviter le setState synchrone
    //    direct dans le corps de l'effet (règle react-hooks/set-state-in-effect)
    const run = async () => {
      await calculateRoute(route.waypoints, route.profile);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.waypoints, route.profile, autoCalculate]);

  const triggerCalculate = useCallback(() => {
    calculateRoute(route.waypoints, route.profile);
  }, [route.waypoints, route.profile, calculateRoute]);

  // ── Waypoints ────────────────────────────────────────────

  const addWaypoint = useCallback((lat: number, lng: number) => {
    const id = generateId();
    setRoute(prev => ({
      ...prev,
      waypoints: [
        ...prev.waypoints,
        { id, lat, lng, name: `Point ${prev.waypoints.length + 1}` },
      ],
    }));
    enrichWithLocality(id, lat, lng, setRoute);
  }, []);

  const insertWaypoint = useCallback((lat: number, lng: number, atIndex: number) => {
    const id = generateId();
    setRoute(prev => {
      const wp: Waypoint = { id, lat, lng, name: `Point ${prev.waypoints.length + 1}` };
      const wps = [...prev.waypoints];
      wps.splice(atIndex, 0, wp);
      return { ...prev, waypoints: wps };
    });
    enrichWithLocality(id, lat, lng, setRoute);
  }, []);

  const insertDirectWaypoint = useCallback((lat: number, lng: number, atIndex: number) => {
    const id = generateId();
    setRoute(prev => {
      const wp: Waypoint = {
        id, lat, lng,
        name: `Point ${prev.waypoints.length + 1}`,
        direct: true,
      };
      const wps = [...prev.waypoints];
      wps.splice(atIndex, 0, wp);
      return { ...prev, waypoints: wps, routeGeometry: undefined };
    });
    enrichWithLocality(id, lat, lng, setRoute);
  }, []);

  const removeWaypoint = useCallback((id: string) => {
    setRoute(prev => ({
      ...prev,
      waypoints: prev.waypoints.filter(wp => wp.id !== id),
    }));
    setSegmentDistances([]);
    setSegmentDurations([]);
  }, []);

  const updateWaypointPosition = useCallback((id: string, lat: number, lng: number) => {
    setRoute(prev => ({
      ...prev,
      waypoints: prev.waypoints.map(wp =>
        wp.id === id ? { ...wp, lat, lng } : wp,
      ),
    }));
    setSegmentDistances([]);
    setSegmentDurations([]);
    enrichWithLocality(id, lat, lng, setRoute);
  }, []);

  const moveWaypoint = useCallback((fromIndex: number, toIndex: number) => {
    setRoute(prev => {
      const wps = [...prev.waypoints];
      const [moved] = wps.splice(fromIndex, 1);
      wps.splice(toIndex, 0, moved);
      return { ...prev, waypoints: wps };
    });
    setSegmentDistances([]);
    setSegmentDurations([]);
  }, []);

  const setWaypoints = useCallback((newWps: Waypoint[]) => {
    setRoute(prev => ({ ...prev, waypoints: newWps }));
    setSegmentDistances([]);
    setSegmentDurations([]);
  }, []);

  const renameRoute = useCallback((name: string) => {
    setRoute(prev => ({ ...prev, name }));
  }, []);

  const clearRoute = useCallback(() => {
    setRoute(prev => ({ ...prev, waypoints: [], routeGeometry: undefined }));
    setSegmentDistances([]);
    setSegmentDurations([]);
  }, []);

  const clearGeometry = useCallback(() => {
    setRoute(prev => ({
      ...prev,
      routeGeometry: undefined,
      totalDistance: 0,
      duration: 0,
    }));
    setSegmentDistances([]);
    setSegmentDurations([]);
  }, []);

  const reverseRoute = useCallback(() => {
    setRoute(prev => ({
      ...prev,
      waypoints: [...prev.waypoints].reverse(),
      routeGeometry: undefined,
      totalDistance: 0,
      duration: 0,
    }));
    setSegmentDistances([]);
    setSegmentDurations([]);
  }, []);

  const setProfile = useCallback((profile: RoutingProfile) => {
    setRoute(prev => ({ ...prev, profile }));
  }, []);

  // ── Import ───────────────────────────────────────────────

  const importRoute = useCallback((
    name: string,
    rawWaypoints: { lat: number; lng: number; name?: string }[],
    geometry?: [number, number][],
  ) => {
    const waypoints: Waypoint[] = rawWaypoints.map((wp, i) => ({
      id:   generateId(),
      lat:  wp.lat,
      lng:  wp.lng,
      name: wp.name ?? `Point ${i + 1}`,
    }));

    setRoute({
      id:            generateId(),
      name,
      waypoints,
      routeGeometry: geometry,
      totalDistance: geometry ? computeGeometryLength(geometry) : 0,
      duration:      0,
      createdAt:     new Date(),
      profile:       'driving-car',
    });
    setSegmentDistances([]);
    setSegmentDurations([]);

    (async () => {
      for (const wp of waypoints) {
        await enrichWithLocality(wp.id, wp.lat, wp.lng, setRoute);
      }
    })();
  }, []);

  const replaceRoute = useCallback((
    data: {
      name: string;
      profile: RoutingProfile;
      waypoints: Waypoint[];
      routeGeometry?: [number, number][];
      totalDistance?: number;
      duration?: number;
    },
    savedPlaces?: { lat: number; lng: number; name: string }[],
  ) => {
    setRoute(prev => ({
      ...prev,
      name: data.name,
      profile: data.profile,
      waypoints: data.waypoints,
      routeGeometry: data.routeGeometry,
      totalDistance: data.totalDistance ?? 0,
      duration: data.duration ?? 0,
    }));
    setSegmentDistances([]);
    setSegmentDurations([]);

    (async () => {
      for (const wp of data.waypoints) {
        if (!wp.locality) {
          const locality = await reverseGeocode(wp.lat, wp.lng, savedPlaces);
          if (locality) {
            setRoute(prev => ({
              ...prev,
              waypoints: prev.waypoints.map(w =>
                w.id === wp.id ? { ...w, locality } : w,
              ),
            }));
          }
        }
      }
    })();
  }, []);

  return {
    route,
    isCalculating,
    autoCalculate,
    setAutoCalculate,
    triggerCalculate,
    segmentDistances,
    segmentDurations,
    addWaypoint,
    insertWaypoint,
    insertDirectWaypoint,
    removeWaypoint,
    updateWaypointPosition,
    moveWaypoint,
    setWaypoints,
    renameRoute,
    clearRoute,
    clearGeometry,
    reverseRoute,
    setProfile,
    importRoute,
    replaceRoute,
  };
};
