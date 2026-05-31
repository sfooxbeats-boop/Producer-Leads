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
import { fetchLeadsFromDatabase, type Lead } from '../../lib/threads';
import LeadCard from '../../components/LeadCard';

type PlatformFilter = 'all' | 'threads' | 'instagram';

export default function DashboardScreen() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<PlatformFilter>('all');

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads(isRefresh = false) {
    if (!isRefresh) setLoading(true);
    try {
      const results = await fetchLeadsFromDatabase();
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

  const filteredLeads = activeFilter === 'all'
    ? leads
    : leads.filter(lead => lead.platform === activeFilter);

  const filters: { key: PlatformFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'threads', label: '🧵 Threads' },
    { key: 'instagram', label: '📸 Instagram' },
  ];

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

        {/* Platform filter tabs */}
        <View className="flex-row gap-2 mt-4">
          {filters.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              onPress={() => setActiveFilter(key)}
              className={`rounded-full px-4 py-2 ${
                activeFilter === key ? 'bg-accent' : 'bg-card border border-border'
              }`}
            >
              <Text className={`text-xs font-semibold ${
                activeFilter === key ? 'text-white' : 'text-muted'
              }`}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Lead list */}
      {loading ? (
        <View className="flex-1 items-center justify-center gap-4">
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text className="text-muted text-sm">Loading leads...</Text>
        </View>
      ) : filteredLeads.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-4">🔍</Text>
          <Text className="text-white text-lg font-semibold text-center mb-2">No leads yet</Text>
          <Text className="text-muted text-sm text-center leading-6">
            Leads will appear here once Apify runs its first daily search. You'll also get them straight to Telegram.
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
