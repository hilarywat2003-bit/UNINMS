import { useRef } from 'react';
import {
  FlatList, View, Text, TouchableOpacity, RefreshControl,
  Animated, PanResponder,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { useToast } from '../../src/components/Toast';
import { SkeletonNotifItem } from '../../src/components/Skeleton';
import { timeAgo } from '../../src/utils/timeAgo';
import { notificationsApi } from '../../src/lib/api';

// ── Event label map ───────────────────────────────────────────────────────────
const EVENT_LABELS: Record<string, string> = {
  'document.approved':       '✅ Your document was approved',
  'document.rejected':       '❌ Your document was rejected',
  'document.flagged':        '🚩 Your document was flagged',
  'forum.reply':             '💬 Someone replied to your thread',
  'forum.upvote':            '👍 Your post was upvoted',
  'assignment.created':      '📝 New assignment posted',
  'assignment.due_soon':     '⏰ Assignment due soon',
  'course.material_added':   '📚 New course material added',
  'research.member_added':   '🔬 You were added to a research project',
  'research.milestone_done': '🏁 A milestone was completed',
  'fpic.approved':           '✅ Your FPIC request was approved',
  'fpic.rejected':           '❌ Your FPIC request was rejected',
  'fpic.revoked':            '🚫 Your FPIC access was revoked',
  'points.earned':           '⭐ You earned points',
};

function formatNotif(item: any): string {
  const label = EVENT_LABELS[item.event_type];
  if (label) {
    const p = item.payload ?? {};
    if (item.event_type === 'document.rejected' && p.reason) return `${label}: "${p.reason}"`;
    return label;
  }
  return item.event_type?.replace(/[._]/g, ' ') ?? 'New notification';
}

// ── Swipeable row ─────────────────────────────────────────────────────────────
const SWIPE_THRESHOLD = 72;
const ACTION_WIDTH    = 80;

function SwipeableNotifItem({ item, onMarkRead }: { item: any; onMarkRead: () => void }) {
  const { colors } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const unread = !item.is_read;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        unread && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(Math.max(g.dx, -ACTION_WIDTH - 10));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -SWIPE_THRESHOLD) {
          // Snap open → mark read → snap back
          Animated.spring(translateX, { toValue: -ACTION_WIDTH, useNativeDriver: true }).start();
          setTimeout(() => {
            onMarkRead();
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          }, 300);
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <View style={{ overflow: 'hidden' }}>
      {/* Action revealed underneath */}
      {unread && (
        <View style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: ACTION_WIDTH,
          backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 20, color: '#fff' }}>✓</Text>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 2 }}>Read</Text>
        </View>
      )}

      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...(unread ? panResponder.panHandlers : {})}
      >
        <TouchableOpacity
          onPress={unread ? onMarkRead : undefined}
          activeOpacity={unread ? 0.75 : 1}
          style={{
            backgroundColor: unread ? colors.primaryLight : colors.card,
            borderBottomWidth: 1, borderBottomColor: colors.border,
            paddingHorizontal: 16, paddingVertical: 14,
            flexDirection: 'row', alignItems: 'flex-start', gap: 12,
          }}
        >
          <View style={{
            width: 10, height: 10, borderRadius: 5, marginTop: 5,
            backgroundColor: unread ? colors.primary : colors.border,
          }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>
              {formatNotif(item)}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
              {timeAgo(item.sent_at)}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const toast = useToast();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ limit: 50 }),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: notificationsApi.readAll,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.show('All notifications marked as read');
    },
  });

  const items: any[] = data?.data?.notifications ?? [];
  const hasUnread = items.some(n => !n.is_read);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{
        backgroundColor: colors.surface,
        paddingTop: insets.top + 12, paddingBottom: 12, paddingHorizontal: 16,
        borderBottomWidth: 1, borderBottomColor: colors.border,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>Notifications</Text>
        {hasUnread && (
          <TouchableOpacity onPress={() => markAll.mutate()} disabled={markAll.isPending}>
            <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>
              {markAll.isPending ? 'Marking…' : 'Mark all read'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonNotifItem key={i} />)}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <SwipeableNotifItem
              item={item}
              onMarkRead={() => markRead.mutate(item.id)}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 80 }}>
              <Text style={{ fontSize: 48 }}>🔔</Text>
              <Text style={{ fontSize: 16, color: colors.textMuted, marginTop: 12 }}>
                No notifications yet
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
