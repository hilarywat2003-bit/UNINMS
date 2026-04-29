'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformApi, plansApi } from '@/lib/api';
import {
  Building2, Search, ChevronLeft, ChevronRight, X, Loader2,
  Users, FileText, MoreHorizontal, CheckCircle2, XCircle, Clock, AlertTriangle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const PLANS    = ['free', 'basic', 'standard', 'premium', 'enterprise'];
const STATUSES = ['active', 'trial', 'suspended', 'expired'];

const PLAN_BADGE: Record<string, string> = {
  free: 'badge-stone', basic: 'badge-blue', standard: 'badge-green',
  premium: 'badge-purple', enterprise: 'badge-gold',
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  active:    <CheckCircle2 size={12} className="text-green-600" />,
  trial:     <Clock size={12} className="text-amber-500" />,
  suspended: <XCircle size={12} className="text-red-500" />,
  expired:   <AlertTriangle size={12} className="text-stone-400" />,
};

/* ── Edit subscription modal ─────────────────────────────────────────────── */
function EditSubscriptionModal({ uni, onClose }: { uni: any; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: plansData } = useQuery({
    queryKey: ['platform-plans'],
    queryFn:  () => plansApi.list(),
  });
  const planCatalogue: Record<string, any> = {};
  ((plansData as any)?.data ?? []).forEach((p: any) => { planCatalogue[p.key] = p; });

  const [form, setForm] = useState({
    plan:       uni.plan ?? 'basic',
    maxUsers:   uni.max_users ?? 500,
    maxStorageGb: uni.max_storage_gb ?? 10,
    expiresAt:  uni.expires_at ? new Date(uni.expires_at).toISOString().slice(0, 16) : '',
    plagiarismThreshold: uni.plagiarism_threshold ?? 0.3,
  });

  const mutation = useMutation({
    mutationFn: () => platformApi.updateSubscription(uni.id, {
      plan:       form.plan,
      maxUsers:   form.maxUsers,
      maxStorageGb: form.maxStorageGb,
      expiresAt:  form.expiresAt || undefined,
      plagiarismThreshold: form.plagiarismThreshold,
    }),
    onSuccess: () => {
      toast.success('Subscription updated');
      qc.invalidateQueries({ queryKey: ['platform-universities'] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }));

  const handlePlanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key  = e.target.value;
    const tmpl = planCatalogue[key];
    if (tmpl) {
      setForm(f => ({
        ...f,
        plan:         key,
        maxUsers:     tmpl.max_users === -1     ? 999999 : tmpl.max_users,
        maxStorageGb: tmpl.max_storage_gb === -1 ? 999999 : tmpl.max_storage_gb,
      }));
    } else {
      setForm(f => ({ ...f, plan: key }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card-md w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-display text-xl font-semibold text-stone-900">Edit subscription</h3>
            <p className="text-sm text-stone-500 mt-0.5">{uni.name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Plan</label>
            <select value={form.plan} onChange={handlePlanChange} className="input">
              {PLANS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
            <p className="text-xs text-stone-400 mt-1">Selecting a plan auto-fills the limits below</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Max users</label>
              <input type="number" value={form.maxUsers} onChange={set('maxUsers')} min={1} className="input" />
            </div>
            <div>
              <label className="label">Storage (GB)</label>
              <input type="number" value={form.maxStorageGb} onChange={set('maxStorageGb')} min={1} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Plagiarism threshold (0–1)</label>
            <div className="flex items-center gap-3">
              <input type="range" min={0.05} max={0.95} step={0.05}
                value={form.plagiarismThreshold}
                onChange={e => setForm(f => ({ ...f, plagiarismThreshold: parseFloat(e.target.value) }))}
                className="flex-1 accent-stone-800" />
              <span className="text-sm font-medium text-stone-700 w-12 text-right">
                {Math.round(form.plagiarismThreshold * 100)}%
              </span>
            </div>
          </div>
          <div>
            <label className="label">Subscription expires</label>
            <input type="datetime-local" value={form.expiresAt} onChange={set('expiresAt')} className="input" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary flex-1">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Status dropdown ─────────────────────────────────────────────────────── */
function StatusMenu({ uni }: { uni: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: (status: string) => platformApi.updateUniStatus(uni.id, status),
    onSuccess: (_: any, status: string) => {
      toast.success(`Status updated to "${status}"`);
      qc.invalidateQueries({ queryKey: ['platform-universities'] });
      setOpen(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors">
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-white border border-stone-200 rounded-xl shadow-card-md py-1.5 min-w-[160px]">
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Set status</p>
            {STATUSES.filter(s => s !== uni.subscription_status).map(s => (
              <button key={s} onClick={() => mutation.mutate(s)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 capitalize transition-colors">
                {STATUS_ICON[s]} {s}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function SuperAdminUniversitiesPage() {
  const [q, setQ]             = useState('');
  const [activeQ, setActiveQ] = useState('');
  const [plan, setPlan]       = useState('');
  const [status, setStatus]   = useState('');
  const [page, setPage]       = useState(1);
  const [editing, setEditing] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['platform-universities', activeQ, plan, status, page],
    queryFn:  () => platformApi.universities({ q: activeQ || undefined, plan: plan || undefined, status: status || undefined, page, limit: 20 }),
  });

  const unis       = (data as any)?.data?.universities ?? [];
  const total      = (data as any)?.data?.total ?? 0;
  const totalPages = (data as any)?.data?.totalPages ?? 1;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <p className="text-stone-500 text-sm">{total.toLocaleString()} institution{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 space-y-3">
        <form onSubmit={e => { e.preventDefault(); setActiveQ(q); setPage(1); }} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name…" className="input pl-10" />
          </div>
          <button type="submit" className="btn-primary px-5">Search</button>
        </form>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1.5 flex-wrap">
            {['', ...PLANS].map(p => (
              <button key={p} onClick={() => { setPlan(p); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                  ${plan === p ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'}`}>
                {p || 'All plans'}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap ml-auto">
            {['', ...STATUSES].map(s => (
              <button key={s} onClick={() => { setStatus(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                  ${status === s ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'}`}>
                {s || 'All status'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-20 skeleton rounded-xl" />)}</div>
      ) : unis.length === 0 ? (
        <div className="card p-16 text-center">
          <Building2 size={40} className="mx-auto mb-3 text-stone-300" />
          <p className="text-stone-400 text-sm">No institutions found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3">Institution</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Plan</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Status</th>
                <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Users</th>
                <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Docs</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3 hidden xl:table-cell">Joined</th>
                <th className="px-4 py-3 w-24 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {unis.map((u: any) => (
                <tr key={u.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-stone-900">{u.name}</p>
                    <p className="text-xs text-stone-400">{u.short_name}{u.state ? ` · ${u.state}` : ''}{u.type ? ` · ${u.type}` : ''}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`badge text-xs ${PLAN_BADGE[u.plan] ?? 'badge-stone'}`}>
                      {u.plan ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-1.5">
                      {STATUS_ICON[u.subscription_status]}
                      <span className="text-xs text-stone-600 capitalize">{u.subscription_status ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-stone-600 hidden lg:table-cell">
                    <span className="flex items-center justify-end gap-1"><Users size={11} className="text-stone-300" />{parseInt(u.user_count ?? 0).toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-stone-600 hidden lg:table-cell">
                    <span className="flex items-center justify-end gap-1"><FileText size={11} className="text-stone-300" />{parseInt(u.document_count ?? 0).toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-400 hidden xl:table-cell">
                    {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditing(u)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors">
                        Edit plan
                      </button>
                      <StatusMenu uni={u} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary btn-sm"><ChevronLeft size={14} /></button>
          <span className="text-sm text-stone-600">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary btn-sm"><ChevronRight size={14} /></button>
        </div>
      )}

      {editing && <EditSubscriptionModal uni={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
