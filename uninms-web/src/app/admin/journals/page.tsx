'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  BookOpen, CheckCircle2, XCircle, Clock, CreditCard,
  Plus, AlertTriangle, Loader2, ArrowUpRight, CalendarDays,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

const STATUS_META: Record<string, { icon: React.ElementType; label: string; cls: string; desc: string }> = {
  active:           { icon: CheckCircle2, label: 'Active',           cls: 'text-primary-700 bg-primary-50 border-primary-200', desc: 'Your journal is live and accepting submissions.' },
  payment_received: { icon: Clock,        label: 'Under review',     cls: 'text-blue-700 bg-blue-50 border-blue-200',          desc: 'Payment confirmed. Awaiting super admin approval.' },
  pending_payment:  { icon: CreditCard,   label: 'Payment pending',  cls: 'text-gold-700 bg-yellow-50 border-yellow-200',       desc: 'Journal created. Payment required to activate.' },
  rejected:         { icon: XCircle,      label: 'Rejected',         cls: 'text-red-700 bg-red-50 border-red-200',             desc: 'Application was not approved. See reason below.' },
  suspended:        { icon: AlertTriangle,label: 'Suspended',        cls: 'text-orange-700 bg-orange-50 border-orange-200',    desc: 'Journal has been suspended by UniNMS.' },
};

export default function AdminJournalsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-my-journals'],
    queryFn:  () => api.get('/journal-billing/my').then(r => r.data.data),
  });

  const journals = Array.isArray(data) ? data : [];

  const fmt = (n: number) => new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', maximumFractionDigits: 0,
  }).format(n);

  if (isLoading) return (
    <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-semibold text-stone-900">Institutional journals</h1>
          <p className="text-stone-500 text-sm mt-0.5">Manage your university's hosted journals and subscriptions</p>
        </div>
        <Link href="/admin/journals/create" className="btn-primary">
          <Plus size={14} /> Create journal
        </Link>
      </div>

      {journals.length === 0 ? (
        <div className="card p-16 text-center">
          <BookOpen size={48} className="mx-auto mb-4 text-stone-300" />
          <h3 className="font-display text-xl font-semibold text-stone-700 mb-2">No journals yet</h3>
          <p className="text-stone-400 text-sm mb-6 max-w-sm mx-auto">
            Create a hosted journal for your institution. Departments can submit papers, reviewers can be assigned, and published articles are indexed globally.
          </p>
          <Link href="/admin/journals/create" className="btn-primary inline-flex">
            <Plus size={14} /> Create your first journal
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {journals.map((j: any) => {
            const sm = STATUS_META[j.subscription_status] ?? STATUS_META.pending_payment;
            const Icon = sm.icon;
            const isExpiringSoon = j.expires_at && new Date(j.expires_at) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            return (
              <div key={j.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                      <BookOpen size={20} className="text-primary-700" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-stone-900">{j.title}</h3>
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium mt-1.5 ${sm.cls}`}>
                        <Icon size={11} />
                        {sm.label}
                      </div>
                    </div>
                  </div>

                  {j.subscription_status === 'active' && (
                    <Link href={`/journals/${j.slug}`} target="_blank"
                      className="btn-secondary btn-sm flex-shrink-0">
                      <ArrowUpRight size={13} /> View journal
                    </Link>
                  )}
                  {j.subscription_status === 'pending_payment' && j.paystack_ref && (
                    <Link href={`/admin/journals/billing/success?ref=${j.paystack_ref}&journalId=${j.id}`}
                      className="btn-primary btn-sm flex-shrink-0">
                      <CreditCard size={13} /> Complete payment
                    </Link>
                  )}
                </div>

                <p className="text-xs text-stone-500 mt-3 ml-16">{sm.desc}</p>

                {j.rejection_reason && (
                  <div className="mt-3 ml-16 p-3 bg-red-50 rounded-xl border border-red-200">
                    <p className="text-xs font-medium text-red-700 mb-0.5">Rejection reason:</p>
                    <p className="text-xs text-red-600">{j.rejection_reason}</p>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-stone-100 ml-16 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Plan',    value: j.plan_name ?? '—' },
                    { label: 'Billing', value: j.billing_cycle ?? '—' },
                    { label: 'Amount',  value: j.paid_amount ? fmt(j.paid_amount) : '—' },
                    { label: 'Expires', value: j.expires_at ? new Date(j.expires_at).toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' }) : '—' },
                  ].map(f => (
                    <div key={f.label}>
                      <p className="text-xs text-stone-400 uppercase tracking-wide">{f.label}</p>
                      <p className={`text-sm font-medium mt-0.5 ${f.label === 'Expires' && isExpiringSoon ? 'text-orange-600' : 'text-stone-800'}`}>
                        {f.value}
                      </p>
                    </div>
                  ))}
                </div>

                {isExpiringSoon && j.subscription_status === 'active' && (
                  <div className="mt-3 ml-16 flex items-center gap-2 p-2.5 bg-orange-50 rounded-xl border border-orange-200">
                    <CalendarDays size={13} className="text-orange-600 flex-shrink-0" />
                    <p className="text-xs text-orange-700">
                      Subscription expires {formatDistanceToNow(new Date(j.expires_at), { addSuffix: true })}. Renew to keep your journal active.
                    </p>
                  </div>
                )}

                {j.paystack_ref && j.subscription_status !== 'pending_payment' && (
                  <p className="text-xs text-stone-400 mt-3 ml-16 font-mono">Ref: {j.paystack_ref}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
