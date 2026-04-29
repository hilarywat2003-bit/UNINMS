'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plansApi, platformApi } from '@/lib/api';
import { FEATURE_LABELS } from '@/lib/plans';
import {
  Check, X, Users, HardDrive, Shield, Zap, ChevronRight,
  Loader2, Pencil, Save,
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ── Types ───────────────────────────────────────────────────────────────── */
interface DbPlan {
  key: string;
  label: string;
  tagline: string;
  price_naira: number;
  max_users: number;
  max_storage_gb: number;
  plagiarism_checks_per_month: number;
  features: Record<string, boolean>;
  badge: string;
  highlight: boolean;
  sort_order: number;
}

function formatPrice(n: number) {
  if (n === 0)  return 'Free';
  if (n === -1) return 'Custom';
  return '₦' + n.toLocaleString('en-NG') + '/yr';
}
function formatLimit(n: number, unit = '') {
  if (n === -1) return 'Unlimited';
  return n.toLocaleString() + (unit ? ' ' + unit : '');
}

/* ── Edit plan modal ─────────────────────────────────────────────────────── */
function EditPlanModal({ plan, onClose }: { plan: DbPlan; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    label:                     plan.label,
    tagline:                   plan.tagline ?? '',
    priceNaira:                plan.price_naira,
    maxUsers:                  plan.max_users,
    maxStorageGb:              plan.max_storage_gb,
    plagiarismChecksPerMonth:  plan.plagiarism_checks_per_month,
    highlight:                 plan.highlight,
    features:                  { ...plan.features },
  });

  const mutation = useMutation({
    mutationFn: () => plansApi.update(plan.key, {
      label:                    form.label,
      tagline:                  form.tagline,
      priceNaira:               form.priceNaira,
      maxUsers:                 form.maxUsers,
      maxStorageGb:             form.maxStorageGb,
      plagiarismChecksPerMonth: form.plagiarismChecksPerMonth,
      highlight:                form.highlight,
      features:                 form.features,
    }),
    onSuccess: () => {
      toast.success(`${plan.label} plan updated`);
      qc.invalidateQueries({ queryKey: ['platform-plans'] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const setNum = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: parseInt(e.target.value) || 0 }));

  const toggleFeature = (key: string) =>
    setForm(f => ({ ...f, features: { ...f.features, [key]: !f.features[key] } }));

  const isEnterprise = plan.key === 'enterprise';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card-md w-full max-w-xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-display text-xl font-semibold text-stone-900">Edit plan</h3>
            <p className="text-xs text-stone-400 mt-0.5">Changes apply to all new & renewed subscriptions</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          {/* Label & tagline */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Plan name</label>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                className="input" />
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 cursor-pointer pb-1">
                <input type="checkbox" checked={form.highlight}
                  onChange={e => setForm(f => ({ ...f, highlight: e.target.checked }))}
                  className="w-4 h-4 rounded accent-stone-800" />
                <span className="text-sm text-stone-700">Mark as "Most popular"</span>
              </label>
            </div>
          </div>
          <div>
            <label className="label">Tagline</label>
            <input value={form.tagline} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
              className="input" />
          </div>

          {/* Pricing */}
          <div>
            <label className="label">Annual price (₦)</label>
            <input type="number" value={form.priceNaira === -1 ? '' : form.priceNaira}
              placeholder={isEnterprise ? '-1 for custom' : '0 for free'}
              onChange={e => setForm(f => ({ ...f, priceNaira: e.target.value === '' ? -1 : parseInt(e.target.value) }))}
              min={-1} step={1000} className="input" />
            <p className="text-xs text-stone-400 mt-1">
              Use <code className="bg-stone-100 px-1 rounded">0</code> for free,{' '}
              <code className="bg-stone-100 px-1 rounded">-1</code> for custom/contact-sales
            </p>
          </div>

          {/* Limits */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Max users</label>
              <input type="number" value={form.maxUsers === -1 ? '' : form.maxUsers}
                placeholder="-1 unlimited"
                onChange={e => setForm(f => ({ ...f, maxUsers: e.target.value === '' ? -1 : parseInt(e.target.value) }))}
                min={-1} className="input" />
            </div>
            <div>
              <label className="label">Storage (GB)</label>
              <input type="number" value={form.maxStorageGb === -1 ? '' : form.maxStorageGb}
                placeholder="-1 unlimited"
                onChange={e => setForm(f => ({ ...f, maxStorageGb: e.target.value === '' ? -1 : parseInt(e.target.value) }))}
                min={-1} className="input" />
            </div>
            <div>
              <label className="label">Plagiarism/mo</label>
              <input type="number" value={form.plagiarismChecksPerMonth === -1 ? '' : form.plagiarismChecksPerMonth}
                placeholder="-1 unlimited"
                onChange={e => setForm(f => ({ ...f, plagiarismChecksPerMonth: e.target.value === '' ? -1 : parseInt(e.target.value) }))}
                min={-1} className="input" />
            </div>
          </div>

          {/* Features */}
          <div>
            <label className="label mb-2">Features</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.entries(FEATURE_LABELS) as [string, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-stone-50 cursor-pointer border border-transparent hover:border-stone-100">
                  <input type="checkbox" checked={!!form.features[key]}
                    onChange={() => toggleFeature(key)}
                    className="w-4 h-4 rounded accent-stone-800 flex-shrink-0" />
                  <span className={`text-xs ${form.features[key] ? 'text-stone-800 font-medium' : 'text-stone-400'}`}>
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary flex-1">
            {mutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : <><Save size={14} /> Save changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Apply plan modal (search university → apply) ─────────────────────────── */
function ApplyPlanModal({ plan, onClose }: { plan: DbPlan; onClose: () => void }) {
  const qc  = useQueryClient();
  const [uniId,     setUniId]     = useState('');
  const [uniSearch, setUniSearch] = useState('');
  const [unis,      setUnis]      = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const search = async (q: string) => {
    if (!q.trim()) { setUnis([]); return; }
    setSearching(true);
    try {
      const res = await platformApi.universities({ q, limit: 10 }) as any;
      setUnis(res?.data?.universities ?? []);
    } finally { setSearching(false); }
  };

  const mutation = useMutation({
    mutationFn: () => platformApi.updateSubscription(uniId, {
      plan:         plan.key,
      maxUsers:     plan.max_users === -1     ? 999999 : plan.max_users,
      maxStorageGb: plan.max_storage_gb === -1 ? 999999 : plan.max_storage_gb,
      features:     plan.features,
    }),
    onSuccess: () => {
      toast.success(`${plan.label} plan applied`);
      qc.invalidateQueries({ queryKey: ['platform-universities'] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card-md w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-stone-900">Apply {plan.label} plan</h3>
            <p className="text-xs text-stone-400 mt-0.5">Search and select an institution</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>
        <input value={uniSearch}
          onChange={e => { setUniSearch(e.target.value); search(e.target.value); }}
          placeholder="Type university name…" className="input mb-2" autoFocus />
        {searching && <p className="text-xs text-stone-400 px-1 mb-2">Searching…</p>}
        {unis.length > 0 && (
          <div className="border border-stone-100 rounded-xl overflow-hidden mb-4">
            {unis.map((u: any) => (
              <button key={u.id} onClick={() => { setUniId(u.id); setUniSearch(u.name); setUnis([]); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0
                  ${uniId === u.id ? 'bg-primary-50 text-primary-700' : 'text-stone-700'}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{u.name}</p>
                  <p className="text-xs text-stone-400">{u.state} · Current: {u.plan}</p>
                </div>
                {uniId === u.id && <Check size={14} className="text-primary-600 flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}
        {uniId && (
          <div className="bg-stone-50 rounded-xl p-3 mb-4 text-xs text-stone-600 space-y-1">
            <p className="font-semibold text-stone-700">Will apply:</p>
            <p>• Max users: {formatLimit(plan.max_users)}</p>
            <p>• Storage: {formatLimit(plan.max_storage_gb, 'GB')}</p>
            <p>• {Object.values(plan.features).filter(Boolean).length} features enabled</p>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!uniId || mutation.isPending} className="btn-primary flex-1">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap size={14} />} Apply plan
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Plan card ───────────────────────────────────────────────────────────── */
function PlanCard({
  plan,
  onEdit,
  onApply,
}: { plan: DbPlan; onEdit: () => void; onApply: () => void }) {
  const featCount  = Object.values(plan.features).filter(Boolean).length;
  const totalFeats = Object.keys(plan.features).length;

  return (
    <div className={`card p-6 flex flex-col relative ${plan.highlight ? 'ring-2 ring-primary-500 ring-offset-2' : ''}`}>
      {plan.highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-700 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
          Most popular
        </div>
      )}

      {/* Edit button */}
      <button onClick={onEdit}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
        title="Edit plan">
        <Pencil size={13} />
      </button>

      <div className="flex items-center justify-between mb-3 pr-6">
        <span className={`badge text-xs ${plan.badge}`}>{plan.label}</span>
        <span className="text-xs text-stone-400">{featCount}/{totalFeats} features</span>
      </div>
      <p className="font-display text-2xl font-semibold text-stone-900 mb-1">{formatPrice(plan.price_naira)}</p>
      <p className="text-xs text-stone-400 mb-4">{plan.tagline}</p>

      <div className="space-y-2 mb-5">
        <div className="flex items-center gap-2 text-sm text-stone-600">
          <Users size={13} className="text-stone-400 flex-shrink-0" />
          <span>{formatLimit(plan.max_users)} users</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-stone-600">
          <HardDrive size={13} className="text-stone-400 flex-shrink-0" />
          <span>{formatLimit(plan.max_storage_gb, 'GB')} storage</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-stone-600">
          <Shield size={13} className="text-stone-400 flex-shrink-0" />
          <span>{formatLimit(plan.plagiarism_checks_per_month)} plagiarism checks/mo</span>
        </div>
      </div>

      <div className="space-y-1.5 mb-6 flex-1">
        {(Object.entries(FEATURE_LABELS) as [string, string][]).map(([key, label]) => (
          <div key={key} className={`flex items-center gap-2 text-xs ${plan.features[key] ? 'text-stone-700' : 'text-stone-300'}`}>
            {plan.features[key]
              ? <Check size={12} className="text-green-600 flex-shrink-0" />
              : <X size={12} className="text-stone-200 flex-shrink-0" />}
            {label}
          </div>
        ))}
      </div>

      <button onClick={onApply} className={`w-full ${plan.highlight ? 'btn-primary' : 'btn-secondary'}`}>
        Apply to institution <ChevronRight size={13} />
      </button>
    </div>
  );
}

/* ── Comparison table ────────────────────────────────────────────────────── */
function ComparisonTable({ plans }: { plans: DbPlan[] }) {
  return (
    <div className="card overflow-hidden mt-8">
      <div className="p-5 border-b border-stone-100">
        <h3 className="font-display font-semibold text-stone-900">Full feature comparison</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-stone-50">
            <tr>
              <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide px-5 py-3 w-56">Feature</th>
              {plans.map(p => (
                <th key={p.key} className="text-center text-xs font-semibold uppercase tracking-wide px-3 py-3">
                  <span className={`badge text-xs ${p.badge}`}>{p.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Max users',           values: plans.map(p => formatLimit(p.max_users)) },
              { label: 'Storage',              values: plans.map(p => formatLimit(p.max_storage_gb, 'GB')) },
              { label: 'Plagiarism checks/mo', values: plans.map(p => formatLimit(p.plagiarism_checks_per_month)) },
              { label: 'Annual price',         values: plans.map(p => formatPrice(p.price_naira)) },
            ].map(row => (
              <tr key={row.label} className="border-t border-stone-50 hover:bg-stone-50">
                <td className="px-5 py-3 text-sm font-medium text-stone-700">{row.label}</td>
                {row.values.map((v, i) => (
                  <td key={i} className="px-3 py-3 text-center text-sm text-stone-600">{v}</td>
                ))}
              </tr>
            ))}
            {(Object.entries(FEATURE_LABELS) as [string, string][]).map(([key, label]) => (
              <tr key={key} className="border-t border-stone-50 hover:bg-stone-50">
                <td className="px-5 py-3 text-sm text-stone-700">{label}</td>
                {plans.map(p => (
                  <td key={p.key} className="px-3 py-3 text-center">
                    {p.features[key]
                      ? <Check size={15} className="mx-auto text-green-600" />
                      : <X size={15} className="mx-auto text-stone-200" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function SuperAdminPlansPage() {
  const [editPlan,  setEditPlan]  = useState<DbPlan | null>(null);
  const [applyPlan, setApplyPlan] = useState<DbPlan | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['platform-plans'],
    queryFn:  () => plansApi.list(),
  });

  const plans: DbPlan[] = (data as any)?.data ?? [];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Pencil size={14} className="text-stone-400" />
        <p className="text-stone-500 text-sm">
          Click the edit button on any plan card to change its name, price, limits, or features.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-[480px] skeleton rounded-2xl" />)}
        </div>
      ) : isError ? (
        <div className="card p-16 text-center text-stone-400 text-sm">
          Failed to load plans. Make sure the backend is running and restart it if you just added new routes.
        </div>
      ) : plans.length === 0 ? (
        <div className="card p-16 text-center text-stone-400 text-sm">
          No plans found. Run <code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">node scripts/migrate-plans.js</code> to seed defaults.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {plans.map(plan => (
            <PlanCard
              key={plan.key}
              plan={plan}
              onEdit={() => setEditPlan(plan)}
              onApply={() => setApplyPlan(plan)}
            />
          ))}
        </div>
      )}

      {plans.length > 0 && <ComparisonTable plans={plans} />}

      {editPlan  && <EditPlanModal  plan={editPlan}  onClose={() => setEditPlan(null)} />}
      {applyPlan && <ApplyPlanModal plan={applyPlan} onClose={() => setApplyPlan(null)} />}
    </div>
  );
}
