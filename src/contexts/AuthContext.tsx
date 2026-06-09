// Contexte d'authentification Supabase — état global user/session + méthodes
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { supabase, recreateSupabaseClient } from '../lib/supabaseClient';
import { ensureProfile } from '../lib/profiles';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '../types/profile.types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchProfile(userId: string, email: string): Promise<Profile | null> {
  return ensureProfile(userId, email);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [clientVersion, setClientVersion] = useState(0);
  const userRef = useRef<User | null>(null);

  useEffect(() => { userRef.current = user; }, [user]);

  const loadProfile = useCallback(async (uid: string, email: string) => {
    setProfileLoading(true);
    try {
      const p = await fetchProfile(uid, email);
      setProfile(p);
    } catch (err) {
      console.warn('loadProfile error', err);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user }, error }) => {
      console.log('[AUTH] getUser DONE', { userId: user?.id, error: error?.message, at: Date.now() });
      if (error || !user) {
        setUser(null);
        setSession(null);
        setLoading(false);
        return;
      }
      setUser(user);
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (user) {
        await loadProfile(user.id, user.email ?? '');
      }
      setLoading(false);
    }).catch((err) => {
      console.warn('[AUTH] getUser CATCH', err?.message, Date.now());
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AUTH] onAuthStateChange', event, { userId: session?.user?.id, at: Date.now() });

      if (event === 'TOKEN_REFRESHED') {
        if (session) setSession(session);
        return;
      }

      if (event === 'SIGNED_OUT') {
        console.log('[AUTH] SIGNED_OUT', { at: Date.now() });
        setUser(null);
        setSession(null);
        setProfile(null);
        return;
      }

      if (session?.user) {
        setSession(session);
        // Déjà connecté avec le même user → ignorer SIGNED_IN de recovery (évite cascade)
        if (userRef.current && userRef.current.id === session.user.id) {
          return;
        }
        setUser(session.user);
        if (event !== 'INITIAL_SESSION') {
          try {
            await loadProfile(session.user.id, session.user.email ?? '');
          } catch {
            // échec silencieux
          }
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile, clientVersion]);

  // Log d'état auth à chaque changement significatif
  useEffect(() => {
    console.log('[AUTH] STATE', { user: !!user, profile: !!profile, loading, profileLoading, at: Date.now() });
  }, [user, profile, loading, profileLoading]);

  // Recrée le client Supabase au retour d'onglet (évite le _refreshTokenPromise bloqué)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      console.log('[AUTH] Tab visible → recreating supabase client', { at: Date.now() });
      recreateSupabaseClient();
      setClientVersion(v => v + 1);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error?.message ?? null;
  }, []);

  const signOut = useCallback(async () => {
    supabase.auth.signOut().catch(() => {});
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    setProfileLoading(true);
    try {
      const p = await fetchProfile(user.id, user.email ?? '');
      setProfile(p);
    } catch (err) {
      console.warn('refreshProfile error', err);
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, profileLoading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
}