import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { fetchLeadsForCategories, HAS_THREADS_TOKEN, type ThreadsPost } from '../../lib/threads';
import { CATEGORY_LABELS, type Category } from '../../lib/keywords';
import LeadCard from '../../components/LeadCard';

// Dev mode default — searches all categories. Will be replaced with user's
// onboarding answers once auth is wired back up.
const DEFAULT_CATEGORIES: Category[] = ['producer', 'beatmaker', 'sound_engineer'];

export default function DashboardScreen() {
  const router = useRouter();
  const [leads, setLeads] = useState<ThreadsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads(isRefresh = false) {
    if (!isRefresh) setLoading(true);
    try {
      const results = await fetchLeadsForCategories(DEFAULT_CATEGORIES);
      setLeads(results);
    } catch (err) {
      console.error('Failed to load leads:', err);
    }
    setLoading(false);
    setRefreshing(false);
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadLeads(true);
  }, []);

  // Filter leads by category tab
  const filteredLeads = activeFilter === 'all'
    ? leads
    : leads.filter(lead => {
        const tagsForCategory = CATEGORY_LABELS[activeFilter as Category];
        return lead.match_tag.toLowerCase().includes(activeFilter.replace('_', ' '))
            || (activeFilter === 'producer' && lead.match_tag === 'Production Needed')
            || (activeFilter === 'beatmaker' && lead.match_tag === 'Beat Request')
            || (activeFilter === 'sound_engineer' && lead.match_tag === 'Mixing / Mastering Needed');
      });

  return (
    <View className="flex-1 bg-bg">

      {/* Header */}
      <View className="px-6 pt-14 pb-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-muted text-sm">Producer Leads</Text>
            <Text className="text-white text-2xl font-bold">Your Leads 🎯</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(app)/settings')}
            className="w-10 h-10 bg-card rounded-full items-center justify-center border border-border"
          >
            <Text className="text-lg">⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Mock data banner */}
        {!HAS_THREADS_TOKEN && (
          <View className="mt-4 bg-accent/10 border border-accent rounded-2xl px-4 py-3">
            <Text className="text-accent text-xs font-semibold mb-1">DEMO MODE</Text>
            <Text className="text-white text-xs leading-5">
              Showing sample leads. Add a Threads API token to .env to fetch real posts.
            </Text>
          </View>
        )}

        {/* Stats bar */}
        <View className="mt-4 bg-card rounded-2xl px-5 py-4 border border-border flex-row items-center justify-between">
          <View className="items-center">
            <Text className="text-white text-2xl font-bold">{leads.length}</Text>
            <Text className="text-muted text-xs mt-0.5">Total Leads</Text>
          </View>
          <View className="w-px h-8 bg-border" />
          <View className="items-center">
            <Text className="text-white text-2xl font-bold">{filteredLeads.length}</Text>
            <Text className="text-muted text-xs mt-0.5">Showing</Text>
          </View>
          <View className="w-px h-8 bg-border" />
          <TouchableOpacity
            onPress={onRefresh}
            className="bg-accent rounded-xl px-4 py-2"
          >
            <Text className="text-white text-sm font-semibold">↻  Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Filter tabs */}
        <View className="flex-row gap-2 mt-4">
          {(['all', 'producer', 'beatmaker', 'sound_engineer'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveFilter(tab)}
              className={`rounded-full px-4 py-2 ${
                activeFilter === tab ? 'bg-accent' : 'bg-card border border-border'
              }`}
            >
              <Text className={`text-xs font-semibold ${
                activeFilter === tab ? 'text-white' : 'text-muted'
              }`}>
                {tab === 'all' ? 'All' : CATEGORY_LABELS[tab as Category]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Lead list */}
      {loading ? (
        <View className="flex-1 items-center justify-center gap-4">
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text className="text-muted text-sm">Finding leads on Threads...</Text>
        </View>
      ) : filteredLeads.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-4">🔍</Text>
          <Text className="text-white text-lg font-semibold text-center mb-2">No leads in this category</Text>
          <Text className="text-muted text-sm text-center leading-6">
            Try a different filter or refresh to look for new posts.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredLeads}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <LeadCard lead={item} />}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#8B5CF6"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

    </View>
  );
}
