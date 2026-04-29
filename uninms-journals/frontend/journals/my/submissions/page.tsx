'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FileText, Clock, CheckCircle2, XCircle, BookOpen, ArrowUpRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

const STATUS_META: Record<string,{ label: string; cls: string; icon: React.ElementType }> = {
  submitted:          { label: 'Submitted',         cls: 'badge-blue',   icon: Clock },
  with_editor:        { label: 'With editor',       cls: 'badge-stone',  icon: Clock },
  under_review:       { label: 'Under review',      cls: 'badge-purple', icon: Clock },
  revision_requested: { label: 'Revision required', cls: 'badge-gold',   icon: Clock },
  resubmitted:        { label: 'Resubmitted',       cls: 'badge-blue',   icon: Clock },
  accepted:           { label: 'Accepted!',         cls: 'badge-green',  icon: CheckCircle2 },
  rejected:           { label: 'Rejected',          cls: 'badge-red',    icon: XCircle },
  published:          { label: 'Published',         cls: 'badge-green',  icon: BookOpen },
  withdrawn:          { label: 'Withdrawn',         cls: 'badge-stone',  icon: XCircle },
};

export default function MySubmissionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-submissions'],
    queryFn:  () => api.get('/journals/my/submissions').then(r => r.data.data),
  });

  const submissions = Array.isArray(data) ? data : [];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-stone-900">My manuscript submissions</h1>
        <p className="text-stone-500 text-sm mt-1">Track the status of all your submitted manuscripts.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
      ) : submissions.length === 0 ? (
        <div className="card p-16 text-center">
          <FileText size={40} className="mx-auto mb-3 text-stone-300" />
          <h3 className="font-display font-semibold text-stone-700 mb-1">No submissions yet</h3>
          <p className="text-stone-400 text-sm mb-4">Submit your research to a hosted journal.</p>
          <Link href="/journals" className="btn-primary inline-flex">Browse journals</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((ms: any) => {
            const sm = STATUS_META[ms.status] ?? { label: ms.status, cls: 'badge-stone', icon: Clock };
            const Icon = sm.icon;
            return (
              <div key={ms.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`badge text-xs ${sm.cls} flex items-center gap-1`}>
                        <Icon size={10} /> {sm.label}
                      </span>
                      <span className="font-mono text-xs text-stone-400">{ms.submission_no}</span>
                    </div>
                    <h3 className="font-medium text-stone-900 text-sm leading-snug">{ms.title}</h3>
                    <p className="text-xs text-stone-500 mt-1">
                      <Link href={`/journals/${ms.journal_slug}`} className="hover:text-primary-700 hover:underline">
                        {ms.journal_title}
                      </Link>
                    </p>
                  </div>
                  {ms.status === 'published' && (
                    <Link href={`/journals/${ms.journal_slug}`}
                      className="btn-primary btn-sm flex-shrink-0">
                      <ArrowUpRight size={12} /> View published
                    </Link>
                  )}
                </div>

                {/* Timeline */}
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-stone-100 text-xs text-stone-400">
                  <span>Submitted {formatDistanceToNow(new Date(ms.submitted_at), { addSuffix: true })}</span>
                  {ms.decision_at && (
                    <span>· Decision {formatDistanceToNow(new Date(ms.decision_at), { addSuffix: true })}</span>
                  )}
                  {ms.published_at && (
                    <span>· Published {formatDistanceToNow(new Date(ms.published_at), { addSuffix: true })}</span>
                  )}
                  {ms.plagiarism_score !== null && ms.plagiarism_score !== undefined && (
                    <span>· Similarity: {Math.round(ms.plagiarism_score * 100)}%</span>
                  )}
                </div>

                {/* Decision letter preview */}
                {ms.latest_decision_letter && ms.status !== 'published' && (
                  <div className="mt-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <p className="text-xs font-medium text-stone-600 mb-1">Editor decision letter:</p>
                    <p className="text-xs text-stone-500 line-clamp-3 leading-relaxed">{ms.latest_decision_letter}</p>
                  </div>
                )}

                {/* Revision notice */}
                {ms.status === 'revision_requested' && (
                  <div className="mt-3 p-3 bg-yellow-50 rounded-xl border border-yellow-200 flex items-start gap-2">
                    <Clock size={14} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-800">
                      <strong>Action required:</strong> The editor has requested revisions. Please address the feedback and resubmit.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
