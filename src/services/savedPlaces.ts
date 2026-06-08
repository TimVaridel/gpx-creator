import { supabase } from '../lib/supabase';
import type { SavedPlace, SavedPlaceCategory } from '../types/savedPlace.types';

export async function getAllPlaces(userId?: string): Promise<SavedPlace[]> {
  let query = supabase.from('saved_places').select('*').order('name');
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw error;
  return data as SavedPlace[];
}

export async function getPlacesByCategory(
  category: SavedPlaceCategory,
): Promise<SavedPlace[]> {
  const { data, error } = await supabase
    .from('saved_places')
    .select('*')
    .eq('category', category)
    .order('name');
  if (error) throw error;
  return data as SavedPlace[];
}

export async function nameExists(name: string): Promise<boolean> {
  const { data } = await supabase
    .from('saved_places')
    .select('id')
    .eq('name', name)
    .maybeSingle();
  return !!data;
}

export async function savePlace(
  name: string,
  lat: number,
  lng: number,
  category: SavedPlaceCategory = '',
): Promise<SavedPlace> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const { data, error } = await supabase
    .from('saved_places')
    .insert({ name, lat, lng, category, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data as SavedPlace;
}

export async function updatePlaceName(
  id: string,
  name: string,
): Promise<void> {
  const { error } = await supabase
    .from('saved_places')
    .update({ name })
    .eq('id', id);
  if (error) throw error;
}

export async function updatePlaceCategory(
  id: string,
  category: SavedPlaceCategory,
): Promise<void> {
  const { error } = await supabase
    .from('saved_places')
    .update({ category })
    .eq('id', id);
  if (error) throw error;
}

export async function deletePlace(id: string): Promise<void> {
  const { error } = await supabase
    .from('saved_places')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
