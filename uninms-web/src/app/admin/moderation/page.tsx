'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import {
  FileText, CheckCircle2, XCircle, Eye, AlertTriangle,
  ChevronLeft, ChevronRight, X, Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import toast from 'react-hot-toast';

const STATUS_TABS = [
  { value: 'pending',  label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all',      label: 'All' },
];

function RejectModal({ doc, onClose }: { doc: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: () => adminApi.rejectDoc(doc.id, reason),
    onSuccess: () => {
      toast.success('Document rejected');
      qc.invalidateQueries({ queryKey: ['admin-moderation'] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card-md w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-stone-900">Reject document</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>
        <p className="text-sm text-stone-600 mb-4">Rejecting: <strong>{doc.title}</strong></p>
        <div>
          <label className="label">Rejection reason *</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Explain why this document is being rejected…"
            rows={4} className="input resize-none" autoFocus />
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!reason.trim() || mutation.isPending}
            className="flex-1 btn bg-red-600 text-white hover:bg-red-700">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle size={14} />} Reject
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminModerationPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('pending');
  const [page, setPage]     = useState(1);
  const [rejectTarget, setRejectTarget] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-moderation', status, page],
    queryFn:  () => adminApi.moderation({ status, page, limit: 15 }),
  });

  const docs       = (data?.data as any)?.documents ?? [];
  const total      = (data?.data as any)?.total ?? 0;
  const totalPages = (data?.data as any)?.totalPages ?? 1;

  const approve = useMutation({
    mutationFn: (docId: string) => adminApi.approveDoc(docId),
    onSuccess: () => {
      toast.success('Document approved and published');
      qc.invalidateQueries({ queryKey: ['admin-moderation'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <p className="text-stone-500 text-sm">{total.toLocaleString()} document{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 mb-5 bg-stone-100 p-1 rounded-xl w-fit">
        {STATUS_TABS.map(t => (
          <button key={t.value} onClick={() => { setStatus(t.value); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${status === t.value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-24 skeleton rounded-xl" />)}</div>
      ) : docs.length === 0 ? (
        <div className="card p-16 text-center">
          <FileText size={40} className="mx-auto mb-3 text-stone-300" />
          <h3 className="font-display font-semibold text-stone-700 mb-1">No documents</h3>
          <p className="text-stone-400 text-sm">Nothing to review in this category.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc: any) => (
            <div key={doc.id} className="card p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">
                  <FileText size={16} className="text-stone-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900 truncate">{doc.title}</p>
                      <p className="text-xs text-stone-400 mt-0.5">
                        By {doc.uploader_name} · {doc.department_name ?? 'No dept'} ·{' '}
                        {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`badge text-xs ${
                        doc.moderation_status === 'pending'  ? 'badge-gold' :
                        doc.moderation_status === 'approved' ? 'badge-green' : 'badge bg-red-50 text-red-600'
                      }`}>{doc.moderation_status}</span>
                      {doc.plagiarism_score != null && doc.plagiarism_score > 0.3 && (
                        <span className="badge badge-red text-xs flex items-center gap-1">
                          <AlertTriangle size={10} /> {Math.round(doc.plagiarism_score * 100)}% similar
                        </span>
                      )}
                    </div>
                  </div>
                  {doc.abstract && (
                    <p className="text-xs text-stone-500 mt-2 line-clamp-2">{doc.abstract}</p>
                  )}
                  {doc.moderation_note && (
                    <div className="mt-2 p-2 bg-red-50 rounded-lg">
                      <p className="text-xs text-red-600"><strong>Rejection reason:</strong> {doc.moderation_note}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <Link href={`/repository/${doc.id}`} target="_blank"
                      className="btn-secondary btn-sm">
                      <Eye size={12} /> Preview
                    </Link>
                    {doc.moderation_status !== 'approved' && (
                      <button onClick={() => approve.mutate(doc.id)}
                        disabled={approve.isPending}
                        className="btn-sm btn bg-green-600 text-white hover:bg-green-700">
                        <CheckCircle2 size={12} /> Approve
                      </button>
                    )}
                    {doc.moderation_status !== 'rejected' && (
                      <button onClick={() => setRejectTarget(doc)}
                        className="btn-sm btn bg-red-100 text-red-700 hover:bg-red-200">
                        <XCircle size={12} /> Reject
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary btn-sm"><ChevronLeft size={14} /></button>
          <span className="text-sm text-stone-600">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary btn-sm"><ChevronRight size={14} /></button>
        </div>
      )}

      {rejectTarget && <RejectModal doc={rejectTarget} onClose={() => setRejectTarget(null)} />}
    </div>
  );
}
