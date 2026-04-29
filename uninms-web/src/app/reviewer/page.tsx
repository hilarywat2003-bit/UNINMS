'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  FileText, CheckCircle2, XCircle, Clock, Star, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { formatDistanceToNow, isPast } from 'date-fns';
import toast from 'react-hot-toast';

const ASSIGNMENT_META: Record<string, { label: string; cls: string }> = {
  invited:   { label: 'Invitation pending', cls: 'badge-blue' },
  accepted:  { label: 'Accepted',           cls: 'badge-green' },
  declined:  { label: 'Declined',           cls: 'badge-red' },
  completed: { label: 'Completed',          cls: 'badge-stone' },
  overdue:   { label: 'Overdue',            cls: 'badge-red' },
};

function ReviewForm({ assignment, onClose }: { assignment: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    recommendation: '', commentsToEditor: '', commentsToAuthor: '',
    originalityScore: 3, methodologyScore: 3, clarityScore: 3, significanceScore: 3, overallScore: 3,
  });

  const mutation = useMutation({
    mutationFn: () => api.post(`/journals/reviews/${assignment.assignment_id}/report`, form),
    onSuccess: () => {
      toast.success('Review submitted. +30 points earned!');
      qc.invalidateQueries({ queryKey: ['reviewer-assignments'] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const ScoreRow = ({ label, field }: { label: string; field: string }) => (
    <div className="flex items-center gap-3">
      <span className="text-sm text-stone-600 w-32 flex-shrink-0">{label}</span>
      <div className="flex gap-1">
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button"
            onClick={() => setForm(f => ({ ...f, [field]: n }))}
            className={`w-8 h-8 rounded-lg border text-xs font-bold transition-all
              ${(form as any)[field]===n ? 'bg-primary-700 text-white border-primary-700' : 'border-stone-200 text-stone-500 hover:border-stone-400'}`}>
            {n}
          </button>
        ))}
      </div>
      <span className="text-xs text-stone-400">/ 5</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-card-md my-8">
        <div className="p-6">
          <h3 className="font-display text-lg font-semibold text-stone-900 mb-1">Submit review report</h3>
          <p className="text-sm text-stone-500 mb-5 line-clamp-1">{assignment.title}</p>

          {/* Recommendation */}
          <div className="mb-5">
            <label className="label">Recommendation *</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: 'accept',         label: 'Accept',          cls: 'border-primary-500 bg-primary-50 text-primary-800' },
                { val: 'minor_revision', label: 'Minor revision',  cls: 'border-yellow-400 bg-yellow-50 text-yellow-800' },
                { val: 'major_revision', label: 'Major revision',  cls: 'border-orange-400 bg-orange-50 text-orange-800' },
                { val: 'reject',         label: 'Reject',          cls: 'border-red-500 bg-red-50 text-red-800' },
              ].map(d => (
                <button key={d.val} type="button" onClick={() => setForm(f => ({ ...f, recommendation: d.val }))}
                  className={`p-3 rounded-xl border-2 text-sm font-medium text-center transition-all
                    ${form.recommendation===d.val ? d.cls : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scores */}
          <div className="mb-5 p-4 bg-stone-50 rounded-xl space-y-3">
            <p className="text-sm font-medium text-stone-700 mb-3">Evaluation scores (1–5)</p>
            <ScoreRow label="Originality"   field="originalityScore"  />
            <ScoreRow label="Methodology"   field="methodologyScore"  />
            <ScoreRow label="Clarity"       field="clarityScore"      />
            <ScoreRow label="Significance"  field="significanceScore" />
            <ScoreRow label="Overall"       field="overallScore"      />
          </div>

          {/* Comments */}
          <div className="space-y-4">
            <div>
              <label className="label">Comments to author <span className="text-stone-400 font-normal">(shared with author)</span></label>
              <textarea value={form.commentsToAuthor} onChange={e => setForm(f => ({ ...f, commentsToAuthor: e.target.value }))}
                rows={4} placeholder="Specific feedback for the author on how to improve the manuscript…"
                className="input resize-none" />
            </div>
            <div>
              <label className="label">Comments to editor <span className="text-stone-400 font-normal">(confidential)</span></label>
              <textarea value={form.commentsToEditor} onChange={e => setForm(f => ({ ...f, commentsToEditor: e.target.value }))}
                rows={3} placeholder="Confidential notes for the editor only…"
                className="input resize-none" />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => mutation.mutate()}
              disabled={!form.recommendation || mutation.isPending}
              className="btn-primary flex-1">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit review'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReviewerDashboard() {
  const qc = useQueryClient();
  const [reviewForm, setReviewForm] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['reviewer-assignments'],
    queryFn: () => api.get('/journals/reviews/assigned').then(r => r.data.data),
  });

  const assignments = Array.isArray(data) ? data : [];

  const respond = useMutation({
    mutationFn: ({ id, response }: { id: string; response: string }) =>
      api.patch(`/journals/reviews/${id}/respond`, { response }),
    onSuccess: (_, { response }) => {
      toast.success(`Invitation ${response}`);
      qc.invalidateQueries({ queryKey: ['reviewer-assignments'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const pending    = assignments.filter((a: any) => a.assignment_status === 'invited');
  const active     = assignments.filter((a: any) => a.assignment_status === 'accepted');
  const completed  = assignments.filter((a: any) => a.assignment_status === 'completed');

  return (
    <div className="max-w-4xl mx-auto">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Pending invitations', value: pending.length,   cls: 'text-blue-700 bg-blue-50' },
          { label: 'Active reviews',       value: active.length,   cls: 'text-primary-700 bg-primary-50' },
          { label: 'Completed',            value: completed.length,cls: 'text-stone-600 bg-stone-100' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <p className="text-2xl font-display font-semibold text-stone-900">{s.value}</p>
            <p className="text-xs text-stone-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
      ) : assignments.length === 0 ? (
        <div className="card p-16 text-center">
          <Star size={40} className="mx-auto mb-3 text-stone-300" />
          <h3 className="font-display font-semibold text-stone-700 mb-1">No review assignments</h3>
          <p className="text-stone-400 text-sm">Journal editors will invite you to review manuscripts.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((a: any) => {
            const sm = ASSIGNMENT_META[a.assignment_status] ?? { label: a.assignment_status, cls: 'badge-stone' };
            const isOverdue = a.due_date && isPast(new Date(a.due_date)) && a.assignment_status === 'accepted';
            return (
              <div key={a.assignment_id} className={`card ${isOverdue ? 'border-l-4 border-l-red-400' : ''}`}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`badge text-xs ${sm.cls}`}>{sm.label}</span>
                        {isOverdue && <span className="badge-red badge text-xs">Overdue</span>}
                        {a.report_id && <span className="badge-green badge text-xs">Report submitted</span>}
                      </div>
                      <p className="font-medium text-stone-900 text-sm mt-2 line-clamp-2">{a.title}</p>
                      <p className="text-xs text-stone-500 mt-1">{a.journal_title}</p>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      {a.assignment_status === 'invited' && (
                        <>
                          <button onClick={() => respond.mutate({ id: a.assignment_id, response: 'accepted' })}
                            disabled={respond.isPending}
                            className="btn-primary btn-sm">
                            <CheckCircle2 size={12} /> Accept
                          </button>
                          <button onClick={() => respond.mutate({ id: a.assignment_id, response: 'declined' })}
                            disabled={respond.isPending}
                            className="btn-secondary btn-sm text-red-600">
                            <XCircle size={12} /> Decline
                          </button>
                        </>
                      )}
                      {a.assignment_status === 'accepted' && !a.report_id && (
                        <button onClick={() => setReviewForm(a)} className="btn-primary btn-sm">
                          Submit review
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Due date */}
                  {a.due_date && a.assignment_status !== 'completed' && (
                    <div className={`flex items-center gap-1.5 mt-3 text-xs ${isOverdue ? 'text-red-600' : 'text-stone-500'}`}>
                      <Clock size={11} />
                      Due {new Date(a.due_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {isOverdue && ' — OVERDUE'}
                    </div>
                  )}

                  {/* Abstract expand */}
                  {a.abstract && (
                    <div className="mt-3">
                      <button onClick={() => setExpanded(expanded === a.assignment_id ? null : a.assignment_id)}
                        className="text-xs text-primary-700 hover:underline flex items-center gap-1">
                        {expanded === a.assignment_id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {expanded === a.assignment_id ? 'Hide abstract' : 'View abstract'}
                      </button>
                      {expanded === a.assignment_id && (
                        <p className="mt-2 text-sm text-stone-600 leading-relaxed bg-stone-50 rounded-xl p-3">{a.abstract}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {reviewForm && <ReviewForm assignment={reviewForm} onClose={() => setReviewForm(null)} />}
    </div>
  );
}
