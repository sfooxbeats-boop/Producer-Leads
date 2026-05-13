import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useState } from 'react';
import { signInWithGoogle } from '../../lib/supabase';

export default function SignInScreen() {
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      Alert.alert('Sign in failed', error.message);
      setLoading(false);
    }
    // On success, the root layout's auth listener handles the redirect automatically
  }

  return (
    <View className="flex-1 bg-bg items-center justify-center px-8">

      {/* Logo area */}
      <View className="mb-12 items-center">
        <View className="w-20 h-20 rounded-2xl bg-accent items-center justify-center mb-6">
          <Text className="text-white text-4xl font-bold">PL</Text>
        </View>
        <Text className="text-white text-4xl font-bold tracking-tight">
          Producer Leads
        </Text>
        <Text className="text-muted text-base mt-3 text-center leading-6">
          Find clients looking for your services — automatically
        </Text>
      </View>

      {/* Features list */}
      <View className="w-full mb-12 gap-4">
        {[
          { icon: '🔍', text: 'Search Threads for people asking for beats, mixes, and production' },
          { icon: '📲', text: 'See their Instagram profile for easy direct outreach' },
          { icon: '⚡', text: 'Fresh leads every 30 minutes, automatically' },
        ].map((item, i) => (
          <View key={i} className="flex-row items-start gap-3">
            <Text className="text-2xl">{item.icon}</Text>
            <Text className="text-muted text-sm flex-1 leading-5">{item.text}</Text>
          </View>
        ))}
      </View>

      {/* Sign in button */}
      <TouchableOpacity
        onPress={handleGoogleSignIn}
        disabled={loading}
        className="w-full bg-accent rounded-2xl py-4 items-center flex-row justify-center gap-3 active:opacity-80"
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <>
            <Text className="text-white text-base font-semibold">Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>

      <Text className="text-muted text-xs mt-6 text-center leading-5">
        By continuing you agree to our Terms of Service.{'\n'}
        Your data is stored securely and never sold.
      </Text>

    </View>
  );
}
