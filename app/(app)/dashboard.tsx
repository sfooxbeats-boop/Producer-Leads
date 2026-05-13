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
import { supabase, getProfile } from '../../lib/supabase';
import { fetchLeadsForCategories, type ThreadsPost } from '../../lib/threads';
import { CATEGORY_LABELS, type Category } from '../../lib/keywords';
import LeadCard from '../../components/LeadCard';

export default function DashboardScreen() {
  const router = useRouter();
  const [leads, setLeads] = useState<ThreadsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads(isRefresh = false) {
    if (!isRefresh) setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUserName(user.user_metadata?.full_name?.split(' ')[0] ?? 'Producer');

    const profile = await getProfile(user.id);
    if (!profile?.categories?.length) {
      setLoading(false);
      return;
    }

    setCategories(profile.categories);

    try {
      const results = await fetchLeadsForCategories(profile.categories);
      setLeads(results);
    } catch (err) {
      setError('Could not load leads. Check your Threads API token in .env');
    }

    setLoading(false);
    setRefreshing(false);
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadLeads(true);
  }, []);

  // Filter leads based on active tab
  const filteredLeads = activeFilter === 'all'
    ? leads
    : leads.filter(l => l.match_tag === CATEGORY_LABELS[activeFilter as Category]?.replace(/ /g, ' ') ||
        l.match_tag.toLowerCase().includes(activeFilter.replace('_', ' ')));

  const filterTabs = ['all', ...categories];

  return (
    <View className="flex-1 bg-bg">

      {/* Header */}
      <View className="px-6 pt-14 pb-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-muted text-sm">Good day,</Text>
            <Text className="text-white text-2xl font-bold">{userName} 👋</Text>
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
            <Text className="text-white text-2xl font-bold">{categories.length}</Text>
            <Text className="text-muted text-xs mt-0.5">Categories</Text>
          </View>
          <View className="w-px h-8 bg-border" />
          <TouchableOpacity
            onPress={onRefresh}
            className="bg-accent rounded-xl px-4 py-2"
          >
            <Text className="text-white text-sm font-semibold">↻  Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Category filter tabs */}
        {categories.length > 1 && (
          <View className="flex-row gap-2 mt-4">
            {filterTabs.map(tab => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveFilter(tab)}
                className={`rounded-full px-4 py-2 ${
                  activeFilter === tab ? 'bg-accent' : 'bg-card border border-border'
                }`}
              >
                <Text className={`text-xs font-semibold capitalize ${
                  activeFilter === tab ? 'text-white' : 'text-muted'
                }`}>
                  {tab === 'all' ? 'All' : CATEGORY_LABELS[tab as Category] ?? tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Lead list */}
      {loading ? (
        <View className="flex-1 items-center justify-center gap-4">
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text className="text-muted text-sm">Searching Threads for leads...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-4">⚠️</Text>
          <Text className="text-white text-lg font-semibold text-center mb-2">API Not Configured</Text>
          <Text className="text-muted text-sm text-center leading-6">{error}</Text>
        </View>
      ) : filteredLeads.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-4">🔍</Text>
          <Text className="text-white text-lg font-semibold text-center mb-2">No leads found right now</Text>
          <Text className="text-muted text-sm text-center leading-6">
            Threads didn't return any matching posts at this moment.{'\n'}Try refreshing in a few minutes.
          </Text>
          <TouchableOpacity onPress={onRefresh} className="mt-6 bg-accent rounded-2xl px-8 py-3">
            <Text className="text-white font-semibold">Refresh Now</Text>
          </TouchableOpacity>
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
