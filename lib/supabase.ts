import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// These values come from your Supabase project settings.
// You will add them to your .env file — see .env.example
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // On mobile, sessions are stored in AsyncStorage (device storage).
    // On web, Supabase automatically uses localStorage.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── Auth helpers ────────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // After Google login, Supabase redirects back to this URL
      redirectTo: typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : 'producer-leads://auth/callback',
    },
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ─── User profile helpers ─────────────────────────────────────────────────────

export type UserProfile = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  categories: string[];
  years_in_industry: number | null;
  genres: string[];
  onboarding_complete: boolean;
};

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data;
}

export async function upsertProfile(profile: Partial<UserProfile> & { id: string; email: string }) {
  const { data, error } = await supabase
    .from('users')
    .upsert(profile, { onConflict: 'id' })
    .select()
    .single();
  return { data, error };
}
