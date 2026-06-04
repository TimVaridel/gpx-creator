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
returns trigger as $$
begin
  insert into public.profiles (id, email, approved, is_admin)
  values (new.id, new.email, false, false);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Activer RLS
alter table public.profiles enable row level security;

-- 4. Politiques RLS
-- Un utilisateur peut lire son propre profil
create policy "users_read_own_profile" on public.profiles
  for select using (auth.uid() = id);

-- Fonction anti-récursion pour vérifier le rôle admin (security definer = bypass RLS)
create or replace function public.is_admin()
returns boolean
language sql
security definer
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_admin = true);
$$;

-- Un admin peut lire tous les profils
create policy "admin_read_all_profiles" on public.profiles
  for select using (public.is_admin());

-- Un admin peut modifier les profils (approuver)
create policy "admin_update_profiles" on public.profiles
  for update using (public.is_admin());

-- Un admin peut supprimer des profils
create policy "admin_delete_profiles" on public.profiles
  for delete using (public.is_admin());

-- Un utilisateur peut créer son propre profil (pour les comptes créés avant le trigger)
create policy "users_insert_own_profile" on public.profiles
  for insert with check (auth.uid() = id);
