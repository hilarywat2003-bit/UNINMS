'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CheckCircle2, XCircle, Clock, Shield, BookOpen, CreditCard,
  Loader2, BarChart3, TrendingUp, Users, Building2, ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string,string> = {
    pending_approval: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    active:           'bg-primary-50 text-primary-700 border-primary-200',
    cancelled:        'bg-red-50 text-red-700 border-red-200',
    expired:          'bg-stone-100 text-stone-500 border-stone-200',
    pending_payment:  'bg-blue-50 text-blue-700 border-blue-200',
  };
  const labels: Record<string,string> = {
    pending_approval: 'Awaiting approval',
    active:           'Active',
    cancelled:        'Rejected',
    expired:          'Expired',
    pending_payment:  'Payment pending',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full border text-xs font-medium ${map[status] ?? map.pending_payment}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ── Approve / Reject modal ─────────────────────────────────────────────────────
function DecisionModal({ sub, action, onClose }: { sub: any; action: 'approve'|'reject'; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () => action === 'approve'
      ? api.post(`/journal-billing/admin/approve/${sub.id}`, { notes })
      : api.post(`/journal-billing/admin/reject/${sub.id}`, { reason }),
    onSuccess: () => {
      toast.success(action === 'approve' ? '✅ Journal subscription approved and activated!' : 'Subscription rejected.');
      qc.invalidateQueries({ queryKey: ['superadmin-journal-subs'] });
      qc.invalidateQueries({ queryKey: ['superadmin-journal-stats'] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Action failed'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-card-md">
        <div className="p-6">
          <h3 className="font-display text-lg font-semibold text-stone-900 mb-1">
            {action === 'approve' ? 'Approve subscription' : 'Reject subscription'}
          </h3>
          <p className="text-sm text-stone-500 mb-4">{sub.journal_title}</p>

          {/* Summary */}
          <div className="bg-stone-50 rounded-xl p-4 mb-4 space-y-2">
            {[
              { label: 'University',  value: sub.university_name },
              { label: 'Plan',        value: sub.plan_name },
              { label: 'Amount',      value: sub.amount_paid ? `₦${parseInt(sub.amount_paid).toLocaleString()}` : '—' },
              { label: 'IT Admin',    value: sub.admin_name },
              { label: 'Payment ref', value: sub.paystack_ref || '—' },
            ].map(f => (
              <div key={f.label} className="flex justify-between text-sm">
                <span className="text-stone-500">{f.label}</span>
                <span className="font-medium text-stone-800">{f.value}</span>
              </div>
            ))}
          </div>

          {sub.payment_proof_url && (
            <a href={sub.payment_proof_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary-700 text-sm hover:underline mb-4">
              <ExternalLink size={13} /> View payment proof
            </a>
          )}

          {action === 'approve' ? (
            <div>
              <label className="label">Internal notes <span className="text-stone-400 font-normal">(optional)</span></label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="Any internal notes about this approval…"
                className="input resize-none" />
            </div>
          ) : (
            <div>
              <label className="label">Rejection reason <span className="text-red-500">*</span></label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                placeholder="Explain why the subscription is being rejected (this will be shown to the IT admin)…"
                className="input resize-none" />
            </div>
          )}

          <div className="flex gap-3 mt-5">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => mutation.mutate()}
              disabled={mutation.isPending || (action === 'reject' && !reason)}
              className={`flex-1 ${action === 'approve' ? 'btn-primary' : 'btn bg-red-600 text-white hover:bg-red-700'}`}>
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> :
                action === 'approve' ? <><CheckCircle2 size={14} /> Approve & activate</> : <><XCircle size={14} /> Reject</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SuperAdminJournalsPage() {
  const [statusFilter, setStatusFilter] = useState('pending_approval');
  const [modal, setModal] = useState<{ sub: any; action: 'approve'|'reject' } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-journal-subs', statusFilter],
    queryFn: () => api.get('/journal-billing/admin/pending', { params: { status: statusFilter } }).then(r => r.data.data),
    refetchInterval: 30000,
  });

  const { data: statsData } = useQuery({
    queryKey: ['superadmin-journal-stats'],
    queryFn: () => api.get('/journal-billing/admin/stats').then(r => r.data.data),
  });

  const subs   = data?.subscriptions ?? [];
  const counts = data?.counts ?? {};
  const stats  = statsData?.overview;

  const STATUS_TABS = [
    { key: 'pending_approval', label: 'Pending approval' },
    { key: 'active',           label: 'Active' },
    { key: 'pending_payment',  label: 'Awaiting payment' },
    { key: 'cancelled',        label: 'Rejected' },
    { key: 'expired',          label: 'Expired' },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">Journal Subscriptions</h1>
          <p className="text-stone-500 text-sm mt-1">Review and approve journal subscription requests from university IT admins.</p>
        </div>
      </div>

      {/* Revenue stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { icon: BookOpen,  label: 'Active journals',     value: stats.active_count,     color: 'text-primary-700 bg-primary-50' },
            { icon: Clock,     label: 'Pending approval',    value: counts.pending_approval || 0, color: 'text-yellow-700 bg-yellow-50' },
            { icon: TrendingUp,label: 'Annual revenue (ARR)', value: `₦${parseInt(stats.total_arr||0).toLocaleString()}`, color: 'text-green-700 bg-green-50' },
            { icon: Building2, label: 'Universities',         value: stats.universities_count, color: 'text-blue-700 bg-blue-50' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wide">{s.label}</p>
                  <p className="text-2xl font-display font-semibold text-stone-900 mt-0.5">{s.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                  <s.icon size={18} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Revenue by plan */}
      {statsData?.byPlan?.length > 0 && (
        <div className="card p-4 mb-6">
          <h3 className="font-display font-semibold text-stone-900 text-sm mb-3">Active subscriptions by plan</h3>
          <div className="flex flex-wrap gap-3">
            {statsData.byPlan.map((p: any) => (
              <div key={p.plan} className="bg-stone-50 rounded-xl px-4 py-2 text-center">
                <p className="text-xs text-stone-500">{p.plan}</p>
                <p className="font-semibold text-stone-900">{p.count} journals</p>
                <p className="text-xs text-primary-700">₦{parseInt(p.revenue).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {STATUS_TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setStatusFilter(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all
              ${statusFilter===key ? 'bg-primary-800 text-white border-primary-800' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'}`}>
            {label}
            {counts[key] > 0 && (
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs font-bold
                ${statusFilter===key ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'}`}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Subscriptions list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
      ) : subs.length === 0 ? (
        <div className="card p-16 text-center">
          <Shield size={36} className="mx-auto mb-3 text-stone-300" />
          <p className="text-stone-400 text-sm">No subscriptions in this category</p>
        </div>
      ) : (
        <div className="space-y-4">
          {subs.map((sub: any) => (
            <div key={sub.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <BookOpen size={18} className="text-primary-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-medium text-stone-900 text-sm">{sub.journal_title}</h3>
                      <StatusBadge status={sub.status} />
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-stone-500">
                      <span className="flex items-center gap-1"><Building2 size={10} />{sub.university_name}</span>
                      <span className="flex items-center gap-1"><CreditCard size={10} />{sub.plan_name} — ₦{parseInt(sub.amount_paid||0).toLocaleString()}</span>
                      <span className="flex items-center gap-1"><Users size={10} />{sub.admin_name}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-stone-400 mt-1">
                      <span>Applied {formatDistanceToNow(new Date(sub.created_at), { addSuffix: true })}</span>
                      {sub.payment_date && <span>· Paid {formatDistanceToNow(new Date(sub.payment_date), { addSuffix: true })}</span>}
                      {sub.paystack_ref && <span className="font-mono">· Ref: {sub.paystack_ref}</span>}
                      {sub.expires_at && <span>· Expires {new Date(sub.expires_at).toLocaleDateString()}</span>}
                    </div>
                    {sub.payment_proof_url && (
                      <a href={sub.payment_proof_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary-700 hover:underline flex items-center gap-1 mt-1">
                        <ExternalLink size={10} /> View payment proof
                      </a>
                    )}
                    {sub.rejection_reason && (
                      <p className="text-xs text-red-600 mt-1">Rejection: {sub.rejection_reason}</p>
                    )}
                  </div>
                </div>

                {sub.status === 'pending_approval' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => setModal({ sub, action: 'reject' })}
                      className="btn-secondary btn-sm text-red-600">
                      <XCircle size={13} /> Reject
                    </button>
                    <button onClick={() => setModal({ sub, action: 'approve' })}
                      className="btn-primary btn-sm">
                      <CheckCircle2 size={13} /> Approve
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <DecisionModal sub={modal.sub} action={modal.action} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
