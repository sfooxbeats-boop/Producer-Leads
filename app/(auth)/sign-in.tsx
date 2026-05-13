import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../../lib/supabase';

// Required for Expo Go — completes the auth session when the browser redirects back
WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        // On web: standard redirect — Supabase opens Google in same tab
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
      } else {
        // On Expo Go / native: open Google in a browser popup, then return to the app
        const redirectUri = makeRedirectUri({ scheme: 'producer-leads', path: 'auth/callback' });

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUri,
            skipBrowserRedirect: true, // we open the browser manually below
          },
        });

        if (error || !data.url) throw error ?? new Error('No auth URL returned');

        // Open Google sign-in in a browser popup
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

        if (result.type === 'success') {
          // Pull the tokens out of the redirect URL and set the session
          const fragment = result.url.split('#')[1] ?? '';
          const params = new URLSearchParams(fragment);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
          } else {
            throw new Error('No tokens in redirect URL — check your Google OAuth redirect URI in Supabase');
          }
        }
      }
    } catch (err: any) {
      Alert.alert('Sign in failed', err?.message ?? 'Something went wrong');
    }
    setLoading(false);
  }

  return (
    <View className="flex-1 bg-bg items-center justify-center px-8">

      {/* Logo */}
      <View className="mb-12 items-center">
        <View className="w-20 h-20 rounded-2xl bg-accent items-center justify-center mb-6">
          <Text className="text-white text-4xl font-bold">PL</Text>
        </View>
        <Text className="text-white text-4xl font-bold tracking-tight">Producer Leads</Text>
        <Text className="text-muted text-base mt-3 text-center leading-6">
          Find clients looking for your services — automatically
        </Text>
      </View>

      {/* Features */}
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
        {loading
          ? <ActivityIndicator color="white" />
          : <Text className="text-white text-base font-semibold">Continue with Google</Text>
        }
      </TouchableOpacity>

      <Text className="text-muted text-xs mt-6 text-center leading-5">
        By continuing you agree to our Terms of Service.{'\n'}
        Your data is stored securely and never sold.
      </Text>

    </View>
  );
}
