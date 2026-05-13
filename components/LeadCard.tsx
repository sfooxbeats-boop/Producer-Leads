import { View, Text, TouchableOpacity, Linking } from 'react-native';
import type { ThreadsPost } from '../lib/threads';
import { timeAgo } from '../lib/threads';

type Props = {
  lead: ThreadsPost;
};

export default function LeadCard({ lead }: Props) {
  function openLink(url: string) {
    Linking.openURL(url).catch(() =>
      console.warn('Could not open URL:', url)
    );
  }

  return (
    <View className="bg-card rounded-2xl p-5 mb-4 border border-border">

      {/* Header: username + time + tag */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2 flex-1">
          {/* Avatar placeholder — first letter of username */}
          <View className="w-9 h-9 rounded-full bg-accent/20 items-center justify-center">
            <Text className="text-accent text-sm font-bold uppercase">
              {lead.username.charAt(0)}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-white text-sm font-semibold">@{lead.username}</Text>
            <Text className="text-muted text-xs">{timeAgo(lead.timestamp)}</Text>
          </View>
        </View>
        {/* Match tag badge */}
        <View className="bg-accent/20 rounded-full px-3 py-1">
          <Text className="text-accent text-xs font-semibold">{lead.match_tag}</Text>
        </View>
      </View>

      {/* Post content */}
      <Text className="text-white text-sm leading-6 mb-4" numberOfLines={6}>
        {lead.text}
      </Text>

      {/* Action buttons */}
      <View className="flex-row gap-3">
        <TouchableOpacity
          onPress={() => openLink(lead.instagram_url)}
          className="flex-1 bg-gradient-to-r border border-accent rounded-xl py-2.5 items-center"
          style={{ borderColor: '#E1306C' }}
        >
          <Text className="text-sm font-semibold" style={{ color: '#E1306C' }}>
            📷  Instagram
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => openLink(lead.threads_url)}
          className="flex-1 bg-card border border-border rounded-xl py-2.5 items-center"
        >
          <Text className="text-white text-sm font-semibold">
            🧵  View Post
          </Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}
