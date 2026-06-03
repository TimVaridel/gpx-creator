import { supabase } from '../lib/supabase';
import type { SavedPlace } from '../types/savedPlace.types';

export async function getAllPlaces(): Promise<SavedPlace[]> {
  const { data, error } = await supabase
    .from('saved_places')
    .select('*')
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
  name: string, lat: number, lng: number,
): Promise<SavedPlace> {
  const { data, error } = await supabase
    .from('saved_places')
    .insert({ name, lat, lng })
    .select()
    .single();
  if (error) throw error;
  return data as SavedPlace;
}

export async function updatePlaceName(
  id: string, name: string,
): Promise<void> {
  const { error } = await supabase
    .from('saved_places')
    .update({ name })
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
