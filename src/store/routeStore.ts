import { useState, useCallback, useMemo } from 'react';
import type { Waypoint, Group, PlanningRow } from '../types/route.types';

const generateId = () => Math.random().toString(36).substring(2, 9);

// ── Helpers ──────────────────────────────────────────────────────

function routingDistanceKm(
  segmentDistances: number[],
  fromIdx: number,
  toIdx: number,
): number {
  const start = Math.min(fromIdx, toIdx);
  const end   = Math.max(fromIdx, toIdx);
  let total = 0;
  for (let i = start + 1; i <= end; i++) total += segmentDistances[i] ?? 0;
  return total;
}

function calcDurationH(distKm: number, speedKmh: number): number {
  return distKm > 0 && speedKmh > 0
    ? Math.round((distKm / speedKmh) * 100) / 100
    : 0;
}

function addHoursToDateTime(
  dateStr: string,
  timeStr: string,
  hours: number,
): { date: string; time: string } {
  const [h, m]     = timeStr.split(':').map(Number);
  const [y, mo, d] = dateStr.split('-').map(Number);
  const totalMin   = h * 60 + m + Math.round(hours * 60);
  const extraDays  = Math.floor(totalMin / (60 * 24));
  const hh = Math.floor(totalMin / 60) % 24;
  const mm = totalMin % 60;
  const dateObj = new Date(y, mo - 1, d + extraDays);
  return {
    date: `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`,
    time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
  };
}

function wpLabel(wp: Waypoint | undefined, idx: number): string {
  if (!wp) return `Point ${idx + 1}`;
  if (wp.locality) return wp.locality;
  if (wp.name)     return wp.name;
  return `Point ${idx + 1}`;
}

// ── Core algorithms ──────────────────────────────────────────────

/**
 * Crée un nouveau groupe couvrant [fromWpIndex, toWpIndex]
 */
function createGroup(
  fromWpIndex: number,
  toWpIndex: number,
  speedKmh = 60,
): Group {
  return {
    id:               `g-${generateId()}`,
    fromWpIndex,
    toWpIndex,
    speedKmh,
    manualDurationH:  null,
    pauseH:           0,
    remark:           '',
    expanded:         false,
  };
}

/**
 * Recalcule les index des groupes après un réordonnancement des waypoints.
 * Les groupes sont préservés si leurs waypoints sont restés contigus après le move.
 * Sinon le groupe est supprimé (split implicite).
 */
function rebaseGroupIndices(
  groups: Group[],
  oldWaypoints: Waypoint[],
  newWaypoints: Waypoint[],
): Group[] {
  // Pour chaque groupe: trouver les nouveaux index de ses waypoints de début/fin
  const result: Group[] = [];

  for (const g of groups) {
    const fromWp = oldWaypoints[g.fromWpIndex];
    const toWp   = oldWaypoints[g.toWpIndex];

    const newFromIdx = newWaypoints.findIndex(wp => wp.id === fromWp?.id);
    const newToIdx   = newWaypoints.findIndex(wp => wp.id === toWp?.id);

    if (newFromIdx !== -1 && newToIdx !== -1 && newFromIdx < newToIdx) {
      result.push({ ...g, fromWpIndex: newFromIdx, toWpIndex: newToIdx });
    }
    // Si les waypoints ne sont plus adjacents dans le bon ordre → groupe dissous
  }

  return result;
}

/**
 * Fusionne les groupes qui se chevauchent.
 * Si deux groupes partagent un waypoint, ils sont mergés en un seul.
 */
function mergeOverlappingGroups(groups: Group[]): Group[] {
  if (groups.length <= 1) return groups;

  const sorted = [...groups].sort((a, b) => a.fromWpIndex - b.fromWpIndex);
  const merged: Group[] = [];

  for (const g of sorted) {
    const last = merged[merged.length - 1];
    if (last && g.fromWpIndex <= last.toWpIndex + 1) {
      // Fusion : étendre le dernier groupe
      last.toWpIndex = Math.max(last.toWpIndex, g.toWpIndex);
      if (g.manualDurationH !== null) last.manualDurationH = g.manualDurationH;
      if (g.remark) last.remark = g.remark;
    } else {
      merged.push({ ...g });
    }
  }

  return merged;
}

/**
 * Calcule les métriques d'un groupe (distance, durée)
 */
function computeGroupMetrics(
  group: Group,
  segmentDistances: number[],
): { distKm: number; durationH: number } {
  const distKm = routingDistanceKm(segmentDistances, group.fromWpIndex, group.toWpIndex);

  let durationH: number;
  if (group.manualDurationH !== null) {
    durationH = group.manualDurationH;
  } else {
    durationH = calcDurationH(distKm, group.speedKmh);
  }

  return { distKm, durationH };
}

/**
 * Calcule les horaires pour une liste de groupes (planning temporel)
 */
function computePlanningRows(
  groups: Group[],
  waypoints: Waypoint[],
  segmentDistances: number[],
  globalDate: string,
  globalStart: string,
): PlanningRow[] {
  const rows: PlanningRow[] = [];
  let curDate = globalDate;
  let curTime = globalStart;

  for (const group of groups) {
    const fromWp  = waypoints[group.fromWpIndex];
    const toWp    = waypoints[group.toWpIndex];
    const { distKm, durationH } = computeGroupMetrics(
      group, segmentDistances,
    );

    const beginDate = curDate;
    const beginTime = curTime;
    const end       = addHoursToDateTime(beginDate, beginTime, durationH);

    rows.push({
      group,
      fromLabel: wpLabel(fromWp, group.fromWpIndex),
      toLabel:   wpLabel(toWp, group.toWpIndex),
      distKm,
      durationH,
      beginDate,
      beginTime,
      endDate:   end.date,
      endTime:   end.time,
    });

    const afterPause = addHoursToDateTime(end.date, end.time, group.pauseH);
    curDate = afterPause.date;
    curTime = afterPause.time;
  }

  return rows;
}

// ── Hook ─────────────────────────────────────────────────────────

export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);

  const addGroup = useCallback((fromWpIndex: number, toWpIndex: number, speedKmh = 60) => {
    setGroups(prev => {
      const newGroup = createGroup(fromWpIndex, toWpIndex, speedKmh);
      const merged   = mergeOverlappingGroups([...prev, newGroup]);
      return merged;
    });
  }, []);

  const removeGroup = useCallback((groupId: string) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
  }, []);

  const updateGroup = useCallback((
    groupId: string,
    patch: Partial<Group>,
    segmentDistances?: number[],
  ) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      const updated = { ...g, ...patch };

      if ('speedKmh' in patch) {
        updated.manualDurationH = null;
      }

      if ('manualDurationH' in patch && patch.manualDurationH !== null && segmentDistances) {
        const distKm = routingDistanceKm(segmentDistances, g.fromWpIndex, g.toWpIndex);
        if (distKm > 0) {
          updated.speedKmh = Math.round((distKm / (patch.manualDurationH as number)) * 10) / 10;
        }
      }

      return updated;
    }));
  }, []);

  const clearGroups = useCallback(() => {
    setGroups([]);
  }, []);

  /**
   * Re-indexe les groupes après un réordonnancement des waypoints.
   * À appeler dans le même setState que moveWaypoint.
   */
  const rebaseGroups = useCallback((
    oldWaypoints: Waypoint[],
    newWaypoints: Waypoint[],
  ) => {
    setGroups(prev => rebaseGroupIndices(prev, oldWaypoints, newWaypoints));
  }, []);

  /**
   * Fusionne manuellement les groupes qui se chevauchent
   */
  const mergeGroups = useCallback(() => {
    setGroups(prev => mergeOverlappingGroups(prev));
  }, []);

  /**
   * Étend un groupe existant en incluant un waypoint adjacent
   */
  const extendGroup = useCallback((groupId: string, toWpIndex: number) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;

      const newTo   = Math.max(g.toWpIndex, toWpIndex);
      const newFrom = Math.min(g.fromWpIndex, toWpIndex);
      return { ...g, fromWpIndex: newFrom, toWpIndex: newTo };
    }));
  }, []);

  const toggleGroupExpanded = useCallback((groupId: string) => {
    setGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, expanded: !g.expanded } : g,
    ));
  }, []);

  const resetAllDurations = useCallback((maxSpeed: number) => {
    setGroups(prev => prev.map(g => ({ ...g, manualDurationH: null, speedKmh: maxSpeed })));
  }, []);

  const removeWaypointFromGroup = useCallback((groupId: string, wpIndex: number) => {
    setGroups(prev => {
      const group = prev.find(g => g.id === groupId);
      if (!group) return prev;

      const updated = prev.map(g => {
        if (g.id !== groupId) return g;

        if (wpIndex === g.fromWpIndex) {
          return { ...g, fromWpIndex: g.fromWpIndex + 1 };
        } else if (wpIndex === g.toWpIndex) {
          return { ...g, toWpIndex: g.toWpIndex - 1 };
        }
        return g;
      });

      return updated.filter(g => g.fromWpIndex < g.toWpIndex);
    });
  }, []);

  return {
    groups,
    addGroup,
    removeGroup,
    updateGroup,
    clearGroups,
    resetAllDurations,
    rebaseGroups,
    mergeGroups,
    extendGroup,
    toggleGroupExpanded,
    removeWaypointFromGroup,
  };
}

// ── Computed selectors ───────────────────────────────────────────

/**
 * Hook qui calcule les métriques dérivées d'une liste de groupes
 */
export function useGroupMetrics(
  groups: Group[],
  segmentDistances: number[],
  waypoints: Waypoint[],
) {
  const groupMetrics = useMemo(() =>
    groups.map(g => ({
      ...g,
      ...computeGroupMetrics(g, segmentDistances),
    })),
    [groups, segmentDistances],
  );

  const planningRowsFn = useCallback((
    globalDate: string,
    globalStart: string,
  ) => computePlanningRows(
    groups, waypoints, segmentDistances, globalDate, globalStart,
  ), [groups, waypoints, segmentDistances]);

  const totalGroupDistance = useMemo(
    () => groupMetrics.reduce((sum, g) => sum + g.distKm, 0),
    [groupMetrics],
  );

  const totalGroupDuration = useMemo(
    () => groupMetrics.reduce((sum, g) => sum + g.durationH, 0),
    [groupMetrics],
  );

  return { groupMetrics, planningRowsFn, totalGroupDistance, totalGroupDuration };
}

// ── Exports des algorithmes pour usage direct ────────────────────

export {
  createGroup,
  rebaseGroupIndices,
  mergeOverlappingGroups,
  computeGroupMetrics,
  computePlanningRows,
  routingDistanceKm,
  calcDurationH,
};
