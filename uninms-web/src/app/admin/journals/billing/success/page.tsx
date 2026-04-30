'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

function BillingSuccessInner() {
  const params  = useSearchParams();
  const router  = useRouter();
  const ref     = params.get('ref');
  const jId     = params.get('journalId');

  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [msg,    setMsg]    = useState('');

  useEffect(() => {
    if (!ref) { setStatus('failed'); setMsg('No payment reference found.'); return; }

    api.get(`/journal-billing/verify/${ref}`)
      .then(res => {
        const d = res.data.data;
        if (d.status === 'payment_received' || d.status === 'already_verified') {
          setStatus('success');
          setMsg(d.message || 'Payment confirmed. Awaiting super admin approval.');
        } else {
          setStatus('failed');
          setMsg('Payment could not be verified.');
        }
      })
      .catch(err => {
        setStatus('failed');
        setMsg(err?.response?.data?.error?.message ?? 'Payment verification failed.');
      });
  }, [ref]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-10 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
            <h2 className="font-display text-xl font-semibold text-stone-900 mb-2">Verifying payment…</h2>
            <p className="text-stone-500 text-sm">Please wait while we confirm your payment with Paystack.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-primary-50 border-2 border-primary-200 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-primary-700" />
            </div>
            <h2 className="font-display text-2xl font-semibold text-stone-900 mb-2">Payment confirmed!</h2>
            <p className="text-stone-500 text-sm mb-6 leading-relaxed">{msg}</p>

            <div className="bg-stone-50 rounded-xl p-4 text-left mb-6 space-y-2">
              <p className="text-xs font-medium text-stone-700">What happens next:</p>
              <ol className="text-xs text-stone-500 space-y-1.5 list-decimal list-inside">
                <li>UniNMS super admin reviews your journal details</li>
                <li>Approval typically takes up to 24 hours</li>
                <li>You will receive a notification when approved</li>
                <li>Your journal will go live and accept submissions</li>
              </ol>
            </div>

            <div className="flex flex-col gap-2">
              <Link href="/admin/journals" className="btn-primary w-full">
                View my journals <ArrowRight size={14} />
              </Link>
              <Link href="/admin" className="btn-secondary w-full">Back to admin panel</Link>
            </div>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="font-display text-2xl font-semibold text-stone-900 mb-2">Payment issue</h2>
            <p className="text-stone-500 text-sm mb-6">{msg}</p>
            <div className="flex flex-col gap-2">
              <Link href="/admin/journals" className="btn-primary w-full">My journals</Link>
              <Link href="/admin" className="btn-secondary w-full">Admin panel</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-stone-400" /></div>}>
      <BillingSuccessInner />
    </Suspense>
  );
}
