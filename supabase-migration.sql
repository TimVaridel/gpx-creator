-- 1. Table des profils utilisateurs
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  approved    boolean not null default false,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 2. Trigger : créer automatiquement un profil après inscription
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = 'public'
as $$
begin
  insert into public.profiles (id, email, approved, is_admin)
  values (new.id, new.email, false, false);
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Activer RLS
alter table public.profiles enable row level security;

-- 4. Politiques RLS
-- Un utilisateur peut lire son propre profil
drop policy if exists "users_read_own_profile" on public.profiles;
create policy "users_read_own_profile" on public.profiles
  for select using (auth.uid() = id);

-- Fonction anti-récursion pour vérifier le rôle admin (security definer = bypass RLS)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = 'public'
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_admin = true);
$$;

-- Un admin peut lire tous les profils
drop policy if exists "admin_read_all_profiles" on public.profiles;
create policy "admin_read_all_profiles" on public.profiles
  for select using (public.is_admin());

-- Un admin peut modifier les profils (approuver)
drop policy if exists "admin_update_profiles" on public.profiles;
create policy "admin_update_profiles" on public.profiles
  for update using (public.is_admin());

-- Un admin peut supprimer des profils
drop policy if exists "admin_delete_profiles" on public.profiles;
create policy "admin_delete_profiles" on public.profiles
  for delete using (public.is_admin());

-- Un utilisateur peut créer son propre profil (pour les comptes créés avant le trigger)
drop policy if exists "users_insert_own_profile" on public.profiles;
create policy "users_insert_own_profile" on public.profiles
  for insert with check (auth.uid() = id);

-- ══════════════════════════════════════════════════════════════
-- 5. Table des parcours sauvegardés
-- ══════════════════════════════════════════════════════════════

create table if not exists public.saved_routes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'Mon itinéraire',
  profile     text not null default 'driving-car',
  max_speed   real not null default 60,
  waypoints   jsonb not null,
  groups      jsonb not null default '[]'::jsonb,
  route_geometry  jsonb,
  total_distance  real not null default 0,
  duration        real not null default 0,
  segment_speeds  jsonb not null default '[]'::jsonb,
  manual_segment_duration jsonb not null default '[]'::jsonb,
  segment_pause   jsonb not null default '[]'::jsonb,
  segment_remark  jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.saved_routes enable row level security;

drop policy if exists "users_manage_own_routes" on public.saved_routes;
create policy "users_manage_own_routes" on public.saved_routes
  for all using (auth.uid() = user_id);

drop index if exists idx_saved_routes_user;
create index if not exists idx_saved_routes_user on public.saved_routes(user_id);

-- Révoquer l'exécution directe des fonctions trigger/admin (appelées uniquement par le trigger et les politiques RLS)
revoke execute on function public.handle_new_user() from anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- 6. Lieux enregistrés (privés — chaque utilisateur voit ses propres lieux)
-- ══════════════════════════════════════════════════════════════

drop table if exists public.saved_places cascade;
create table public.saved_places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  lat         double precision not null,
  lng         double precision not null,
  category    text not null default '',
  created_at  timestamptz not null default now()
);

alter table public.saved_places enable row level security;

drop policy if exists "users_select_all_places" on public.saved_places;
create policy "users_select_all_places" on public.saved_places
  for select using (auth.role() = 'authenticated');

drop policy if exists "users_insert_own_places" on public.saved_places;
create policy "users_insert_own_places" on public.saved_places
  for insert with check (auth.uid() = user_id);

drop policy if exists "users_update_own_places" on public.saved_places;
create policy "users_update_own_places" on public.saved_places
  for update using (auth.uid() = user_id);

drop policy if exists "users_delete_own_places" on public.saved_places;
create policy "users_delete_own_places" on public.saved_places
  for delete using (auth.uid() = user_id);

create index if not exists idx_saved_places_user on public.saved_places(user_id);

-- ══════════════════════════════════════════════════════════════
-- 7. Cache de géocodage (partagé entre tous les utilisateurs)
-- ══════════════════════════════════════════════════════════════

create table if not exists public.locality_cache (
  lat         double precision not null,
  lng         double precision not null,
  locality    text not null,
  updated_at  timestamptz not null default now(),
  primary key (lat, lng)
);

-- RLS activée — données partagées non sensibles
alter table public.locality_cache enable row level security;

drop policy if exists "authenticated_read_locality_cache" on public.locality_cache;
create policy "authenticated_read_locality_cache" on public.locality_cache
  for select using (auth.role() = 'authenticated');

drop policy if exists "authenticated_write_locality_cache" on public.locality_cache;
create policy "authenticated_write_locality_cache" on public.locality_cache
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "authenticated_update_locality_cache" on public.locality_cache;
create policy "authenticated_update_locality_cache" on public.locality_cache
  for update using (auth.role() = 'authenticated');
