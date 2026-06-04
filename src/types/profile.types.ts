// Type pour le profil utilisateur (table profiles Supabase)
export interface Profile {
  id: string;
  email: string;
  approved: boolean;
  is_admin: boolean;
  created_at: string;
}
