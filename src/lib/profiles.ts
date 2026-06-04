// Opérations sur la table profiles (approbation de comptes)
import { supabase } from './supabaseClient';
import type { Profile } from '../types/profile.types';

/** Récupère un profil (par id ou email) */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return data ?? null;
}

/** Recherche aussi par email si l'ID n'a rien donné */
export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle();
  return data ?? null;
}

/** Crée ou récupère le profil — upsert pour gérer le cas où la ligne existe déjà */
export async function ensureProfile(userId: string, email: string): Promise<Profile | null> {
  const byId = await getProfile(userId);
  if (byId) return byId;

  const byEmail = await getProfileByEmail(email);
  if (byEmail) {
    const { error } = await supabase
      .from('profiles')
      .update({ id: userId })
      .eq('email', email);
    if (!error) return { ...byEmail, id: userId };
  }

  const { data } = await supabase
    .from('profiles')
    .upsert({ id: userId, email, approved: false, is_admin: false }, { ignoreDuplicates: true })
    .select()
    .maybeSingle();
  if (data) return data;

  return getProfile(userId);
}

/** Liste les profils en attente d'approbation (admin uniquement) */
export async function getPendingProfiles(): Promise<Profile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('approved', false)
    .order('created_at', { ascending: true });
  return data ?? [];
}

/** Liste tous les profils (admin uniquement) */
export async function getAllProfiles(): Promise<Profile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  return data ?? [];
}

/** Approuve un utilisateur (admin uniquement) */
export async function approveProfile(userId: string): Promise<string | null> {
  const { error } = await supabase
    .from('profiles')
    .update({ approved: true })
    .eq('id', userId);
  return error?.message ?? null;
}

/** Supprime un profil et l'utilisateur associé (admin uniquement) */
export async function deleteProfile(userId: string): Promise<string | null> {
  // Note : la suppression dans auth.users cascade vers profiles
  const { error } = await supabase.auth.admin.deleteUser(userId);
  return error?.message ?? null;
}
