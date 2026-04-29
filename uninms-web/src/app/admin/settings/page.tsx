'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { Settings, Shield, Loader2, Check, Play } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn:  () => adminApi.settings(),
  });

  const settings = (data?.data as any) ?? {};
  const [threshold, setThreshold] = useState<number | ''>('');

  const thresholdMut = useMutation({
    mutationFn: (t: number) => adminApi.setPlagiarismThreshold(t),
    onSuccess: () => {
      toast.success('Plagiarism threshold updated');
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const batchMut = useMutation({
    mutationFn: () => adminApi.batchPlagiarismCheck(),
    onSuccess: (res: any) => {
      toast.success(res?.message ?? 'Batch check started');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const settingsMut = useMutation({
    mutationFn: (d: object) => adminApi.saveSettings(d),
    onSuccess: () => {
      toast.success('Settings saved');
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  if (isLoading) return (
    <div className="max-w-2xl mx-auto space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-32 skeleton rounded-2xl" />)}
    </div>
  );

  const currentThreshold = settings.plagiarism_threshold ?? 0.3;

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Institution info */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings size={16} className="text-stone-500" />
          <h3 className="font-display font-semibold text-stone-900">Institution settings</h3>
        </div>
        {settings.university_name ? (
          <div className="space-y-3">
            <div>
              <label className="label">University name</label>
              <p className="text-sm text-stone-700 bg-stone-50 rounded-xl px-4 py-2.5 border border-stone-100">{settings.university_name}</p>
            </div>
            {settings.domain && (
              <div>
                <label className="label">Domain</label>
                <p className="text-sm text-stone-700 bg-stone-50 rounded-xl px-4 py-2.5 border border-stone-100">{settings.domain}</p>
              </div>
            )}
            {settings.subscription_tier && (
              <div>
                <label className="label">Subscription tier</label>
                <p className="text-sm text-stone-700 bg-stone-50 rounded-xl px-4 py-2.5 border border-stone-100 capitalize">{settings.subscription_tier}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-stone-400 text-center py-6">No institution settings found</p>
        )}
      </div>

      {/* Plagiarism settings */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-stone-500" />
          <h3 className="font-display font-semibold text-stone-900">Plagiarism settings</h3>
        </div>

        <div className="mb-5">
          <label className="label">Similarity threshold</label>
          <p className="text-xs text-stone-400 mb-3">
            Documents with similarity above this threshold are flagged. Current: <strong>{Math.round(currentThreshold * 100)}%</strong>
          </p>
          <div className="flex items-center gap-3">
            <input type="range" min={10} max={90} step={5}
              value={threshold !== '' ? threshold * 100 : currentThreshold * 100}
              onChange={e => setThreshold(parseInt(e.target.value) / 100)}
              className="flex-1 accent-stone-800" />
            <span className="text-sm font-medium text-stone-700 w-12 text-right">
              {threshold !== '' ? Math.round((threshold as number) * 100) : Math.round(currentThreshold * 100)}%
            </span>
            <button
              onClick={() => threshold !== '' && thresholdMut.mutate(threshold as number)}
              disabled={threshold === '' || thresholdMut.isPending}
              className="btn-primary btn-sm">
              {thresholdMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check size={13} />} Save
            </button>
          </div>
        </div>

        <div className="border-t border-stone-100 pt-4">
          <label className="label">Batch plagiarism check</label>
          <p className="text-xs text-stone-400 mb-3">
            Run a plagiarism check on all unchecked documents in your institution (up to 200 at once).
          </p>
          <button onClick={() => batchMut.mutate()} disabled={batchMut.isPending} className="btn-secondary">
            {batchMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play size={14} />}
            Start batch check
          </button>
        </div>
      </div>

      {/* Subscription info */}
      {settings.storage_quota_mb != null && (
        <div className="card p-5">
          <h3 className="font-display font-semibold text-stone-900 mb-3">Storage & quota</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-600">Storage quota</span>
              <span className="text-sm font-medium text-stone-800">{(settings.storage_quota_mb / 1024).toFixed(1)} GB</span>
            </div>
            {settings.max_users != null && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-600">Max users</span>
                <span className="text-sm font-medium text-stone-800">{settings.max_users.toLocaleString()}</span>
              </div>
            )}
            {settings.plagiarism_checks_remaining != null && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-600">Plagiarism checks remaining</span>
                <span className="text-sm font-medium text-stone-800">{settings.plagiarism_checks_remaining.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
