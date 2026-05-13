import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

// Dev mode: simplified settings. Will be wired to Supabase profile once auth is back.
export default function SettingsScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-bg">
      <View className="px-6 pt-14 pb-6 flex-row items-center gap-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 bg-card rounded-full items-center justify-center border border-border"
        >
          <Text className="text-white">←</Text>
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">Settings</Text>
      </View>

      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="bg-card rounded-2xl p-5 border border-border mb-4">
          <Text className="text-muted text-xs mb-2 uppercase tracking-widest">Status</Text>
          <Text className="text-white font-semibold mb-1">Demo Mode</Text>
          <Text className="text-muted text-sm leading-5">
            Auth and profile settings are temporarily disabled. The dashboard shows sample
            leads so you can preview the app.
          </Text>
        </View>

        <View className="bg-card rounded-2xl p-5 border border-border">
          <Text className="text-muted text-xs mb-2 uppercase tracking-widest">Next Steps</Text>
          <Text className="text-white text-sm leading-6">
            • Add a Threads API token to fetch real leads{'\n'}
            • Re-enable Google + email login{'\n'}
            • Submit app for Meta App Review
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
