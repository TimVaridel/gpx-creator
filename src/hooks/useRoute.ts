import { useState, useCallback } from 'react';
import type { Waypoint, Route } from '../types/route.types';
import { calculateTotalDistance } from '../utils/routeCalculator';

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useRoute = () => {
  const [route, setRoute] = useState<Route>({
    id: generateId(),
    name: 'Mon itinéraire',
    waypoints: [],
    totalDistance: 0,
    createdAt: new Date(),
  });

  // Ajouter un point
  const addWaypoint = useCallback((lat: number, lng: number) => {
    setRoute(prev => {
      const newWaypoint: Waypoint = {
        id: generateId(),
        lat,
        lng,
        name: `Point ${prev.waypoints.length + 1}`,
      };
      const newWaypoints = [...prev.waypoints, newWaypoint];
      return {
        ...prev,
        waypoints: newWaypoints,
        totalDistance: calculateTotalDistance(newWaypoints),
      };
    });
  }, []);

  // Supprimer un point
  const removeWaypoint = useCallback((id: string) => {
    setRoute(prev => {
      const newWaypoints = prev.waypoints.filter(wp => wp.id !== id);
      return {
        ...prev,
        waypoints: newWaypoints,
        totalDistance: calculateTotalDistance(newWaypoints),
      };
    });
  }, []);

  // Renommer l'itinéraire
  const renameRoute = useCallback((name: string) => {
    setRoute(prev => ({ ...prev, name }));
  }, []);

  // Tout effacer
  const clearRoute = useCallback(() => {
    setRoute(prev => ({
      ...prev,
      waypoints: [],
      totalDistance: 0,
    }));
  }, []);

  // Déplacer un point (drag & drop dans la liste)
  const moveWaypoint = useCallback((fromIndex: number, toIndex: number) => {
    setRoute(prev => {
      const newWaypoints = [...prev.waypoints];
      const [moved] = newWaypoints.splice(fromIndex, 1);
      newWaypoints.splice(toIndex, 0, moved);
      return {
        ...prev,
        waypoints: newWaypoints,
        totalDistance: calculateTotalDistance(newWaypoints),
      };
    });
  }, []);

  return {
    route,
    addWaypoint,
    removeWaypoint,
    renameRoute,
    clearRoute,
    moveWaypoint,
  };
};
