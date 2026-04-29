'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications','all'],
    queryFn:  () => notificationsApi.list({ limit: 50 }),
    refetchInterval: 30000,
  });

  const notifications  = (data?.data as any)?.notifications ?? [];
  const unreadCount    = (data?.data as any)?.unreadCount ?? 0;

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.readAll(),
    onSuccess: () => { toast.success('All marked as read'); qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });

  const getMessage = (n: any) => {
    const p = n.payload ?? {};
    switch (n.event_type) {
      case 'level_up':          return `You reached ${p.newLevel} with ${p.totalPoints} points`;
      case 'forum_reply':       return 'Someone replied to your forum thread';
      case 'mentorship_request':return 'A student has requested you as their mentor';
      case 'submission_graded': return `Your submission was graded${p.grade ? `: ${p.grade}` : ''}`;
      default:                  return n.event_type.replace(/_/g,' ');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        {unreadCount > 0 && <p className="text-sm text-stone-500">{unreadCount} unread</p>}
        {unreadCount > 0 && (
          <button onClick={() => markAll.mutate()} disabled={markAll.isPending}
            className="btn-ghost btn-sm">
            {markAll.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck size={14} />}
            Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_,i) => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
      ) : notifications.length === 0 ? (
        <div className="card p-16 text-center">
          <Bell size={40} className="mx-auto mb-3 text-stone-300" />
          <h3 className="font-display font-semibold text-stone-700 mb-1">All caught up</h3>
          <p className="text-stone-400 text-sm">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any) => (
            <div key={n.id} onClick={() => !n.is_read && markRead.mutate(n.id)}
              className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all
                ${n.is_read ? 'bg-white border-stone-100 hover:bg-stone-50' : 'bg-primary-50/40 border-primary-100 hover:bg-primary-50'}`}>
              <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-primary-600"
                style={{ opacity: n.is_read ? 0 : 1 }} />
              <div className="flex-1">
                <p className={`text-sm ${n.is_read ? 'text-stone-600' : 'text-stone-900 font-medium'}`}>
                  {getMessage(n)}
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  {formatDistanceToNow(new Date(n.sent_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
