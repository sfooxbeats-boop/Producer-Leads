import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase, getProfile, upsertProfile } from '../../lib/supabase';
import { CATEGORY_LABELS, GENRE_OPTIONS, type Category } from '../../lib/keywords';

export default function SettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? '');
      setName(user.user_metadata?.full_name ?? '');
      const profile = await getProfile(user.id);
      if (profile) {
        setCategories((profile.categories ?? []) as Category[]);
        setGenres(profile.genres ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  function toggleCategory(cat: Category) {
    setCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }

  function toggleGenre(g: string) {
    setGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  }

  async function handleSave() {
    if (categories.length === 0) {
      Alert.alert('Please select at least one category');
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await upsertProfile({ id: user.id, email: user.email!, categories, genres, onboarding_complete: true });
    setSaving(false);
    if (error) {
      Alert.alert('Error saving', error.message);
    } else {
      Alert.alert('Saved!', 'Your profile has been updated.');
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator color="#8B5CF6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      {/* Header */}
      <View className="px-6 pt-14 pb-6 flex-row items-center gap-4">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-card rounded-full items-center justify-center border border-border">
          <Text className="text-white">←</Text>
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">Settings</Text>
      </View>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Account info */}
        <View className="bg-card rounded-2xl p-5 border border-border mb-6">
          <Text className="text-muted text-xs mb-3 uppercase tracking-widest">Account</Text>
          <Text className="text-white font-semibold text-base">{name}</Text>
          <Text className="text-muted text-sm mt-1">{email}</Text>
        </View>

        {/* Categories */}
        <Text className="text-white text-lg font-bold mb-3">Your Categories</Text>
        <View className="gap-3 mb-6">
          {(Object.keys(CATEGORY_LABELS) as Category[]).map(cat => {
            const selected = categories.includes(cat);
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => toggleCategory(cat)}
                className={`rounded-2xl p-4 border-2 flex-row items-center justify-between ${
                  selected ? 'border-accent bg-accent/10' : 'border-border bg-card'
                }`}
              >
                <Text className={`font-semibold ${selected ? 'text-accent' : 'text-white'}`}>
                  {CATEGORY_LABELS[cat]}
                </Text>
                <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                  selected ? 'border-accent bg-accent' : 'border-border'
                }`}>
                  {selected && <Text className="text-white" style={{ fontSize: 10 }}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Genres */}
        <Text className="text-white text-lg font-bold mb-3">Genres</Text>
        <View className="flex-row flex-wrap gap-3 mb-8">
          {GENRE_OPTIONS.map(genre => {
            const selected = genres.includes(genre);
            return (
              <TouchableOpacity
                key={genre}
                onPress={() => toggleGenre(genre)}
                className={`rounded-full px-4 py-2 border-2 ${
                  selected ? 'border-accent bg-accent/10' : 'border-border bg-card'
                }`}
              >
                <Text className={`text-sm font-medium ${selected ? 'text-accent' : 'text-white'}`}>
                  {genre}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Save button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className="bg-accent rounded-2xl py-4 items-center mb-4"
        >
          {saving ? <ActivityIndicator color="white" /> : (
            <Text className="text-white text-base font-semibold">Save Changes</Text>
          )}
        </TouchableOpacity>

        {/* Sign out */}
        <TouchableOpacity
          onPress={handleSignOut}
          className="bg-card rounded-2xl py-4 items-center border border-border"
        >
          <Text className="text-red-400 text-base font-semibold">Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}
