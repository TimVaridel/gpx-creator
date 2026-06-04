// Client Supabase initialisé avec les variables d'environnement
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variables d\'environnement VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requises. ' +
    'Créez un fichier .env à la racine du projet.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
