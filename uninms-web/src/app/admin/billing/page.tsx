'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { billingApi } from '@/lib/api';
import { FEATURE_LABELS } from '@/lib/plans';
import {
  Check, X, CreditCard, Clock, AlertTriangle, Zap, Loader2,
  Users, HardDrive, Shield, ChevronRight, Receipt,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
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

const STATUS_STYLE: Record<string, string> = {
  active:    'bg-green-50 text-green-700 border-green-200',
  trial:     'bg-amber-50 text-amber-700 border-amber-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  expired:   'bg-stone-100 text-stone-500 border-stone-200',
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  active:    <Check size={12} />,
  trial:     <Clock size={12} />,
  suspended: <AlertTriangle size={12} />,
  expired:   <X size={12} />,
};

/* ── Confirm upgrade modal ───────────────────────────────────────────────── */
function ConfirmModal({ plan, onClose }: { plan: DbPlan; onClose: () => void }) {
  const mutation = useMutation({
    mutationFn: () => billingApi.initialize(plan.key),
    onSuccess: (res: any) => {
      const url = res?.data?.authorization_url;
      if (url) window.location.href = url;
      else toast.error('No payment URL returned');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed to start payment'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card-md w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-stone-900">Confirm subscription</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>
        <div className="bg-stone-50 rounded-xl p-4 mb-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-stone-700">Plan</span>
            <span className={`badge text-xs ${plan.badge}`}>{plan.label}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-500">Annual price</span>
            <span className="text-sm font-semibold text-stone-900">{formatPrice(plan.price_naira)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-500">Max users</span>
            <span className="text-sm text-stone-700">{formatLimit(plan.max_users)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-500">Storage</span>
            <span className="text-sm text-stone-700">{formatLimit(plan.max_storage_gb, 'GB')}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-500">Features</span>
            <span className="text-sm text-stone-700">
              {Object.values(plan.features).filter(Boolean).length} of {Object.keys(plan.features).length}
            </span>
          </div>
        </div>
        <p className="text-xs text-stone-400 mb-5">
          You will be redirected to Paystack to complete payment securely. Subscription activates immediately after payment.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary flex-1">
            {mutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting…</>
              : <><CreditCard size={14} /> Pay {formatPrice(plan.price_naira)}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Plan card ───────────────────────────────────────────────────────────── */
function PlanCard({
  plan, isCurrent, onUpgrade,
}: { plan: DbPlan; isCurrent: boolean; onUpgrade: () => void }) {
  const isEnterprise = plan.key === 'enterprise';
  const isFree       = plan.key === 'free';

  return (
    <div className={`card p-5 flex flex-col relative ${plan.highlight ? 'ring-2 ring-primary-500 ring-offset-2' : ''}`}>
      {plan.highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-700 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
          Most popular
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3 right-4 bg-green-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
          Current plan
        </div>
      )}
      <div className="flex items-center gap-2 mb-3">
        <span className={`badge text-xs ${plan.badge}`}>{plan.label}</span>
      </div>
      <p className="font-display text-xl font-semibold text-stone-900 mb-0.5">{formatPrice(plan.price_naira)}</p>
      <p className="text-xs text-stone-400 mb-4">{plan.tagline}</p>
      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-2 text-xs text-stone-600">
          <Users size={11} className="text-stone-400" />{formatLimit(plan.max_users)} users
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-600">
          <HardDrive size={11} className="text-stone-400" />{formatLimit(plan.max_storage_gb, 'GB')} storage
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-600">
          <Shield size={11} className="text-stone-400" />{formatLimit(plan.plagiarism_checks_per_month)} plagiarism/mo
        </div>
      </div>
      <div className="space-y-1 mb-5 flex-1">
        {(Object.entries(FEATURE_LABELS) as [string, string][]).map(([key, label]) => (
          <div key={key} className={`flex items-center gap-2 text-xs ${plan.features[key] ? 'text-stone-700' : 'text-stone-300'}`}>
            {plan.features[key]
              ? <Check size={11} className="text-green-600 flex-shrink-0" />
              : <X size={11} className="text-stone-200 flex-shrink-0" />}
            {label}
          </div>
        ))}
      </div>
      {isCurrent ? (
        <div className="w-full py-2.5 rounded-xl text-center text-xs font-medium text-green-700 bg-green-50 border border-green-200">
          <Check size={12} className="inline mr-1" />Active
        </div>
      ) : isEnterprise ? (
        <a href="mailto:sales@uninms.ng" className="btn-secondary w-full text-center text-sm">
          Contact sales <ChevronRight size={13} />
        </a>
      ) : isFree ? (
        <div className="w-full py-2.5 rounded-xl text-center text-xs font-medium text-stone-400 bg-stone-50">
          Free tier
        </div>
      ) : (
        <button onClick={onUpgrade} className={`w-full ${plan.highlight ? 'btn-primary' : 'btn-secondary'} text-sm`}>
          <Zap size={13} /> Upgrade to {plan.label}
        </button>
      )}
    </div>
  );
}

/* ── Payment history ─────────────────────────────────────────────────────── */
function PaymentHistory({ history }: { history: any[] }) {
  if (!history.length) return null;
  const statusStyle: Record<string, string> = {
    success: 'text-green-600 bg-green-50',
    pending: 'text-amber-600 bg-amber-50',
    failed:  'text-red-600 bg-red-50',
  };
  return (
    <div className="card p-5 mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Receipt size={16} className="text-stone-400" />
        <h3 className="font-display font-semibold text-stone-900">Payment history</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-100">
              <th className="text-left text-xs font-semibold text-stone-400 uppercase tracking-wide py-2">Plan</th>
              <th className="text-left text-xs font-semibold text-stone-400 uppercase tracking-wide py-2">Amount</th>
              <th className="text-left text-xs font-semibold text-stone-400 uppercase tracking-wide py-2">Status</th>
              <th className="text-left text-xs font-semibold text-stone-400 uppercase tracking-wide py-2 hidden sm:table-cell">Reference</th>
              <th className="text-left text-xs font-semibold text-stone-400 uppercase tracking-wide py-2 hidden md:table-cell">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {history.map((p: any) => (
              <tr key={p.id} className="hover:bg-stone-50">
                <td className="py-3 text-sm font-medium text-stone-700 capitalize">{p.plan}</td>
                <td className="py-3 text-sm text-stone-600">
                  {p.amount_kobo === 0 ? 'Free' : `₦${(p.amount_kobo / 100).toLocaleString('en-NG')}`}
                </td>
                <td className="py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[p.status] ?? 'text-stone-500 bg-stone-50'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="py-3 text-xs text-stone-400 font-mono hidden sm:table-cell">{p.reference?.slice(0, 20)}…</td>
                <td className="py-3 text-xs text-stone-400 hidden md:table-cell">
                  {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function AdminBillingPage() {
  const [confirmPlan, setConfirmPlan] = useState<DbPlan | null>(null);

  const plansQuery = useQuery({
    queryKey: ['billing-plans'],
    queryFn:  () => billingApi.plans(),
  });

  const currentQuery = useQuery({
    queryKey: ['billing-current'],
    queryFn:  () => billingApi.current(),
  });

  const plans:   DbPlan[] = (plansQuery.data as any)?.data ?? [];
  const sub      = (currentQuery.data as any)?.data?.subscription;
  const history  = (currentQuery.data as any)?.data?.history ?? [];
  const isLoading = plansQuery.isLoading || currentQuery.isLoading;

  return (
    <div className="max-w-6xl mx-auto">

      {/* Current subscription banner */}
      {!isLoading && sub && (
        <div className={`flex items-center gap-4 p-4 rounded-2xl border mb-6 ${STATUS_STYLE[sub.status] ?? STATUS_STYLE.active}`}>
          <div className="flex items-center gap-2">
            {STATUS_ICON[sub.status]}
            <span className="text-sm font-semibold capitalize">{sub.status}</span>
          </div>
          <div className="flex-1">
            <span className="text-sm">
              Currently on <strong className="capitalize">{sub.plan}</strong> plan
              {sub.expires_at
                ? ` · Expires ${formatDistanceToNow(new Date(sub.expires_at), { addSuffix: true })}`
                : ''}
            </span>
          </div>
          {sub.status === 'trial' && (
            <span className="text-xs font-medium">Upgrade to keep access after trial ends</span>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-80 skeleton rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {plans.map(plan => (
            <PlanCard
              key={plan.key}
              plan={plan}
              isCurrent={sub?.plan === plan.key}
              onUpgrade={() => setConfirmPlan(plan)}
            />
          ))}
        </div>
      )}

      <PaymentHistory history={history} />

      {confirmPlan && (
        <ConfirmModal plan={confirmPlan} onClose={() => setConfirmPlan(null)} />
      )}
    </div>
  );
}
