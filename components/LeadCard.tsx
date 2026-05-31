import { View, Text, TouchableOpacity, Linking } from 'react-native';
import type { Lead } from '../lib/threads';

type Props = {
  lead: Lead;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function LeadCard({ lead }: Props) {
  function openLink(url: string) {
    Linking.openURL(url).catch(() => console.warn('Could not open URL:', url));
  }

  const platformIcon = lead.platform === 'threads' ? '🧵' : '📸';
  const platformLabel = lead.platform === 'threads' ? 'Threads' : 'Instagram';

  return (
    <View className="bg-card rounded-2xl p-5 mb-4 border border-border">

      {/* Header: username + time + platform badge */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2 flex-1">
          <View className="w-9 h-9 rounded-full bg-accent/20 items-center justify-center">
            <Text className="text-accent text-sm font-bold uppercase">
              {lead.username.charAt(0)}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-white text-sm font-semibold">@{lead.username}</Text>
            <Text className="text-muted text-xs">{timeAgo(lead.posted_at)}</Text>
          </View>
        </View>
        <View className="bg-accent/20 rounded-full px-3 py-1">
          <Text className="text-accent text-xs font-semibold">{platformIcon} {platformLabel}</Text>
        </View>
      </View>

      {/* Post content */}
      <Text className="text-white text-sm leading-6 mb-3" numberOfLines={6}>
        {lead.post_text}
      </Text>

      {/* Email (shown if found in their bio or post) */}
      {lead.email ? (
        <TouchableOpacity
          onPress={() => openLink(`mailto:${lead.email}`)}
          className="flex-row items-center gap-2 mb-3"
        >
          <Text className="text-accent text-xs">📧 {lead.email}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Action buttons */}
      <View className="flex-row gap-3">
        <TouchableOpacity
          onPress={() => openLink(lead.instagram_url)}
          className="flex-1 border rounded-xl py-2.5 items-center"
          style={{ borderColor: '#E1306C' }}
        >
          <Text className="text-sm font-semibold" style={{ color: '#E1306C' }}>
            📷  Instagram
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => openLink(lead.post_url)}
          className="flex-1 bg-card border border-border rounded-xl py-2.5 items-center"
        >
          <Text className="text-white text-sm font-semibold">
            {platformIcon}  View Post
          </Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}
