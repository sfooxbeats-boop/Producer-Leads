import '../global.css';
import { Stack } from 'expo-router';

// Dev mode: no auth gate. Just renders the screen stack.
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
