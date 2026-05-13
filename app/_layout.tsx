import '../global.css';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase, getProfile } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

// This is the root layout — it wraps EVERY screen in the app.
// It watches the login state and sends users to the right screen automatically.
export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Check if there's already a logged-in session when the app opens
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for login / logout events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Redirect logic: runs every time the session or current screen changes
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Not logged in → send to sign-in screen
      router.replace('/(auth)/sign-in');
    } else if (session) {
      // Logged in → check if they've completed onboarding
      checkOnboarding(session.user.id);
    }
  }, [session, loading, segments]);

  async function checkOnboarding(userId: string) {
    const profile = await getProfile(userId);
    const inOnboarding = segments[0] === 'onboarding';
    const inDashboard = segments[0] === '(app)';

    if (!profile?.onboarding_complete && !inOnboarding) {
      router.replace('/onboarding');
    } else if (profile?.onboarding_complete && !inDashboard) {
      router.replace('/(app)/dashboard');
    }
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
