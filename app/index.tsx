import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase, getProfile } from '../lib/supabase';

// Entry screen — runs when the app first opens.
// Decides where to send you based on whether you're signed in + onboarded.
export default function Index() {
  const router = useRouter();

  useEffect(() => {
    async function checkAndRedirect() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/(auth)/sign-in');
        return;
      }

      const profile = await getProfile(session.user.id);
      if (profile?.onboarding_complete) {
        router.replace('/(app)/dashboard');
      } else {
        router.replace('/onboarding');
      }
    }

    checkAndRedirect();
  }, []);

  return (
    <View className="flex-1 bg-bg items-center justify-center gap-4">
      <ActivityIndicator size="large" color="#8B5CF6" />
      <Text className="text-muted text-sm">Loading...</Text>
    </View>
  );
}
