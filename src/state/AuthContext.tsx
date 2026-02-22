import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
};

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  needsPasswordSetup: boolean;
  clearPasswordSetup: () => void;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, firstName?: string, lastName?: string) => Promise<{ error: string | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (fields: { display_name?: string }) => Promise<{ error: string | null }>;
  updateEmail: (newEmail: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, avatar_url')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data as Profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);

  const clearPasswordSetup = useCallback(() => {
    setNeedsPasswordSetup(false);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Detect invite/recovery callback in URL hash (e.g. #type=invite&access_token=...)
    const hash = window.location.hash;
    const isInviteCallback = hash.includes('type=invite') || hash.includes('type=recovery');

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        fetchProfile(u.id).then(setProfile);
      }
      // If arriving via invite link, show password setup
      if (isInviteCallback && u) {
        setNeedsPasswordSetup(true);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          fetchProfile(u.id).then(setProfile);
        } else {
          setProfile(null);
        }
        // Also detect invite via auth event
        if (event === 'PASSWORD_RECOVERY' && u) {
          setNeedsPasswordSetup(true);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, firstName?: string, lastName?: string) => {
    if (!supabase) return { error: 'Supabase not configured' };
    const options: Record<string, unknown> = {};
    if (firstName || lastName) {
      options.data = {
        first_name: firstName || null,
        last_name: lastName || null,
        full_name: [firstName, lastName].filter(Boolean).join(' ') || null,
      };
    }
    const { error } = await supabase.auth.signUp({ email, password, options });
    return { error: error?.message ?? null };
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error: error?.message ?? null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const updateProfile = useCallback(async (fields: { display_name?: string }) => {
    if (!supabase) return { error: 'Supabase not configured' };
    const userId = user?.id;
    if (!userId) return { error: 'Not signed in' };

    const { error } = await supabase
      .from('profiles')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) return { error: error.message };

    // Refresh profile state
    const refreshed = await fetchProfile(userId);
    if (refreshed) setProfile(refreshed);

    return { error: null };
  }, [user]);

  const updateEmail = useCallback(async (newEmail: string) => {
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) return { error: error.message };
    // Email updates after user clicks the confirmation link.
    // onAuthStateChange will refresh the profile automatically.
    return { error: null };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        needsPasswordSetup,
        clearPasswordSetup,
        signInWithEmail,
        signUpWithEmail,
        signInWithMagicLink,
        signInWithGoogle,
        signOut,
        updateProfile,
        updateEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
