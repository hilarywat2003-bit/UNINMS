'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { platformApi } from '@/lib/api';
import { Building2, Users, FileText, Play, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const PLAN_BADGE: Record<string, string> = {
  free: 'badge-stone', basic: 'badge-blue', standard: 'badge-green',
  premium: 'badge-purple', enterprise: 'badge-gold',
};

export default function SuperAdminSettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-settings'],
    queryFn:  () => platformApi.settings(),
  });

  const batchMut = useMutation({
    mutationFn: () => platformApi.batchPlagiarismCheck(),
    onSuccess: (res: any) => toast.success(res?.message ?? 'Batch check started'),
    onError:   (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const d = (data as any)?.data;

  if (isLoading) return (
    <div className="max-w-4xl mx-auto space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-32 skeleton rounded-2xl" />)}
    </div>
  );

  const breakdown: any[] = d?.subscriptionBreakdown ?? [];
  const totals: any      = d?.totals ?? {};

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Platform totals */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Universities', value: totals.total_universities ?? '—', icon: Building2, color: 'bg-primary-50 text-primary-700' },
          { label: 'Total users',  value: parseInt(totals.total_users ?? 0).toLocaleString(),  icon: Users,     color: 'bg-blue-50 text-blue-700' },
          { label: 'Documents',    value: parseInt(totals.total_documents ?? 0).toLocaleString(), icon: FileText,  color: 'bg-purple-50 text-purple-700' },
        ].map(k => (
          <div key={k.label} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wide font-medium">{k.label}</p>
                <p className="text-2xl font-display font-semibold text-stone-900 mt-1">{k.value}</p>
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${k.color}`}>
                <k.icon size={16} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Subscription breakdown */}
      <div className="card p-5">
        <h3 className="font-display font-semibold text-stone-900 mb-4">Subscription breakdown</h3>
        {breakdown.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-6">No subscription data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide py-2">Plan</th>
                  <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide py-2">Status</th>
                  <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wide py-2">Institutions</th>
                  <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wide py-2 hidden sm:table-cell">User capacity</th>
                  <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wide py-2 hidden md:table-cell">Storage (GB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {breakdown.map((r: any) => (
                  <tr key={`${r.plan}-${r.status}`} className="hover:bg-stone-50">
                    <td className="py-2.5">
                      <span className={`badge text-xs ${PLAN_BADGE[r.plan] ?? 'badge-stone'}`}>{r.plan}</span>
                    </td>
                    <td className="py-2.5 text-sm text-stone-600 capitalize">{r.status}</td>
                    <td className="py-2.5 text-right text-sm font-medium text-stone-800">{parseInt(r.university_count)}</td>
                    <td className="py-2.5 text-right text-sm text-stone-600 hidden sm:table-cell">
                      {r.total_user_capacity ? parseInt(r.total_user_capacity).toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 text-right text-sm text-stone-600 hidden md:table-cell">
                      {r.total_storage_gb ? parseInt(r.total_storage_gb).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Plagiarism tools */}
      <div className="card p-5">
        <h3 className="font-display font-semibold text-stone-900 mb-2">Platform plagiarism check</h3>
        <p className="text-sm text-stone-500 mb-4">
          Run a batch plagiarism check across all unchecked documents on the entire platform (up to 500 at once).
        </p>
        <button onClick={() => batchMut.mutate()} disabled={batchMut.isPending} className="btn-secondary">
          {batchMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play size={14} />}
          Start platform-wide batch check
        </button>
      </div>
    </div>
  );
}
