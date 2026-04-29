'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  BookOpen, CreditCard, CheckCircle2, Clock, XCircle, AlertTriangle,
  ChevronRight, Loader2, Shield, ArrowUpRight, Plus, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

// ── Plan selector modal ────────────────────────────────────────────────────────
function PlanSelector({ journal, onClose }: { journal: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [step, setStep] = useState<'select'|'payment'|'manual'|'done'>('select');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [proofUrl, setProofUrl] = useState('');
  const [payRef, setPayRef] = useState('');

  const { data: plansData } = useQuery({
    queryKey: ['journal-plans'],
    queryFn: () => api.get('/journal-billing/plans').then(r => r.data.data),
  });
  const plans = plansData ?? [];

  const FEATURES: Record<string,string> = {
    oai_pmh: 'OAI-PMH for Google Scholar indexing',
    doi_assignment: 'DOI assignment on publication',
    custom_domain: 'Custom journal domain',
    analytics_basic: 'Basic analytics',
    analytics_advanced: 'Advanced analytics dashboard',
    unlimited: 'Unlimited everything',
  };

  const initiate = useMutation({
    mutationFn: () => api.post('/journal-billing/initiate', {
      journalId: journal.id, planId: selectedPlan.id,
    }).then(r => r.data.data),
    onSuccess: (data) => {
      setPaymentData(data);
      if (data.paystackUrl) {
        window.location.href = data.paystackUrl;
      } else {
        setStep('manual');
      }
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed to initiate payment'),
  });

  const submitProof = useMutation({
    mutationFn: () => api.post('/journal-billing/manual-proof', {
      subscriptionId: paymentData.subscriptionId,
      proofUrl: proofUrl || null,
      paymentRef: payRef || paymentData.paystackRef,
    }),
    onSuccess: () => {
      toast.success('Payment proof submitted! Awaiting super admin approval.');
      qc.invalidateQueries({ queryKey: ['my-journals-billing'] });
      setStep('done');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-card-md my-8">
        <div className="p-6">
          {step === 'select' && (
            <>
              <h3 className="font-display text-lg font-semibold text-stone-900 mb-1">Choose a subscription plan</h3>
              <p className="text-sm text-stone-500 mb-5">for <strong>{journal.title}</strong></p>

              <div className="grid sm:grid-cols-2 gap-3 mb-5">
                {plans.map((plan: any) => (
                  <button key={plan.id} onClick={() => setSelectedPlan(plan)}
                    className={`text-left p-4 rounded-xl border-2 transition-all
                      ${selectedPlan?.id === plan.id
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-stone-200 hover:border-stone-300 bg-white'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-display font-semibold text-stone-900">{plan.name}</p>
                      {selectedPlan?.id === plan.id && (
                        <CheckCircle2 size={16} className="text-primary-700 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xl font-bold text-primary-800 mb-3">
                      ₦{parseInt(plan.price_yearly).toLocaleString()}<span className="text-sm font-normal text-stone-500">/year</span>
                    </p>
                    <ul className="space-y-1">
                      {Object.entries(plan.features || {}).map(([key, val]) => val ? (
                        <li key={key} className="flex items-start gap-1.5 text-xs text-stone-600">
                          <CheckCircle2 size={11} className="text-primary-600 flex-shrink-0 mt-0.5" />
                          {FEATURES[key] || key}
                        </li>
                      ) : null)}
                      <li className="flex items-start gap-1.5 text-xs text-stone-600">
                        <CheckCircle2 size={11} className="text-primary-600 flex-shrink-0 mt-0.5" />
                        Up to {plan.max_submissions_per_year === 999 ? 'unlimited' : plan.max_submissions_per_year} submissions/year
                      </li>
                    </ul>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => initiate.mutate()}
                  disabled={!selectedPlan || initiate.isPending}
                  className="btn-primary flex-1">
                  {initiate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard size={14} />}
                  Proceed to payment
                </button>
              </div>
            </>
          )}

          {step === 'manual' && paymentData && (
            <>
              <h3 className="font-display text-lg font-semibold text-stone-900 mb-1">Bank transfer payment</h3>
              <p className="text-sm text-stone-500 mb-5">Make payment using the details below then upload your receipt.</p>

              <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-5">
                <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-3">Payment details</p>
                <div className="space-y-2">
                  {Object.entries(paymentData.bankDetails || {}).map(([k,v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-stone-500 capitalize">{k.replace(/([A-Z])/g,' $1')}</span>
                      <span className="font-semibold text-stone-900">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label">Payment reference / receipt number</label>
                  <input value={payRef} onChange={e => setPayRef(e.target.value)}
                    placeholder="e.g. TRN2026040001234"
                    className="input font-mono" />
                </div>
                <div>
                  <label className="label">Receipt URL <span className="text-stone-400 font-normal">(optional — upload to cloud and paste link)</span></label>
                  <input value={proofUrl} onChange={e => setProofUrl(e.target.value)}
                    placeholder="https://drive.google.com/…" type="url"
                    className="input" />
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => submitProof.mutate()}
                  disabled={!payRef || submitProof.isPending}
                  className="btn-primary flex-1">
                  {submitProof.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 size={14} />}
                  Submit proof
                </button>
              </div>
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-primary-50 border-2 border-primary-200 flex items-center justify-center mx-auto mb-4">
                <Clock size={24} className="text-primary-700" />
              </div>
              <h3 className="font-display text-lg font-semibold text-stone-900 mb-2">Awaiting approval</h3>
              <p className="text-stone-500 text-sm mb-5">
                Your payment has been submitted. A UniNMS super administrator will review and approve your journal subscription within 1–2 business days.
              </p>
              <button onClick={onClose} className="btn-primary">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────────
function SubStatusBadge({ status }: { status: string }) {
  const map: Record<string,string> = {
    unpaid:            'bg-stone-100 text-stone-600 border-stone-200',
    pending_payment:   'bg-blue-50 text-blue-700 border-blue-200',
    pending_approval:  'bg-yellow-50 text-yellow-700 border-yellow-200',
    active:            'bg-primary-50 text-primary-700 border-primary-200',
    expired:           'bg-red-50 text-red-700 border-red-200',
    suspended:         'bg-red-50 text-red-700 border-red-200',
    cancelled:         'bg-stone-100 text-stone-500 border-stone-200',
  };
  const labels: Record<string,string> = {
    unpaid:           'Unpaid',
    pending_payment:  'Payment pending',
    pending_approval: 'Awaiting approval',
    active:           'Active',
    expired:          'Expired',
    suspended:        'Suspended',
    cancelled:        'Cancelled',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full border text-xs font-medium ${map[status] ?? map.unpaid}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function JournalBillingPage() {
  const [selectedJournal, setSelectedJournal] = useState<any>(null);

  // Fetch journals for this admin's university
  const { data: journalsData, isLoading } = useQuery({
    queryKey: ['my-journals-billing'],
    queryFn: () => api.get('/journals', { params: { limit: 50 } }).then(r => r.data.data),
  });

  const journals = journalsData?.journals ?? [];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">Journal subscriptions</h1>
          <p className="text-stone-500 text-sm mt-1">
            Manage subscriptions for your institution's hosted journals. All subscriptions are reviewed and approved by UniNMS.
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="card p-5 mb-6 border-l-4 border-l-primary-500 bg-primary-50/30">
        <div className="flex items-start gap-3">
          <Shield size={18} className="text-primary-700 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-stone-900 text-sm">How journal subscriptions work</p>
            <p className="text-stone-600 text-sm mt-1 leading-relaxed">
              Create a journal → choose a plan → make payment (Paystack or bank transfer) → UniNMS super admin reviews and approves → your journal goes live and starts accepting submissions.
            </p>
          </div>
        </div>
      </div>

      {/* Journals list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
      ) : journals.length === 0 ? (
        <div className="card p-16 text-center">
          <BookOpen size={40} className="mx-auto mb-3 text-stone-300" />
          <h3 className="font-display font-semibold text-stone-700 mb-1">No journals yet</h3>
          <p className="text-stone-400 text-sm mb-4">Create a journal first, then subscribe to activate it.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {journals.map((j: any) => (
            <JournalBillingCard key={j.id} journal={j} onSubscribe={() => setSelectedJournal(j)} />
          ))}
        </div>
      )}

      {selectedJournal && (
        <PlanSelector journal={selectedJournal} onClose={() => setSelectedJournal(null)} />
      )}
    </div>
  );
}

function JournalBillingCard({ journal, onSubscribe }: { journal: any; onSubscribe: () => void }) {
  const { data } = useQuery({
    queryKey: ['journal-sub', journal.id],
    queryFn: () => api.get(`/journal-billing/journal/${journal.id}`).then(r => r.data.data),
  });

  const sub = data as any;
  const subStatus = sub?.status ?? journal.subscription_status ?? 'unpaid';

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
            <BookOpen size={18} className="text-primary-700" />
          </div>
          <div>
            <h3 className="font-medium text-stone-900">{journal.title}</h3>
            <p className="text-xs text-stone-500 mt-0.5">{journal.department_name}</p>
            <div className="flex items-center gap-2 mt-2">
              <SubStatusBadge status={subStatus} />
              {sub?.plan_name && (
                <span className="badge-stone badge text-xs">{sub.plan_name} plan</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {subStatus === 'active' && (
            <div className="text-right">
              <p className="text-xs text-stone-400">Expires</p>
              <p className="text-xs font-medium text-stone-700">
                {sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString('en-NG', { day:'numeric',month:'short',year:'numeric' }) : '—'}
              </p>
            </div>
          )}
          {['unpaid','cancelled','expired'].includes(subStatus) && (
            <button onClick={onSubscribe} className="btn-primary btn-sm">
              <CreditCard size={13} /> Subscribe
            </button>
          )}
          {subStatus === 'pending_approval' && (
            <div className="flex items-center gap-1.5 text-xs text-yellow-700 bg-yellow-50 px-3 py-2 rounded-xl border border-yellow-200">
              <Clock size={12} />
              Awaiting approval
            </div>
          )}
          {subStatus === 'active' && (
            <button onClick={onSubscribe} className="btn-secondary btn-sm">
              <RefreshCw size={13} /> Renew
            </button>
          )}
        </div>
      </div>

      {/* Rejection reason */}
      {subStatus === 'cancelled' && sub?.rejection_reason && (
        <div className="mt-4 p-3 bg-red-50 rounded-xl border border-red-200 flex items-start gap-2">
          <XCircle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-red-800">Subscription was rejected</p>
            <p className="text-xs text-red-700 mt-0.5">{sub.rejection_reason}</p>
          </div>
        </div>
      )}

      {/* Pending approval note */}
      {subStatus === 'pending_approval' && (
        <div className="mt-4 p-3 bg-yellow-50 rounded-xl border border-yellow-200 flex items-start gap-2">
          <Clock size={14} className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-800">
            Payment received {sub?.payment_date ? formatDistanceToNow(new Date(sub.payment_date), {addSuffix:true}) : ''}. 
            A UniNMS administrator will approve your subscription within 1–2 business days.
          </p>
        </div>
      )}
    </div>
  );
}
