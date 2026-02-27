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
  expiredInviteMessage: string | null;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, firstName?: string, lastName?: string) => Promise<{ error: string | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
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
  const [expiredInviteMessage, setExpiredInviteMessage] = useState<string | null>(null);

  const clearPasswordSetup = useCallback(() => {
    setNeedsPasswordSetup(false);
    // Clear the persisted flag so it doesn't re-appear on reload
    if (user?.id) {
      localStorage.removeItem(`football-studio-needs-password-${user.id}`);
    }
  }, [user]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Detect invite/recovery callback in URL hash (e.g. #type=invite&access_token=...)
    const hash = window.location.hash;
    const isInviteCallback = hash.includes('type=invite') || hash.includes('type=recovery');

    // Detect expired/invalid invite links (Supabase redirects with error params in hash)
    const hashParams = new URLSearchParams(hash.replace('#', ''));
    const authError = hashParams.get('error');
    const authErrorDesc = hashParams.get('error_description');
    if (authError && authErrorDesc) {
      setExpiredInviteMessage(authErrorDesc.replace(/\+/g, ' '));
      // Clean the URL hash so it doesn't persist on refresh
      window.history.replaceState(null, '', window.location.pathname);
    }

    // Handle safe invite/confirm links: /auth/confirm?token_hash=xxx&type=invite
    // These links redirect through the app instead of hitting /auth/v1/verify directly,
    // which prevents email prefetchers (Microsoft Safe Links) from consuming the token.
    const searchParams = new URLSearchParams(window.location.search);
    const tokenHash = searchParams.get('token_hash');
    const tokenType = searchParams.get('type');
    const isTokenConfirm = window.location.pathname === '/auth/confirm' && tokenHash && tokenType;

    if (isTokenConfirm) {
      // Verify the token via the Supabase SDK (POST request, not GET — safe from prefetchers)
      supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: tokenType as 'invite' | 'magiclink' | 'email',
      }).then(({ data, error: verifyError }) => {
        // Clean URL regardless of outcome
        window.history.replaceState(null, '', '/');
        if (verifyError) {
          setExpiredInviteMessage(verifyError.message);
          setLoading(false);
          return;
        }
        const u = data.session?.user ?? data.user ?? null;
        setUser(u as User | null);
        if (u) {
          fetchProfile(u.id).then(setProfile);
          // Invited users need to set a password
          if (tokenType === 'invite' || tokenType === 'recovery') {
            setNeedsPasswordSetup(true);
            localStorage.setItem(`football-studio-needs-password-${u.id}`, 'true');
          }
        }
        setLoading(false);
      });
      return; // Skip normal session check — verifyOtp handles it
    }

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        fetchProfile(u.id).then(setProfile);
      }
      // If arriving via invite link, show password setup and persist across reloads
      if (isInviteCallback && u) {
        setNeedsPasswordSetup(true);
        localStorage.setItem(`football-studio-needs-password-${u.id}`, 'true');
      } else if (u && localStorage.getItem(`football-studio-needs-password-${u.id}`)) {
        // Restore persisted flag (user reloaded before completing password setup)
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
          localStorage.setItem(`football-studio-needs-password-${u.id}`, 'true');
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

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
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
        expiredInviteMessage,
        signInWithEmail,
        signUpWithEmail,
        signInWithMagicLink,
        signInWithGoogle,
        resetPassword,
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
