'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  BookOpen, CheckCircle2, XCircle, AlertTriangle, Clock, Loader2,
  TrendingUp, CreditCard, Users, Shield, X, Eye, Ban,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active:           { label: 'Active',           cls: 'badge-green' },
  payment_received: { label: 'Awaiting approval',cls: 'badge-blue' },
  pending_payment:  { label: 'Awaiting payment', cls: 'badge-stone' },
  rejected:         { label: 'Rejected',         cls: 'badge-red' },
  suspended:        { label: 'Suspended',        cls: 'badge-red' },
};

function ApprovalModal({ journal, onClose }: { journal: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [rejectMode, setRejectMode] = useState(false);

  const approve = useMutation({
    mutationFn: () => api.post(`/journal-billing/${journal.id}/approve`, { note }).then(r => r.data),
    onSuccess: () => {
      toast.success(`"${journal.title}" approved and activated!`);
      qc.invalidateQueries({ queryKey: ['journal-pending'] });
      qc.invalidateQueries({ queryKey: ['journal-billing-stats'] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Approval failed'),
  });

  const reject = useMutation({
    mutationFn: () => api.post(`/journal-billing/${journal.id}/reject`, { reason: note }).then(r => r.data),
    onSuccess: () => {
      toast.success('Journal rejected');
      qc.invalidateQueries({ queryKey: ['journal-pending'] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Rejection failed'),
  });

  const fmt = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-card-md my-8">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <h3 className="font-display text-lg font-semibold text-stone-900">Review journal application</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100 text-stone-400"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Journal info */}
          <div className="bg-stone-50 rounded-xl p-4 space-y-2">
            <p className="font-semibold text-stone-900">{journal.title}</p>
            <p className="text-xs text-stone-500">{journal.university_name}{journal.department_name ? ` · ${journal.department_name}` : ''}</p>
            {journal.scope && <p className="text-xs text-stone-600 leading-relaxed">{journal.scope}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              {journal.issn_online && <span className="font-mono text-xs badge-stone badge">ISSN {journal.issn_online}</span>}
              <span className="badge-stone badge text-xs capitalize">{journal.frequency}</span>
              <span className="badge-stone badge text-xs capitalize">{journal.review_type?.replace('_',' ')}</span>
              {journal.is_open_access && <span className="badge-green badge text-xs">Open Access</span>}
            </div>
          </div>

          {/* Payment info */}
          {journal.paid_amount && (
            <div className="bg-primary-50 rounded-xl p-4 border border-primary-100">
              <p className="text-xs font-semibold text-primary-700 mb-2 flex items-center gap-1.5">
                <CreditCard size={12} /> Payment confirmed
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-stone-500">Plan</span><p className="font-medium text-stone-900">{journal.plan_name}</p></div>
                <div><span className="text-stone-500">Amount</span><p className="font-bold text-stone-900">{fmt(journal.paid_amount)}</p></div>
                <div><span className="text-stone-500">Paid by</span><p className="font-medium text-stone-900">{journal.paid_by_name}</p></div>
                <div><span className="text-stone-500">Paid</span><p className="font-medium text-stone-900">{journal.paid_at ? formatDistanceToNow(new Date(journal.paid_at), { addSuffix: true }) : '—'}</p></div>
                <div className="col-span-2"><span className="text-stone-500">Reference</span><p className="font-mono text-stone-700 break-all">{journal.paystack_ref}</p></div>
              </div>
            </div>
          )}

          {/* Action note */}
          <div>
            <label className="label">{rejectMode ? 'Rejection reason *' : 'Note (optional)'}</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              placeholder={rejectMode ? 'Provide a clear reason for rejection…' : 'Optional note to include with approval…'}
              className="input resize-none" />
          </div>

          {/* Buttons */}
          {!rejectMode ? (
            <div className="flex gap-3">
              <button onClick={() => setRejectMode(true)} className="btn-secondary flex-1 text-red-600">
                <XCircle size={14} /> Reject
              </button>
              <button onClick={() => approve.mutate()} disabled={approve.isPending}
                className="btn-primary flex-1 bg-primary-700">
                {approve.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 size={14} />}
                Approve & activate
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-red-600 bg-red-50 rounded-lg p-3 border border-red-200">
                The IT admin will see this reason. Their payment will need to be reviewed separately.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setRejectMode(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => reject.mutate()} disabled={!note || reject.isPending}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {reject.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle size={14} />}
                  Confirm rejection
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminJournalsPage() {
  const qc = useQueryClient();
  const [reviewing, setReviewing] = useState<any>(null);
  const [tab, setTab] = useState<'pending' | 'all' | 'stats'>('pending');

  const { data: statsData } = useQuery({
    queryKey: ['journal-billing-stats'],
    queryFn:  () => api.get('/journal-billing/stats').then(r => r.data.data),
  });

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['journal-pending'],
    queryFn:  () => api.get('/journal-billing/pending').then(r => r.data.data),
    enabled:  tab === 'pending',
    refetchInterval: 30000,
  });

  const { data: allData, isLoading: allLoading } = useQuery({
    queryKey: ['journal-all'],
    queryFn:  () => api.get('/journal-billing/all').then(r => r.data.data),
    enabled:  tab === 'all',
  });

  const suspend = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/journal-billing/${id}/suspend`, { reason }).then(r => r.data),
    onSuccess: () => { toast.success('Journal suspended'); qc.invalidateQueries({ queryKey: ['journal-all'] }); },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const st = statsData;
  const fmt = (n: number | string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(n));
  const pending  = pendingData ?? [];
  const allJournals = allData ?? [];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-semibold text-stone-900">Journal subscriptions</h1>
          <p className="text-stone-500 text-sm mt-0.5">Approve journal applications and manage billing</p>
        </div>
        {st?.totals?.pending_approval > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl">
            <AlertTriangle size={14} className="text-blue-600" />
            <span className="text-sm font-medium text-blue-800">
              {st.totals.pending_approval} pending approval{st.totals.pending_approval > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Stats cards */}
      {st && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Active journals',    value: st.totals?.active_journals,   icon: BookOpen,    cls: 'text-primary-700 bg-primary-50' },
            { label: 'Pending approval',   value: st.totals?.pending_approval,  icon: Clock,       cls: 'text-blue-700 bg-blue-50' },
            { label: 'Total revenue',      value: fmt(st.revenue?.total_revenue||0), icon: CreditCard, cls: 'text-gold-700 bg-gold-50' },
            { label: 'This month',         value: fmt(st.revenue?.this_month||0),    icon: TrendingUp, cls: 'text-primary-700 bg-primary-50' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-stone-500 uppercase tracking-wide">{s.label}</p>
                  <p className="text-xl font-display font-semibold text-stone-900 mt-1">{s.value}</p>
                </div>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.cls}`}>
                  <s.icon size={16} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {([
          { key: 'pending', label: `Pending (${st?.totals?.pending_approval ?? 0})` },
          { key: 'all',     label: 'All journals' },
          { key: 'stats',   label: 'Revenue' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={clsx('px-4 py-2 rounded-xl text-sm font-medium transition-all',
              tab===t.key ? 'bg-primary-800 text-white' : 'text-stone-600 hover:bg-stone-100')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Pending tab */}
      {tab === 'pending' && (
        pendingLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
        ) : pending.length === 0 ? (
          <div className="card p-16 text-center">
            <CheckCircle2 size={40} className="mx-auto mb-3 text-stone-300" />
            <h3 className="font-display font-semibold text-stone-700 mb-1">No pending applications</h3>
            <p className="text-stone-400 text-sm">All journal applications have been processed.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((j: any) => {
              const hasPaid = j.subscription_status === 'payment_received';
              return (
                <div key={j.id} className={clsx('card p-5', hasPaid && 'border-l-4 border-l-blue-400')}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                        <BookOpen size={18} className="text-primary-700" />
                      </div>
                      <div>
                        <h3 className="font-medium text-stone-900">{j.title}</h3>
                        <p className="text-xs text-stone-500 mt-0.5">{j.university_name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className={`badge text-xs ${STATUS_META[j.subscription_status]?.cls ?? 'badge-stone'}`}>
                            {STATUS_META[j.subscription_status]?.label ?? j.subscription_status}
                          </span>
                          {j.plan_name && <span className="badge-stone badge text-xs">{j.plan_name}</span>}
                          {j.paid_amount && (
                            <span className="text-xs font-medium text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-200">
                              {fmt(j.paid_amount)} paid
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      {hasPaid && (
                        <button onClick={() => setReviewing(j)} className="btn-primary btn-sm">
                          <Eye size={13} /> Review
                        </button>
                      )}
                      {j.subscription_status === 'pending_payment' && (
                        <span className="text-xs text-stone-400 italic self-center">Awaiting payment</span>
                      )}
                    </div>
                  </div>

                  {j.scope && (
                    <p className="text-xs text-stone-500 mt-3 line-clamp-2 leading-relaxed pl-15">{j.scope}</p>
                  )}

                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-stone-100 text-xs text-stone-400">
                    <span>Created {formatDistanceToNow(new Date(j.created_at), { addSuffix: true })}</span>
                    {j.paid_at && <span>· Paid {formatDistanceToNow(new Date(j.paid_at), { addSuffix: true })}</span>}
                    {j.paid_by_name && <span>· By {j.paid_by_name}</span>}
                    {j.billing_cycle && <span>· {j.billing_cycle} billing</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* All journals tab */}
      {tab === 'all' && (
        allLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  {['Journal','University','Plan','Paid','Status','Expires','Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {allJournals.map((j: any) => (
                  <tr key={j.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-stone-900 max-w-[180px] truncate">{j.title}</p>
                      <p className="text-xs text-stone-400">{j.slug}</p>
                    </td>
                    <td className="px-4 py-3"><p className="text-xs text-stone-600 max-w-[140px] truncate">{j.university_name}</p></td>
                    <td className="px-4 py-3"><p className="text-xs text-stone-700">{j.plan_name ?? '—'}</p></td>
                    <td className="px-4 py-3"><p className="text-xs text-stone-700">{j.paid_amount ? fmt(j.paid_amount) : '—'}</p></td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${STATUS_META[j.subscription_status]?.cls ?? 'badge-stone'}`}>
                        {STATUS_META[j.subscription_status]?.label ?? j.subscription_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-stone-500">
                        {j.expires_at ? new Date(j.expires_at).toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' }) : '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {j.subscription_status === 'active' && (
                        <button onClick={() => suspend.mutate({ id: j.id, reason: 'Suspended by admin' })}
                          className="btn-ghost btn-sm text-red-600 text-xs">
                          <Ban size={12} /> Suspend
                        </button>
                      )}
                      {j.subscription_status === 'payment_received' && (
                        <button onClick={() => setReviewing(j)} className="btn-ghost btn-sm text-xs">
                          <Eye size={12} /> Review
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Revenue tab */}
      {tab === 'stats' && st && (
        <div className="space-y-5">
          <div className="grid md:grid-cols-3 gap-4">
            {st.byPlan?.map((p: any) => (
              <div key={p.slug} className="card p-5">
                <p className="font-display font-semibold text-stone-900">{p.name}</p>
                <p className="text-3xl font-display font-bold text-primary-700 mt-2">{fmt(p.revenue)}</p>
                <p className="text-sm text-stone-500 mt-1">{p.journal_count} journal{p.journal_count !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>

          {st.recent?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100">
                <h3 className="font-display font-semibold text-stone-900">Recent payments</h3>
              </div>
              <table className="w-full">
                <thead className="bg-stone-50 border-b border-stone-100">
                  <tr>
                    {['Journal','Plan','Amount','Paid by','Date','Reference'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {st.recent.map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-stone-50">
                      <td className="px-4 py-3 text-sm text-stone-900 max-w-[160px] truncate">{p.journal_title}</td>
                      <td className="px-4 py-3 text-sm text-stone-700">{p.plan_name}</td>
                      <td className="px-4 py-3 text-sm font-bold text-stone-900">{fmt(p.amount)}</td>
                      <td className="px-4 py-3 text-sm text-stone-700">{p.paid_by}</td>
                      <td className="px-4 py-3 text-xs text-stone-500">
                        {p.paid_at ? formatDistanceToNow(new Date(p.paid_at), { addSuffix: true }) : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-stone-400 max-w-[120px] truncate">{p.paystack_ref}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {reviewing && <ApprovalModal journal={reviewing} onClose={() => setReviewing(null)} />}
    </div>
  );
}
