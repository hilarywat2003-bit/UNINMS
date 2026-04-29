import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';
import { searchApi } from '../../src/lib/api';

type SearchResult = {
  id: string;
  type: 'document' | 'forum_thread' | 'course';
  title: string;
  subtitle?: string;
  score?: number;
};

const TYPE_CONFIG: Record<string, { emoji: string; label: string; route: string }> = {
  document:     { emoji: '📄', label: 'Document',  route: '/repository/' },
  forum_thread: { emoji: '💬', label: 'Forum',     route: '/forums/'     },
  course:       { emoji: '📚', label: 'Course',    route: '/courses'     },
};

function ResultCard({ item, onPress }: { item: SearchResult; onPress: () => void }) {
  const { colors } = useTheme();
  const cfg = TYPE_CONFIG[item.type] ?? { emoji: '🔍', label: item.type, route: '/' };
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: colors.card, borderRadius: 12, padding: 14,
        borderWidth: 1, borderColor: colors.border, marginBottom: 10,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}
    >
      <View style={{
        width: 44, height: 44, borderRadius: 10,
        backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 22 }}>{cfg.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={2}>
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
            {item.subtitle}
          </Text>
        ) : null}
        <View style={{
          alignSelf: 'flex-start', backgroundColor: colors.border,
          borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4,
        }}>
          <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '600' }}>
            {cfg.label}
          </Text>
        </View>
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
    </TouchableOpacity>
  );
}

export default function SearchScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState<SearchResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError]       = useState('');

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setError('');
    try {
      const res = await searchApi.fullText(trimmed);
      const raw: any[] = res?.data?.results ?? res?.results ?? [];
      const mapped: SearchResult[] = raw.map((r: any) => ({
        id:       r.id,
        type:     r.type ?? 'document',
        title:    r.title ?? r.name ?? 'Untitled',
        subtitle: r.abstract ?? r.description ?? r.author_name ?? r.lecturer_name,
        score:    r.score,
      }));
      setResults(mapped);
      setSearched(true);
    } catch {
      setError('Search failed. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePress = (item: SearchResult) => {
    const cfg = TYPE_CONFIG[item.type];
    if (!cfg) return;
    if (item.type === 'document')     router.push(`/repository/${item.id}` as any);
    else if (item.type === 'forum_thread') router.push(`/forums/${item.id}` as any);
    // courses don't have a detail page — tab navigates to courses list
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={{
        backgroundColor: colors.primary,
        paddingTop: insets.top + 10, paddingBottom: 16, paddingHorizontal: 16,
      }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 12 }}>
          Search
        </Text>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12,
          paddingHorizontal: 12, paddingVertical: 10,
        }}>
          <Text style={{ fontSize: 16 }}>🔍</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => runSearch(query)}
            placeholder="Search documents, forums, courses..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            returnKeyType="search"
            autoCorrect={false}
            style={{ flex: 1, fontSize: 15, color: '#fff' }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results */}
      <FlatList
        data={results}
        keyExtractor={r => `${r.type}-${r.id}`}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        renderItem={({ item }) => (
          <ResultCard item={item} onPress={() => handlePress(item)} />
        )}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          loading ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={{ color: colors.textMuted, marginTop: 12 }}>Searching...</Text>
            </View>
          ) : error ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <Text style={{ fontSize: 32 }}>⚠️</Text>
              <Text style={{ color: colors.error, marginTop: 12 }}>{error}</Text>
              <TouchableOpacity onPress={() => runSearch(query)} style={{ marginTop: 12 }}>
                <Text style={{ color: colors.primary, fontWeight: '600' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading && !error ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              {searched ? (
                <>
                  <Text style={{ fontSize: 40 }}>🔍</Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 16 }}>
                    No results found
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 8, textAlign: 'center' }}>
                    Try different keywords or check your spelling
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 40 }}>🔍</Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 16 }}>
                    Search everything
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
                    Find documents, forum threads, and courses all in one place
                  </Text>
                </>
              )}
            </View>
          ) : null
        }
      />
    </KeyboardAvoidingView>
  );
}
