// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://mcisqiadzbxgdbwqvcgw.supabase.co',
  'sb_publishable_ph_aiuGacZRk4xmq6gqMiw_PQKgGaUS',
);