'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import {
  BookOpen, CheckCircle2, CreditCard, ArrowRight, Loader2,
  Star, Zap, Crown, Info, ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const PLAN_ICONS: Record<string, React.ElementType> = {
  starter: Star, standard: Zap, premium: Crown,
};
const PLAN_COLORS: Record<string, string> = {
  starter:  'border-blue-400 bg-blue-50',
  standard: 'border-primary-500 bg-primary-50',
  premium:  'border-gold-500 bg-gold-50',
};

type Step = 1 | 2 | 3;

export default function CreateJournalPage() {
  const [step, setStep]         = useState<Step>(1);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [billing, setBilling]   = useState<'yearly' | 'monthly'>('yearly');
  const [creating, setCreating] = useState(false);
  const [result, setResult]     = useState<any>(null);

  const { data: plansData } = useQuery({
    queryKey: ['journal-plans'],
    queryFn:  () => api.get('/journal-billing/plans').then(r => r.data.data),
  });
  const plans = plansData ?? [];

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { title: '', departmentId: '', issn_online: '', issn_print: '', scope: '', description: '', frequency: 'biannual', reviewType: 'double_blind', isOpenAccess: true, language: 'English', subjects: '' },
  });

  const onSubmit = async (values: any) => {
    if (!selectedPlan) { toast.error('Please select a plan first'); return; }
    setCreating(true);
    try {
      const res = await api.post('/journal-billing/journals', {
        ...values,
        isOpenAccess: values.isOpenAccess === true || values.isOpenAccess === 'true',
        subjects: values.subjects ? values.subjects.split(',').map((s: string) => s.trim()) : [],
        planId:   selectedPlan.id,
        billingCycle: billing,
      });
      setResult(res.data.data);
      setStep(3);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to create journal');
    } finally {
      setCreating(false);
    }
  };

  const handlePay = () => {
    if (result?.payment?.authorization_url) {
      window.location.href = result.payment.authorization_url;
    } else {
      toast.error('Payment URL not available. Check Paystack keys in .env');
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

  if (step === 3 && result) return (
    <div className="max-w-lg mx-auto">
      <div className="card p-6 text-center mb-5">
        <div className="w-14 h-14 rounded-2xl bg-primary-50 border-2 border-primary-200 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-7 h-7 text-primary-700" />
        </div>
        <h2 className="font-display text-2xl font-semibold text-stone-900 mb-1">Journal created!</h2>
        <p className="text-stone-500 text-sm mb-1">
          <strong className="text-stone-800">{result.journal?.title}</strong>
        </p>
        <p className="text-xs text-stone-400 mb-4">Ref: {result.payment?.reference}</p>
        <div className="bg-stone-50 rounded-xl p-4 text-left space-y-2 mb-5">
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Plan</span>
            <span className="font-medium text-stone-900">{result.payment?.plan_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Billing</span>
            <span className="font-medium text-stone-900 capitalize">{billing}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Amount</span>
            <span className="font-bold text-stone-900">{fmt(result.payment?.amount)}</span>
          </div>
        </div>
        <button onClick={handlePay} className="btn-primary w-full py-3 text-base mb-3">
          <CreditCard size={16} /> Pay with Paystack
        </button>
        <p className="text-xs text-stone-400">After payment, UniNMS super admin will review and activate your journal within 24 hours.</p>
      </div>
      <div className="card p-4 flex items-start gap-3">
        <Info size={14} className="text-primary-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-stone-700">What happens next?</p>
          <ol className="text-xs text-stone-500 mt-1 space-y-1 list-decimal list-inside">
            <li>You pay via Paystack</li>
            <li>Payment is verified automatically</li>
            <li>UniNMS super admin reviews your journal details</li>
            <li>On approval, your journal goes live at /journals/{result.journal?.slug}</li>
          </ol>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/journals" className="btn-ghost btn-sm"><ArrowLeft size={14} /></Link>
        <div>
          <h1 className="font-display text-xl font-semibold text-stone-900">Create a new journal</h1>
          <p className="text-stone-500 text-sm">Set up your department journal and choose a subscription plan</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-8">
        {[{n:1,label:'Journal details'},{n:2,label:'Choose plan'},{n:3,label:'Payment'}].map(({n,label}) => (
          <div key={n} className="flex items-center gap-2">
            <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              step > n ? 'bg-primary-700 text-white' : step === n ? 'bg-primary-100 text-primary-700 border-2 border-primary-500' : 'bg-stone-100 text-stone-400')}>
              {step > n ? <CheckCircle2 size={14} /> : n}
            </div>
            <span className={clsx('text-sm font-medium', step === n ? 'text-stone-900' : 'text-stone-400')}>{label}</span>
            {n < 3 && <div className="w-8 h-0.5 bg-stone-200 ml-1" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <form onSubmit={handleSubmit(() => setStep(2))}>
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="card p-6 space-y-4">
              <h2 className="font-display font-semibold text-stone-900">Basic information</h2>
              <div>
                <label className="label">Journal title *</label>
                <input {...register('title', { required: 'Required' })} placeholder="e.g. Nigerian Journal of Computer Science"
                  className={`input ${errors.title ? 'input-error' : ''}`} />
                {errors.title && <p className="field-error">{(errors.title as any).message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Print ISSN</label>
                  <input {...register('issn_print')} placeholder="XXXX-XXXX" className="input" />
                </div>
                <div>
                  <label className="label">Online ISSN</label>
                  <input {...register('issn_online')} placeholder="XXXX-XXXX" className="input" />
                </div>
              </div>
              <div>
                <label className="label">Publication frequency</label>
                <select {...register('frequency')} className="input">
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly (4 per year)</option>
                  <option value="biannual">Biannual (2 per year)</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              <div>
                <label className="label">Review type</label>
                <select {...register('reviewType')} className="input">
                  <option value="double_blind">Double-blind peer review</option>
                  <option value="single_blind">Single-blind peer review</option>
                  <option value="open">Open peer review</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input {...register('isOpenAccess')} type="checkbox" defaultChecked
                  className="w-4 h-4 rounded accent-primary-700" />
                <span className="text-sm text-stone-700">Open access (free to read)</span>
              </label>
            </div>

            <div className="card p-6 space-y-4">
              <h2 className="font-display font-semibold text-stone-900">Scope & subjects</h2>
              <div>
                <label className="label">Aims & Scope *</label>
                <textarea {...register('scope', { required: 'Required' })} rows={4}
                  placeholder="Describe the journal's subject coverage and aims…"
                  className={`input resize-none ${errors.scope ? 'input-error' : ''}`} />
              </div>
              <div>
                <label className="label">Description <span className="text-stone-400 font-normal">(for journal homepage)</span></label>
                <textarea {...register('description')} rows={3}
                  placeholder="Brief public description for the journal listing…"
                  className="input resize-none" />
              </div>
              <div>
                <label className="label">Subject areas <span className="text-stone-400 font-normal">(comma-separated)</span></label>
                <input {...register('subjects')} placeholder="Computer Science, Education, AI, Technology"
                  className="input" />
              </div>
              <div>
                <label className="label">Language</label>
                <select {...register('language')} className="input">
                  <option>English</option>
                  <option>French</option>
                  <option>Hausa</option>
                  <option>Yoruba</option>
                  <option>Igbo</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-5">
            <button type="submit" className="btn-primary">
              Continue to plan <ArrowRight size={15} />
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <div>
          <div className="flex items-center gap-3 mb-6 justify-center">
            <span className={clsx('text-sm font-medium', billing==='monthly' ? 'text-stone-900' : 'text-stone-400')}>Monthly</span>
            <button onClick={() => setBilling(b => b==='yearly' ? 'monthly' : 'yearly')}
              className={clsx('w-12 h-6 rounded-full transition-colors relative', billing==='yearly' ? 'bg-primary-700' : 'bg-stone-300')}>
              <div className={clsx('w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm', billing==='yearly' ? 'right-1' : 'left-1')} />
            </button>
            <span className={clsx('text-sm font-medium', billing==='yearly' ? 'text-stone-900' : 'text-stone-400')}>
              Yearly <span className="badge-green badge text-xs ml-1">Save 17%</span>
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-5 mb-6">
            {plans.map((plan: any) => {
              const Icon = PLAN_ICONS[plan.slug] ?? Star;
              const price = billing === 'monthly' ? plan.price_monthly : plan.price_yearly;
              const isSelected = selectedPlan?.id === plan.id;
              const features = plan.features || {};
              return (
                <button key={plan.id} onClick={() => setSelectedPlan(plan)}
                  className={clsx('card p-5 text-left transition-all hover:shadow-card-md',
                    isSelected ? `border-2 ${PLAN_COLORS[plan.slug] ?? 'border-primary-500 bg-primary-50'}` : 'border border-stone-200')}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon size={18} className={isSelected ? 'text-primary-700' : 'text-stone-400'} />
                    <span className="font-display font-semibold text-stone-900">{plan.name}</span>
                    {isSelected && <CheckCircle2 size={14} className="text-primary-700 ml-auto" />}
                  </div>
                  <div className="mb-4">
                    <span className="text-3xl font-display font-bold text-stone-900">{fmt(price)}</span>
                    <span className="text-stone-400 text-sm">/{billing === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-stone-600">
                    <li className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-primary-600" />{plan.max_articles} articles/year</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-primary-600" />{plan.max_issues} issues/year</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-primary-600" />{plan.max_reviewers} reviewers</li>
                    {features.doi_assignment && <li className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-primary-600" />DOI assignment</li>}
                    {features.plagiarism && <li className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-primary-600" />Plagiarism detection</li>}
                    {features.oai_pmh && <li className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-primary-600" />OAI-PMH indexing</li>}
                    {features.custom_branding && <li className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-primary-600" />Custom branding</li>}
                  </ul>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="btn-secondary"><ArrowLeft size={14} /> Back</button>
            <button onClick={handleSubmit(onSubmit)} disabled={!selectedPlan || creating} className="btn-primary">
              {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : <>Create & pay <CreditCard size={15} /></>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
