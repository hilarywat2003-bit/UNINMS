import { useState } from 'react';
import {
  FlatList, View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useToast } from '../../../src/components/Toast';
import { timeAgo } from '../../../src/utils/timeAgo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/ThemeContext';
import { forumsApi } from '../../../src/lib/api';

export default function ThreadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [reply, setReply] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['forums', 'thread', id],
    queryFn: () => forumsApi.thread(id),
  });
  const data = res?.data ?? res;

  const postReply = useMutation({
    mutationFn: () => forumsApi.reply(id, { content: reply }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['forums', 'thread', id] });
      setReply('');
      toast.show('Reply posted!');
    },
    onError: () => toast.show('Could not post reply', 'error'),
  });

  const upvote = useMutation({
    mutationFn: (postId: string) => forumsApi.upvote(postId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forums', 'thread', id] }),
  });

  const allPosts: any[] = data?.posts ?? [];
  // First post is the thread body; remaining are replies
  const firstPost = allPosts[0];
  const posts = allPosts.slice(1);

  const renderPost = ({ item }: { item: any }) => (
    <View style={{
      marginHorizontal: 16, marginBottom: 12,
      backgroundColor: colors.card, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: colors.border,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <View style={{
          width: 32, height: 32, borderRadius: 16,
          backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '700' }}>
            {(item.author?.name ?? 'A')[0].toUpperCase()}
          </Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{item.author_name ?? 'Anonymous'}</Text>
        <Text style={{ fontSize: 12, color: colors.textMuted, flex: 1, textAlign: 'right' }}>
          {timeAgo(item.created_at)}
        </Text>
      </View>
      <Text style={{ fontSize: 14, color: colors.text, lineHeight: 21 }}>{item.content}</Text>
      <TouchableOpacity
        onPress={() => upvote.mutate(item.id)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 }}
      >
        <Text style={{ fontSize: 13 }}>👍</Text>
        <Text style={{ fontSize: 13, color: colors.textMuted }}>{item.upvote_count ?? 0}</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={{
        backgroundColor: colors.primary,
        paddingTop: insets.top + 8, paddingBottom: 16, paddingHorizontal: 16,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#fff', fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 }} numberOfLines={1}>
          {data?.title}
        </Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={i => i.id}
        renderItem={renderPost}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 16 }}
        ListHeaderComponent={
          <View style={{
            marginHorizontal: 16, marginBottom: 16,
            backgroundColor: colors.primaryLight, borderRadius: 12, padding: 16,
            borderWidth: 1, borderColor: colors.primary + '30',
          }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 }}>
              {data?.title}
            </Text>
            {firstPost?.content ? (
              <Text style={{ fontSize: 14, color: colors.text, lineHeight: 21 }}>{firstPost.content}</Text>
            ) : null}
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>
              👤 {data?.author_name ?? 'Anonymous'} · {posts.length} {posts.length === 1 ? 'reply' : 'replies'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Text style={{ fontSize: 14, color: colors.textMuted }}>No replies yet. Be the first!</Text>
          </View>
        }
      />

      {/* Reply input */}
      <View style={{
        backgroundColor: colors.surface, paddingHorizontal: 12,
        paddingVertical: 10, paddingBottom: insets.bottom + 10,
        borderTopWidth: 1, borderTopColor: colors.border,
        flexDirection: 'row', alignItems: 'flex-end', gap: 8,
      }}>
        <TextInput
          value={reply}
          onChangeText={setReply}
          placeholder="Write a reply..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={2000}
          style={{
            flex: 1, backgroundColor: colors.background,
            borderWidth: 1, borderColor: colors.border,
            borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
            fontSize: 14, color: colors.text, maxHeight: 100,
          }}
        />
        <TouchableOpacity
          onPress={() => postReply.mutate()}
          disabled={!reply.trim() || postReply.isPending}
          style={{
            backgroundColor: reply.trim() ? colors.primary : colors.border,
            borderRadius: 10, width: 40, height: 40,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 18 }}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
