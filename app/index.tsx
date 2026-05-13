import { Redirect } from 'expo-router';

// Dev mode: skip auth + onboarding, go straight to the dashboard.
// To re-enable auth flow later, replace this with the session check version.
export default function Index() {
  return <Redirect href="/(app)/dashboard" />;
}
