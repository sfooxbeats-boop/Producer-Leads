import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

// Supabase redirects here after Google login.
// This screen picks up the session and then the root layout handles navigation.
export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/(auth)/sign-in');
      }
      // If session exists, root layout will redirect automatically
    });
  }, []);

  return (
    <View className="flex-1 bg-bg items-center justify-center gap-4">
      <ActivityIndicator size="large" color="#8B5CF6" />
      <Text className="text-muted text-sm">Signing you in...</Text>
    </View>
  );
}
