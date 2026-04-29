'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { billingApi } from '@/lib/api';
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';

type State = 'verifying' | 'success' | 'failed';

export default function BillingSuccessPage() {
  const params    = useSearchParams();
  const router    = useRouter();
  const reference = params.get('reference');
  const [state, setState] = useState<State>('verifying');
  const [plan,  setPlan]  = useState('');

  useEffect(() => {
    if (!reference) { setState('failed'); return; }

    billingApi.verify(reference)
      .then((res: any) => {
        const s = res?.data?.status;
        if (s === 'success') {
          setPlan(res.data.plan ?? '');
          setState('success');
        } else {
          setState('failed');
        }
      })
      .catch(() => setState('failed'));
  }, [reference]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="bg-white rounded-2xl shadow-card-md w-full max-w-md p-8 text-center">

        {state === 'verifying' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
            <h2 className="font-display text-xl font-semibold text-stone-900 mb-2">Verifying payment…</h2>
            <p className="text-sm text-stone-500">Please wait while we confirm your payment with Paystack.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="font-display text-xl font-semibold text-stone-900 mb-2">Payment successful!</h2>
            <p className="text-sm text-stone-500 mb-6">
              Your institution has been upgraded to the{' '}
              <strong className="text-stone-800 capitalize">{plan}</strong> plan. All features are now active.
            </p>
            <button onClick={() => router.push('/admin/billing')} className="btn-primary w-full">
              View subscription <ArrowRight size={14} />
            </button>
          </>
        )}

        {state === 'failed' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="font-display text-xl font-semibold text-stone-900 mb-2">Payment failed</h2>
            <p className="text-sm text-stone-500 mb-6">
              We could not verify your payment. If you were charged, please contact support with your reference: <code className="text-xs bg-stone-100 px-1.5 py-0.5 rounded">{reference}</code>
            </p>
            <button onClick={() => router.push('/admin/billing')} className="btn-secondary w-full">
              Back to billing
            </button>
          </>
        )}
      </div>
    </div>
  );
}
