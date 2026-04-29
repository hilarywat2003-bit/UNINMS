import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

export function useNotificationBadge(): number {
  const { isAuthenticated } = useAuthStore();
  const { data } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.list({ unread: true, limit: 1 }),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });
  return data?.unreadCount ?? data?.total ?? 0;
}
