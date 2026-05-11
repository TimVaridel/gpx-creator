import { useState, useCallback, useEffect, useRef } from 'react';
import type { Waypoint, Route, RoutingProfile } from '../types/route.types';
import { getRoute } from '../services/routingService';

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

export const useRoute = () => {
  const [route, setRoute] = useState<Route>({
    id: generateId(),
    name: 'Mon itinéraire',
    waypoints: [],
    totalDistance: 0,
    createdAt: new Date(),
    profile: 'driving-car',
  });

  const [isCalculating, setIsCalculating] = useState(false);
  const [autoCalculate, setAutoCalculate] = useState(false);

  const waypointsRef = useRef(route.waypoints);
  const profileRef   = useRef(route.profile);

  // ── Calcul segmenté (direct ou routé) ───────────────────
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
      return;
    }

    setIsCalculating(true);

    const allSegments: [number, number][][] = [];
    let totalDistance = 0;
    let totalDuration = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to   = waypoints[i + 1];

      if (to.direct) {
        // Ligne droite — pas d'appel API
        allSegments.push([
          [from.lat, from.lng],
          [to.lat,   to.lng],
        ]);
        totalDistance += haversineMeters(from.lat, from.lng, to.lat, to.lng);
        // Pas de durée significative pour une ligne droite
      } else {
        const result = await getRoute([from, to], profile);
        if (result) {
          const seg: [number, number][] = result.coordinates.map(
            ([lng, lat]) => [lat, lng],
          );
          allSegments.push(seg);
          totalDistance += result.distance;
          totalDuration += result.duration;
        }
      }
    }

    setIsCalculating(false);

    // Concatène les segments en évitant les points en double
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
  }, []);

  useEffect(() => {
    if (!autoCalculate) return;
    waypointsRef.current = route.waypoints;
    profileRef.current   = route.profile;
    calculateRoute(route.waypoints, route.profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.waypoints, route.profile, autoCalculate]);

  const triggerCalculate = useCallback(() => {
    calculateRoute(route.waypoints, route.profile);
  }, [route.waypoints, route.profile, calculateRoute]);

  // ── Waypoints ────────────────────────────────────────────

  const addWaypoint = useCallback((lat: number, lng: number) => {
    setRoute(prev => ({
      ...prev,
      waypoints: [
        ...prev.waypoints,
        { id: generateId(), lat, lng, name: `Point ${prev.waypoints.length + 1}` },
      ],
    }));
  }, []);

  const insertWaypoint = useCallback((lat: number, lng: number, atIndex: number) => {
    setRoute(prev => {
      const wp: Waypoint = {
        id: generateId(), lat, lng,
        name: `Point ${prev.waypoints.length + 1}`,
      };
      const wps = [...prev.waypoints];
      wps.splice(atIndex, 0, wp);
      return { ...prev, waypoints: wps };
    });
  }, []);

  // Point direct (segment ligne droite vers ce point)
  const insertDirectWaypoint = useCallback((lat: number, lng: number, atIndex: number) => {
    setRoute(prev => {
      const wp: Waypoint = {
        id: generateId(), lat, lng,
        name: `Point ${prev.waypoints.length + 1}`,
        direct: true,
      };
      const wps = [...prev.waypoints];
      wps.splice(atIndex, 0, wp);
      // On efface la géométrie : elle sera recalculée au prochain triggerCalculate
      return { ...prev, waypoints: wps, routeGeometry: undefined };
    });
  }, []);

  const removeWaypoint = useCallback((id: string) => {
    setRoute(prev => ({
      ...prev,
      waypoints: prev.waypoints.filter(wp => wp.id !== id),
    }));
  }, []);

  const updateWaypointPosition = useCallback((id: string, lat: number, lng: number) => {
    setRoute(prev => ({
      ...prev,
      waypoints: prev.waypoints.map(wp =>
        wp.id === id ? { ...wp, lat, lng } : wp,
      ),
    }));
  }, []);

  const moveWaypoint = useCallback((fromIndex: number, toIndex: number) => {
    setRoute(prev => {
      const wps = [...prev.waypoints];
      const [moved] = wps.splice(fromIndex, 1);
      wps.splice(toIndex, 0, moved);
      return { ...prev, waypoints: wps };
    });
  }, []);

  const renameRoute = useCallback((name: string) => {
    setRoute(prev => ({ ...prev, name }));
  }, []);

  const clearRoute = useCallback(() => {
    setRoute(prev => ({ ...prev, waypoints: [], routeGeometry: undefined }));
  }, []);

  const clearGeometry = useCallback(() => {
    setRoute(prev => ({
      ...prev,
      routeGeometry: undefined,
      totalDistance: 0,
      duration: 0,
    }));
  }, []);

  const reverseRoute = useCallback(() => {
    setRoute(prev => ({
      ...prev,
      waypoints: [...prev.waypoints].reverse(),
      routeGeometry: undefined,
      totalDistance: 0,
      duration: 0,
    }));
  }, []);

  const setProfile = useCallback((profile: RoutingProfile) => {
    setRoute(prev => ({ ...prev, profile }));
  }, []);

  return {
    route,
    isCalculating,
    autoCalculate,
    setAutoCalculate,
    triggerCalculate,
    addWaypoint,
    insertWaypoint,
    insertDirectWaypoint,
    removeWaypoint,
    updateWaypointPosition,
    moveWaypoint,
    renameRoute,
    clearRoute,
    clearGeometry,
    reverseRoute,
    setProfile,
  };
};
