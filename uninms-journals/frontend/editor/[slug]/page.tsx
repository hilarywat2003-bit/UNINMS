'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import {
  FileText, Users, CheckCircle2, XCircle, Clock, ArrowUpRight,
  UserPlus, Send, ChevronRight, Loader2, BarChart3, BookOpen, AlertTriangle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_META: Record<string,{ label: string; cls: string }> = {
  submitted:           { label: 'New',              cls: 'badge-blue' },
  with_editor:         { label: 'With editor',      cls: 'badge-stone' },
  under_review:        { label: 'Under review',     cls: 'badge-purple' },
  revision_requested:  { label: 'Revision req.',    cls: 'badge-gold' },
  resubmitted:         { label: 'Resubmitted',      cls: 'badge-blue' },
  accepted:            { label: 'Accepted',         cls: 'badge-green' },
  rejected:            { label: 'Rejected',         cls: 'badge-red' },
  published:           { label: 'Published',        cls: 'bg-stone-100 text-stone-600' },
  withdrawn:           { label: 'Withdrawn',        cls: 'badge-stone' },
};

function DecisionModal({ manuscript, onClose }: { manuscript: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { slug } = useParams<{ slug: string }>();
  const [decision, setDecision] = useState('');
  const [letter, setLetter] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post(`/journals/${slug}/editor/manuscripts/${manuscript.id}/decide`, { decision, letter }),
    onSuccess: () => {
      toast.success('Decision recorded');
      qc.invalidateQueries({ queryKey: ['editor-manuscripts', slug] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-card-md">
        <div className="p-6">
          <h3 className="font-display text-lg font-semibold text-stone-900 mb-1">Editorial decision</h3>
          <p className="text-sm text-stone-500 mb-5 line-clamp-1">{manuscript.title}</p>

          <div className="grid grid-cols-2 gap-2 mb-5">
            {[
              { val: 'accept',          label: 'Accept',          cls: 'border-primary-500 bg-primary-50 text-primary-800' },
              { val: 'minor_revision',  label: 'Minor revision',  cls: 'border-yellow-400 bg-yellow-50 text-yellow-800' },
              { val: 'major_revision',  label: 'Major revision',  cls: 'border-orange-400 bg-orange-50 text-orange-800' },
              { val: 'reject',          label: 'Reject',          cls: 'border-red-500 bg-red-50 text-red-800' },
            ].map(d => (
              <button key={d.val} onClick={() => setDecision(d.val)}
                className={`p-3 rounded-xl border-2 text-sm font-medium transition-all text-center
                  ${decision === d.val ? d.cls : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'}`}>
                {d.label}
              </button>
            ))}
          </div>

          <div>
            <label className="label">Decision letter to author</label>
            <textarea value={letter} onChange={e => setLetter(e.target.value)} rows={5}
              placeholder="Dear Author, thank you for your submission to…"
              className="input resize-none" />
          </div>

          <div className="flex gap-3 mt-5">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => mutation.mutate()} disabled={!decision || mutation.isPending}
              className="btn-primary flex-1">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send decision'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditorPanel() {
  const { slug } = useParams<{ slug: string }>();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [decisionMs, setDecisionMs] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['editor-manuscripts', slug, statusFilter],
    queryFn: () => api.get(`/journals/${slug}/editor/manuscripts`, {
      params: { status: statusFilter || undefined, limit: 50 }
    }).then(r => r.data.data),
    enabled: !!slug,
  });

  const manuscripts = Array.isArray(data) ? data : [];

  const moveToEditor = useMutation({
    mutationFn: (id: string) => api.patch(`/journals/${slug}/manuscripts/${id}`, { status: 'with_editor' }),
    onSuccess: () => { toast.success('Moved to editor review'); qc.invalidateQueries({ queryKey: ['editor-manuscripts'] }); },
  });

  const publish = useMutation({
    mutationFn: (id: string) => api.post(`/journals/${slug}/editor/manuscripts/${id}/publish`, { doi: '' }),
    onSuccess: () => { toast.success('Published and added to repository!'); qc.invalidateQueries({ queryKey: ['editor-manuscripts'] }); },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Publish failed'),
  });

  // Stats
  const stats = {
    total:    manuscripts.length,
    new:      manuscripts.filter((m: any) => m.status === 'submitted').length,
    review:   manuscripts.filter((m: any) => m.status === 'under_review').length,
    accepted: manuscripts.filter((m: any) => m.status === 'accepted').length,
    flagged:  manuscripts.filter((m: any) => m.plagiarism_status === 'flagged').length,
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-semibold text-stone-900">Editor Panel</h1>
          <p className="text-stone-500 text-sm mt-0.5">Manage manuscripts and peer review for this journal</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total',    value: stats.total,    icon: FileText,    color: 'text-stone-700 bg-stone-100' },
          { label: 'New',      value: stats.new,      icon: Clock,       color: 'text-blue-700 bg-blue-50' },
          { label: 'In review',value: stats.review,   icon: Users,       color: 'text-purple-700 bg-purple-50' },
          { label: 'Accepted', value: stats.accepted, icon: CheckCircle2,color: 'text-primary-700 bg-primary-50' },
          { label: 'Flagged',  value: stats.flagged,  icon: AlertTriangle,color:'text-red-700 bg-red-50' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wide">{s.label}</p>
                <p className="text-2xl font-display font-semibold text-stone-900 mt-0.5">{s.value}</p>
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}>
                <s.icon size={16} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="card p-3 mb-5 flex flex-wrap gap-2">
        {['','submitted','with_editor','under_review','revision_requested','accepted','rejected','published'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
              ${statusFilter===s ? 'bg-primary-800 text-white border-primary-800' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'}`}>
            {s === '' ? 'All' : STATUS_META[s]?.label ?? s}
          </button>
        ))}
      </div>

      {/* Manuscripts table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
        ) : manuscripts.length === 0 ? (
          <div className="text-center py-16">
            <FileText size={36} className="mx-auto mb-3 text-stone-300" />
            <p className="text-stone-400 text-sm">No manuscripts in this category</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  {['Reference','Title','Author','Reviewers','Plagiarism','Status','Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {manuscripts.map((ms: any) => {
                  const sm = STATUS_META[ms.status] ?? { label: ms.status, cls: 'badge-stone' };
                  const plagPct = ms.plagiarism_score ? Math.round(ms.plagiarism_score * 100) : null;
                  return (
                    <tr key={ms.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-stone-500">{ms.submission_no}</span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-sm font-medium text-stone-900 line-clamp-2">{ms.title}</p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {formatDistanceToNow(new Date(ms.submitted_at), { addSuffix: true })}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-stone-700">{ms.author_name}</p>
                        <p className="text-xs text-stone-400">{ms.author_email}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-stone-700">{ms.review_count}/{ms.reviewer_count}</span>
                        <p className="text-xs text-stone-400">done/assigned</p>
                      </td>
                      <td className="px-4 py-3">
                        {plagPct !== null ? (
                          <span className={`badge text-xs ${plagPct>=30?'badge-red':plagPct>=15?'badge-gold':'badge-green'}`}>
                            {plagPct}%
                          </span>
                        ) : <span className="text-xs text-stone-400">Pending</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge text-xs ${sm.cls}`}>{sm.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {ms.status === 'submitted' && (
                            <button onClick={() => moveToEditor.mutate(ms.id)}
                              className="btn-ghost btn-sm text-xs">Assign</button>
                          )}
                          {['with_editor','under_review','revision_requested','resubmitted'].includes(ms.status) && (
                            <button onClick={() => setDecisionMs(ms)}
                              className="btn-ghost btn-sm text-xs">Decide</button>
                          )}
                          {ms.status === 'accepted' && (
                            <button onClick={() => publish.mutate(ms.id)} disabled={publish.isPending}
                              className="btn-primary btn-sm text-xs">
                              {publish.isPending ? <Loader2 size={10} className="animate-spin" /> : 'Publish'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {decisionMs && <DecisionModal manuscript={decisionMs} onClose={() => setDecisionMs(null)} />}
    </div>
  );
}
