import { supabase } from './supabaseClient';
import type { SavedRouteDB, Waypoint, Group } from '../types/route.types';

export interface SavedRouteListItem {
  id: string;
  name: string;
  waypoint_count: number;
  updated_at: string;
}

export async function listSavedRoutes(): Promise<SavedRouteListItem[]> {
  const { data, error } = await supabase
    .from('saved_routes')
    .select('id, name, waypoints, updated_at')
    .order('updated_at', { ascending: false });

  if (error) { console.error('listSavedRoutes error', error); return []; }

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    waypoint_count: (r.waypoints as Waypoint[]).length,
    updated_at: r.updated_at as string,
  }));
}

export async function getSavedRoute(id: string): Promise<SavedRouteDB | null> {
  const { data, error } = await supabase
    .from('saved_routes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) { console.error('getSavedRoute error', error); return null; }
  return data as unknown as SavedRouteDB;
}

export interface SaveRouteInput {
  id?: string | null;
  user_id: string;
  name: string;
  profile: string;
  max_speed: number;
  waypoints: Waypoint[];
  groups: Group[];
  route_geometry: [number, number][] | null;
  total_distance: number;
  duration: number;
  segment_speeds: number[];
  manual_segment_duration: (number | null)[];
  segment_pause: number[];
  segment_remark: string[];
}

export async function saveRoute(input: SaveRouteInput): Promise<string | null> {
  const payload = {
    user_id: input.user_id,
    name: input.name,
    profile: input.profile,
    max_speed: input.max_speed,
    waypoints: JSON.parse(JSON.stringify(input.waypoints)),
    groups: JSON.parse(JSON.stringify(input.groups)),
    route_geometry: input.route_geometry
      ? JSON.parse(JSON.stringify(input.route_geometry))
      : null,
    total_distance: input.total_distance,
    duration: input.duration,
    segment_speeds: JSON.parse(JSON.stringify(input.segment_speeds)),
    manual_segment_duration: JSON.parse(JSON.stringify(input.manual_segment_duration)),
    segment_pause: JSON.parse(JSON.stringify(input.segment_pause)),
    segment_remark: JSON.parse(JSON.stringify(input.segment_remark)),
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase
      .from('saved_routes')
      .update(payload)
      .eq('id', input.id)
      .select('id')
      .single();

    if (error) { console.error('saveRoute (update) error', error); return null; }
    return input.id;
  }

  const { data, error } = await supabase
    .from('saved_routes')
    .insert(payload)
    .select('id')
    .single();

  if (error) { console.error('saveRoute (insert) error', error); return null; }
  return (data as { id: string }).id;
}

export async function getRouteByName(
  name: string,
  userId: string,
  excludeId?: string,
): Promise<{ id: string } | null> {
  let query = supabase
    .from('saved_routes')
    .select('id')
    .eq('user_id', userId)
    .eq('name', name);
  if (excludeId) query = query.neq('id', excludeId);
  const { data } = await query.maybeSingle();
  return data as { id: string } | null;
}

export async function deleteSavedRoute(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('saved_routes')
    .delete()
    .eq('id', id);

  if (error) { console.error('deleteSavedRoute error', error); return false; }
  return true;
}
