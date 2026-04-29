import { useState } from 'react';
import {
  FlatList, View, Text, TouchableOpacity,
  RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/ThemeContext';
import { useToast } from '../../../src/components/Toast';
import { SkeletonThreadCard } from '../../../src/components/Skeleton';
import { timeAgo } from '../../../src/utils/timeAgo';
import { forumsApi } from '../../../src/lib/api';

function ThreadCard({ item }: { item: any }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push(`/(tabs)/forums/${item.id}`)}
      style={{
        backgroundColor: colors.card, marginHorizontal: 16, marginBottom: 10,
        borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 6 }} numberOfLines={2}>
        {item.title}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 12, color: colors.textMuted }}>
          👤 {item.author_name ?? 'Anonymous'}
        </Text>
        <Text style={{ fontSize: 12, color: colors.textMuted }}>
          💬 {item.post_count ?? 0} replies
        </Text>
        {item.category ? (
          <Text style={{ fontSize: 12, color: colors.textMuted }}>🏷 {item.category}</Text>
        ) : null}
        <Text style={{ fontSize: 12, color: colors.textMuted, marginLeft: 'auto' }}>
          {timeAgo(item.created_at)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ForumsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['forums', 'threads'],
    queryFn: () => forumsApi.threads({ limit: 30 }),
  });

  const createThread = useMutation({
    mutationFn: () => forumsApi.createThread({ title, content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['forums'] });
      setShowCreate(false);
      setTitle('');
      setContent('');
      toast.show('Thread posted!');
    },
    onError: () => toast.show('Could not create thread', 'error'),
  });

  const threads: any[] = data?.data?.threads ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{
        backgroundColor: colors.primary,
        paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>Forums</Text>
        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
        >
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>+ New</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ paddingTop: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonThreadCard key={i} />)}
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={i => i.id}
          renderItem={({ item }) => <ThreadCard item={item} />}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 40 }}>💬</Text>
              <Text style={{ fontSize: 16, color: colors.textMuted, marginTop: 12 }}>No threads yet</Text>
            </View>
          }
        />
      )}

      {/* Create Thread Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: colors.background }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{
            paddingTop: 20, paddingHorizontal: 16, paddingBottom: 12,
            borderBottomWidth: 1, borderBottomColor: colors.border,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <TouchableOpacity onPress={() => { setShowCreate(false); setTitle(''); setContent(''); }}>
              <Text style={{ fontSize: 15, color: colors.error }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>New Thread</Text>
            <TouchableOpacity onPress={() => createThread.mutate()} disabled={!title.trim() || createThread.isPending}>
              <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '700', opacity: !title.trim() ? 0.4 : 1 }}>
                {createThread.isPending ? 'Posting…' : 'Post'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16, gap: 16 }}>
            <TextInput
              value={title} onChangeText={setTitle}
              placeholder="Thread title"
              placeholderTextColor={colors.textMuted}
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 15, color: colors.text }}
            />
            <TextInput
              value={content} onChangeText={setContent}
              placeholder="What's on your mind?"
              placeholderTextColor={colors.textMuted}
              multiline numberOfLines={6} textAlignVertical="top"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 14, color: colors.text, minHeight: 140 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
