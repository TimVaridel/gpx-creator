// Client Supabase initialisé avec les variables d'environnement
import { createClient } from '@supabase/supabase-js';
import { memoryStorage } from './memoryStorage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variables d\'environnement VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requises. ' +
    'Créez un fichier .env à la racine du projet.',
  );
}

function buildClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      storage: memoryStorage,
      autoRefreshToken: true,
    },
  });
}

export const supabase = buildClient();

export function resetAuthRefreshPromise() {
  (supabase.auth as any)._refreshTokenPromise = null;
}
