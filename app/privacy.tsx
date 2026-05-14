import { ScrollView, View, Text } from 'react-native';

export default function PrivacyPolicy() {
  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>

      <View className="mb-8">
        <Text className="text-white text-3xl font-bold mb-2">Privacy Policy</Text>
        <Text className="text-muted text-sm">Producer Leads · Last updated: May 2026</Text>
      </View>

      <Section title="1. What Producer Leads Does">
        Producer Leads is a tool for music producers, beatmakers, and sound engineers. It searches
        public posts on Threads (by Meta) to find people who are looking for music production
        services, and displays those posts so producers can reach out to potential clients.
      </Section>

      <Section title="2. Information We Collect">
        When you sign in with Google we receive your:{'\n\n'}
        • Name and email address{'\n'}
        • Profile picture{'\n\n'}
        During onboarding you optionally provide:{'\n\n'}
        • Your role (producer / beatmaker / sound engineer){'\n'}
        • Years of experience{'\n'}
        • Music genres you work in{'\n\n'}
        We do NOT collect payment information, location data, or any sensitive personal data.
      </Section>

      <Section title="3. How We Use Your Information">
        • To create and manage your account{'\n'}
        • To personalise the leads shown on your dashboard based on your categories{'\n'}
        • To remember your preferences between sessions{'\n\n'}
        We do NOT sell your data, share it with advertisers, or use it for any purpose other than
        operating the app.
      </Section>

      <Section title="4. Threads Data">
        Producer Leads uses the Threads API (provided by Meta Platforms, Inc.) to search public
        posts. We only read publicly available posts — we never post, reply, or modify anything on
        Threads on your behalf. Threads posts displayed in the app are public content that any
        Threads user can see.
      </Section>

      <Section title="5. Data Storage">
        Your profile information is stored securely in a database provided by Supabase
        (supabase.com). Supabase uses industry-standard encryption. We do not store Threads post
        content permanently — it is fetched fresh each time you refresh your dashboard.
      </Section>

      <Section title="6. Third-Party Services">
        This app uses the following third-party services:{'\n\n'}
        • Google OAuth (sign-in) — subject to Google's Privacy Policy{'\n'}
        • Supabase (database) — subject to Supabase's Privacy Policy{'\n'}
        • Threads API (Meta) — subject to Meta's Privacy Policy
      </Section>

      <Section title="7. Your Rights">
        You can:{'\n\n'}
        • Delete your account at any time from the Settings screen{'\n'}
        • Request a copy of your data by emailing us{'\n'}
        • Ask us to delete all data associated with your account{'\n\n'}
        To exercise any of these rights, email: sfooxbeats@gmail.com
      </Section>

      <Section title="8. Children's Privacy">
        Producer Leads is not directed at children under 13. We do not knowingly collect personal
        information from children under 13.
      </Section>

      <Section title="9. Changes to This Policy">
        We may update this policy from time to time. We will notify users of significant changes
        by updating the date at the top of this page.
      </Section>

      <Section title="10. Contact">
        If you have any questions about this privacy policy, contact us at:{'\n'}
        sfooxbeats@gmail.com
      </Section>

    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="text-white text-base font-bold mb-2">{title}</Text>
      <Text className="text-muted text-sm leading-6">{children}</Text>
    </View>
  );
}
