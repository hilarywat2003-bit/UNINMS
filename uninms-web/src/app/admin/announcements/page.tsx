'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { Bell, Plus, Trash2, X, Loader2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

function CreateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', body: '', expiresAt: '' });

  const mutation = useMutation({
    mutationFn: () => adminApi.createAnnouncement({
      title: form.title.trim(),
      body:  form.body.trim(),
      expiresAt: form.expiresAt || undefined,
    }),
    onSuccess: () => {
      toast.success('Announcement published');
      qc.invalidateQueries({ queryKey: ['admin-announcements'] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card-md w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-xl font-semibold text-stone-900">New announcement</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input value={form.title} onChange={set('title')} placeholder="e.g. System maintenance scheduled" className="input" autoFocus />
          </div>
          <div>
            <label className="label">Message *</label>
            <textarea value={form.body} onChange={set('body')} rows={5} className="input resize-none"
              placeholder="Write the full announcement message here…" />
          </div>
          <div>
            <label className="label">Expires at (optional)</label>
            <input type="datetime-local" value={form.expiresAt} onChange={set('expiresAt')} className="input" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => mutation.mutate()}
            disabled={!form.title.trim() || !form.body.trim() || mutation.isPending}
            className="btn-primary flex-1">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell size={14} />} Publish
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAnnouncementsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn:  () => adminApi.announcements(),
  });

  const announcements = (data?.data as any[]) ?? [];

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteAnnouncement(id),
    onSuccess: () => {
      toast.success('Announcement deleted');
      qc.invalidateQueries({ queryKey: ['admin-announcements'] });
    },
    onError: () => toast.error('Failed to delete'),
  });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <p className="text-stone-500 text-sm">{announcements.length} announcement{announcements.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={14} /> New announcement
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 skeleton rounded-2xl" />)}</div>
      ) : announcements.length === 0 ? (
        <div className="card p-16 text-center">
          <Bell size={40} className="mx-auto mb-3 text-stone-300" />
          <h3 className="font-display font-semibold text-stone-700 mb-1">No announcements</h3>
          <p className="text-stone-400 text-sm mb-4">Create one to notify all users.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={14} /> Create announcement
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a: any) => {
            const isExpired = a.expires_at && new Date(a.expires_at) < new Date();
            return (
              <div key={a.id} className={`card p-5 ${isExpired ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${a.is_active && !isExpired ? 'bg-blue-50' : 'bg-stone-100'}`}>
                    <Bell size={16} className={a.is_active && !isExpired ? 'text-blue-600' : 'text-stone-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-stone-900">{a.title}</p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          By {a.author_name} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                          {isExpired && ' · Expired'}
                          {a.expires_at && !isExpired && ` · Expires ${formatDistanceToNow(new Date(a.expires_at), { addSuffix: true })}`}
                        </p>
                      </div>
                      <button onClick={() => deleteMut.mutate(a.id)}
                        disabled={deleteMut.isPending}
                        className="p-1.5 text-stone-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <p className="text-sm text-stone-600 mt-2 whitespace-pre-wrap">{a.body}</p>
                    {isExpired && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-stone-400">
                        <AlertCircle size={11} /> This announcement has expired and is no longer shown to users
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
