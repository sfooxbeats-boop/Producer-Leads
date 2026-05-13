import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase, upsertProfile } from '../lib/supabase';
import { CATEGORY_LABELS, GENRE_OPTIONS, type Category } from '../lib/keywords';

const YEAR_OPTIONS = ['Less than 1 year', '1–2 years', '3–5 years', '6–10 years', '10+ years'];
const YEAR_VALUES = [0, 1, 3, 6, 10];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1); // Steps 1, 2, 3
  const [saving, setSaving] = useState(false);

  // Form state
  const [categories, setCategories] = useState<Category[]>([]);
  const [yearsIndex, setYearsIndex] = useState<number | null>(null);
  const [genres, setGenres] = useState<string[]>([]);

  function toggleCategory(cat: Category) {
    setCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }

  function toggleGenre(genre: string) {
    setGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  }

  async function handleSave() {
    if (categories.length === 0) {
      Alert.alert('Please select at least one category');
      return;
    }
    if (yearsIndex === null) {
      Alert.alert('Please select your experience level');
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error } = await upsertProfile({
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.full_name ?? null,
      avatar_url: user.user_metadata?.avatar_url ?? null,
      categories,
      years_in_industry: YEAR_VALUES[yearsIndex],
      genres,
      onboarding_complete: true,
    });

    setSaving(false);

    if (error) {
      Alert.alert('Something went wrong', error.message);
      return;
    }

    router.replace('/(app)/dashboard');
  }

  const progress = (step / 3) * 100;

  return (
    <View className="flex-1 bg-bg">
      {/* Progress bar at top */}
      <View className="h-1 bg-border">
        <View className="h-1 bg-accent" style={{ width: `${progress}%` }} />
      </View>

      <ScrollView
        className="flex-1 px-6 pt-12"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >

        {/* Step 1: Category */}
        {step === 1 && (
          <View>
            <Text className="text-muted text-sm mb-2">Step 1 of 3</Text>
            <Text className="text-white text-3xl font-bold mb-2">What do you do?</Text>
            <Text className="text-muted text-base mb-8">Pick everything that applies — you can find leads for all of them.</Text>

            <View className="gap-4">
              {(Object.keys(CATEGORY_LABELS) as Category[]).map(cat => {
                const selected = categories.includes(cat);
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => toggleCategory(cat)}
                    className={`rounded-2xl p-5 border-2 flex-row items-center justify-between ${
                      selected ? 'border-accent bg-accent/10' : 'border-border bg-card'
                    }`}
                  >
                    <View>
                      <Text className={`text-lg font-semibold ${selected ? 'text-accent' : 'text-white'}`}>
                        {CATEGORY_LABELS[cat]}
                      </Text>
                      <Text className="text-muted text-sm mt-1">
                        {cat === 'producer' && 'Full track production & arrangements'}
                        {cat === 'beatmaker' && 'Creating beats & instrumentals'}
                        {cat === 'sound_engineer' && 'Mixing, mastering & audio editing'}
                      </Text>
                    </View>
                    <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                      selected ? 'border-accent bg-accent' : 'border-border'
                    }`}>
                      {selected && <Text className="text-white text-xs font-bold">✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Step 2: Years of experience */}
        {step === 2 && (
          <View>
            <Text className="text-muted text-sm mb-2">Step 2 of 3</Text>
            <Text className="text-white text-3xl font-bold mb-2">How long have you been in music?</Text>
            <Text className="text-muted text-base mb-8">This helps us understand your experience level.</Text>

            <View className="gap-3">
              {YEAR_OPTIONS.map((label, i) => {
                const selected = yearsIndex === i;
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setYearsIndex(i)}
                    className={`rounded-2xl p-4 border-2 flex-row items-center justify-between ${
                      selected ? 'border-accent bg-accent/10' : 'border-border bg-card'
                    }`}
                  >
                    <Text className={`text-base font-medium ${selected ? 'text-accent' : 'text-white'}`}>
                      {label}
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
          </View>
        )}

        {/* Step 3: Genres */}
        {step === 3 && (
          <View>
            <Text className="text-muted text-sm mb-2">Step 3 of 3</Text>
            <Text className="text-white text-3xl font-bold mb-2">What genres do you work in?</Text>
            <Text className="text-muted text-base mb-8">Optional — helps filter leads in the future. You can skip this.</Text>

            <View className="flex-row flex-wrap gap-3">
              {GENRE_OPTIONS.map(genre => {
                const selected = genres.includes(genre);
                return (
                  <TouchableOpacity
                    key={genre}
                    onPress={() => toggleGenre(genre)}
                    className={`rounded-full px-5 py-2.5 border-2 ${
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
          </View>
        )}

      </ScrollView>

      {/* Bottom navigation buttons */}
      <View className="px-6 pb-10 gap-3">
        <TouchableOpacity
          onPress={step < 3 ? () => setStep(s => s + 1) : handleSave}
          disabled={saving || (step === 1 && categories.length === 0) || (step === 2 && yearsIndex === null)}
          className={`rounded-2xl py-4 items-center ${
            (step === 1 && categories.length === 0) || (step === 2 && yearsIndex === null)
              ? 'bg-border'
              : 'bg-accent'
          }`}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-base font-semibold">
              {step < 3 ? 'Continue' : 'Find My Leads →'}
            </Text>
          )}
        </TouchableOpacity>

        {step > 1 && (
          <TouchableOpacity onPress={() => setStep(s => s - 1)} className="py-3 items-center">
            <Text className="text-muted text-sm">← Go back</Text>
          </TouchableOpacity>
        )}
      </View>

    </View>
  );
}
