'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import {
  FileText, Users, CheckCircle2, XCircle, Clock, Plus,
  UserPlus, Loader2, BookOpen, AlertTriangle, Search,
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

// ── Decision Modal ─────────────────────────────────────────────────────────────
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
              { val: 'accept',         label: 'Accept',         cls: 'border-primary-500 bg-primary-50 text-primary-800' },
              { val: 'minor_revision', label: 'Minor revision',  cls: 'border-yellow-400 bg-yellow-50 text-yellow-800' },
              { val: 'major_revision', label: 'Major revision',  cls: 'border-orange-400 bg-orange-50 text-orange-800' },
              { val: 'reject',         label: 'Reject',          cls: 'border-red-500 bg-red-50 text-red-800' },
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

// ── Assign Reviewer Modal ──────────────────────────────────────────────────────
function AssignReviewerModal({ manuscript, onClose }: { manuscript: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { slug } = useParams<{ slug: string }>();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [dueDate, setDueDate] = useState('');

  const { data: users, isLoading } = useQuery({
    queryKey: ['editor-users', slug, search],
    queryFn: () => api.get(`/journals/${slug}/editor/users`, { params: { search } }).then(r => r.data.data),
    enabled: !!slug,
  });

  const assign = useMutation({
    mutationFn: () => api.post(`/journals/${slug}/editor/manuscripts/${manuscript.id}/assign`, {
      reviewerId: selectedUser.id,
      dueDate: dueDate || undefined,
    }),
    onSuccess: () => {
      toast.success(`${selectedUser.full_name} assigned as reviewer`);
      qc.invalidateQueries({ queryKey: ['editor-manuscripts', slug] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed to assign'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-card-md">
        <div className="p-6">
          <h3 className="font-display text-lg font-semibold text-stone-900 mb-1">Assign reviewer</h3>
          <p className="text-sm text-stone-500 mb-4 line-clamp-1">{manuscript.title}</p>

          {/* Search users */}
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedUser(null); }}
              placeholder="Search by name or email…"
              className="input pl-9" />
          </div>

          {/* User list */}
          <div className="border border-stone-200 rounded-xl overflow-hidden mb-4 max-h-52 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center"><Loader2 size={16} className="animate-spin text-stone-400 mx-auto" /></div>
            ) : !users?.length ? (
              <p className="p-4 text-sm text-stone-400 text-center">No users found</p>
            ) : (
              users.map((u: any) => (
                <button key={u.id} onClick={() => setSelectedUser(u)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b last:border-0 border-stone-100 transition-colors
                    ${selectedUser?.id === u.id ? 'bg-primary-50' : 'hover:bg-stone-50'}`}>
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-700 text-xs font-semibold">
                      {u.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">{u.full_name}</p>
                    <p className="text-xs text-stone-400 truncate">{u.email} {u.department_name ? `· ${u.department_name}` : ''}</p>
                  </div>
                  {selectedUser?.id === u.id && <CheckCircle2 size={16} className="text-primary-700 flex-shrink-0" />}
                </button>
              ))
            )}
          </div>

          {/* Due date */}
          <div className="mb-5">
            <label className="label">Review due date <span className="text-stone-400 font-normal">(optional)</span></label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="input" min={new Date().toISOString().split('T')[0]} />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => assign.mutate()} disabled={!selectedUser || assign.isPending}
              className="btn-primary flex-1">
              {assign.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assign reviewer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Volume / Issue Modal ───────────────────────────────────────────────────────
function VolumeIssueModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { slug } = useParams<{ slug: string }>();
  const [tab, setTab] = useState<'volume'|'issue'>('volume');
  const [vol, setVol] = useState({ volumeNo: '', year: String(new Date().getFullYear()) });
  const [iss, setIss] = useState({ volumeId: '', issueNo: '', title: '' });

  const { data: volumes } = useQuery({
    queryKey: ['editor-volumes', slug],
    queryFn: () => api.get(`/journals/${slug}`).then(r => r.data.data.volumes ?? []),
    enabled: !!slug,
  });

  const createVol = useMutation({
    mutationFn: () => api.post(`/journals/${slug}/volumes`, { volumeNo: parseInt(vol.volumeNo), year: parseInt(vol.year) }),
    onSuccess: () => {
      toast.success('Volume created');
      qc.invalidateQueries({ queryKey: ['editor-volumes', slug] });
      setVol({ volumeNo: '', year: String(new Date().getFullYear()) });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const createIss = useMutation({
    mutationFn: () => api.post(`/journals/${slug}/volumes/${iss.volumeId}/issues`, {
      issueNo: parseInt(iss.issueNo), title: iss.title || undefined,
    }),
    onSuccess: () => {
      toast.success('Issue created');
      qc.invalidateQueries({ queryKey: ['editor-volumes', slug] });
      setIss(i => ({ ...i, issueNo: '', title: '' }));
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-card-md">
        <div className="p-6 border-b border-stone-100">
          <h3 className="font-display text-lg font-semibold text-stone-900">Volumes & Issues</h3>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-100">
          {(['volume','issue'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium capitalize transition-colors
                ${tab === t ? 'text-primary-700 border-b-2 border-primary-700' : 'text-stone-500 hover:text-stone-700'}`}>
              New {t}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          {tab === 'volume' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Volume number *</label>
                  <input type="number" value={vol.volumeNo} onChange={e => setVol(v => ({ ...v, volumeNo: e.target.value }))}
                    placeholder="e.g. 1" className="input" min="1" />
                </div>
                <div>
                  <label className="label">Year *</label>
                  <input type="number" value={vol.year} onChange={e => setVol(v => ({ ...v, year: e.target.value }))}
                    placeholder={String(new Date().getFullYear())} className="input" min="2000" max="2099" />
                </div>
              </div>
              <button onClick={() => createVol.mutate()} disabled={!vol.volumeNo || createVol.isPending}
                className="btn-primary w-full">
                {createVol.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Create volume'}
              </button>

              {/* Existing volumes */}
              {volumes?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-stone-100">
                  <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-2">Existing volumes</p>
                  {volumes.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between text-sm py-1.5">
                      <span className="text-stone-700">Vol. {v.volume_no} ({v.year})</span>
                      <span className="text-xs text-stone-400">{v.issues?.length ?? 0} issues</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="label">Volume *</label>
                <select value={iss.volumeId} onChange={e => setIss(i => ({ ...i, volumeId: e.target.value }))}
                  className="input">
                  <option value="">Select volume…</option>
                  {volumes?.map((v: any) => (
                    <option key={v.id} value={v.id}>Vol. {v.volume_no} ({v.year})</option>
                  ))}
                </select>
                {!volumes?.length && <p className="text-xs text-stone-400 mt-1">Create a volume first.</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Issue number *</label>
                  <input type="number" value={iss.issueNo} onChange={e => setIss(i => ({ ...i, issueNo: e.target.value }))}
                    placeholder="e.g. 1" className="input" min="1" />
                </div>
                <div>
                  <label className="label">Title <span className="text-stone-400 font-normal">(optional)</span></label>
                  <input value={iss.title} onChange={e => setIss(i => ({ ...i, title: e.target.value }))}
                    placeholder="Special issue…" className="input" />
                </div>
              </div>
              <button onClick={() => createIss.mutate()} disabled={!iss.volumeId || !iss.issueNo || createIss.isPending}
                className="btn-primary w-full">
                {createIss.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Create issue'}
              </button>
            </>
          )}
        </div>

        <div className="px-6 pb-6">
          <button onClick={onClose} className="btn-secondary w-full">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Publish Modal ──────────────────────────────────────────────────────────────
function PublishModal({ manuscript, onClose }: { manuscript: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { slug } = useParams<{ slug: string }>();

  // Auto-suggest a DOI: 10.uninms/{slug}.{year}.{zero-padded submission seq}
  const seq = manuscript.submission_no?.split('-').pop() ?? '0001';
  const suggestedDoi = `10.uninms/${slug}.${new Date().getFullYear()}.${seq}`;

  const [doi, setDoi] = useState('');
  const [pages, setPages] = useState('');
  const [issueId, setIssueId] = useState('');

  // Load volumes with issues
  const { data: journal } = useQuery({
    queryKey: ['journal-volumes', slug],
    queryFn: () => api.get(`/journals/${slug}`).then(r => r.data.data),
    enabled: !!slug,
  });

  const volumes: any[] = journal?.volumes ?? [];
  // Flatten all open issues from all volumes
  const issues = volumes.flatMap((v: any) =>
    (v.issues ?? []).map((i: any) => ({ ...i, volumeLabel: `Vol. ${v.volume_no} (${v.year})` }))
  );

  const publish = useMutation({
    mutationFn: () => api.post(`/journals/${slug}/editor/manuscripts/${manuscript.id}/publish`, {
      doi: doi || undefined,
      pages: pages || undefined,
      issueId: issueId || undefined,
    }),
    onSuccess: () => {
      toast.success('Published and added to repository!');
      qc.invalidateQueries({ queryKey: ['editor-manuscripts', slug] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Publish failed'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-card-md">
        <div className="p-6">
          <h3 className="font-display text-lg font-semibold text-stone-900 mb-1">Publish manuscript</h3>
          <p className="text-sm text-stone-500 mb-5 line-clamp-1">{manuscript.title}</p>

          <div className="space-y-4">
            {/* Issue assignment */}
            <div>
              <label className="label">Assign to issue <span className="text-stone-400 font-normal">(recommended)</span></label>
              <select value={issueId} onChange={e => setIssueId(e.target.value)} className="input">
                <option value="">No issue (standalone article)</option>
                {issues.length === 0 && <option disabled>No issues — create one in Volumes & Issues first</option>}
                {issues.map((i: any) => (
                  <option key={i.id} value={i.id}>
                    {i.volumeLabel} · Issue {i.issue_no}{i.title ? ` — ${i.title}` : ''}
                  </option>
                ))}
              </select>
              {issues.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No issues available. Use "Volumes & Issues" button to create one first.
                </p>
              )}
            </div>

            {/* DOI */}
            <div>
              <label className="label">DOI <span className="text-stone-400 font-normal">(optional)</span></label>
              <input value={doi} onChange={e => setDoi(e.target.value)}
                placeholder={suggestedDoi} className="input" />
              {!doi && (
                <button type="button" onClick={() => setDoi(suggestedDoi)}
                  className="text-xs text-primary-700 hover:underline mt-1 block">
                  Use suggested: {suggestedDoi}
                </button>
              )}
            </div>

            {/* Pages */}
            <div>
              <label className="label">Pages <span className="text-stone-400 font-normal">(optional)</span></label>
              <input value={pages} onChange={e => setPages(e.target.value)}
                placeholder="e.g. 1-15" className="input" />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => publish.mutate()} disabled={publish.isPending}
              className="btn-primary flex-1">
              {publish.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publish article'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Editor Panel ──────────────────────────────────────────────────────────
export default function EditorPanel() {
  const { slug } = useParams<{ slug: string }>();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [decisionMs, setDecisionMs] = useState<any>(null);
  const [assignMs, setAssignMs] = useState<any>(null);
  const [publishMs, setPublishMs] = useState<any>(null);
  const [showVolumes, setShowVolumes] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['editor-manuscripts', slug, statusFilter],
    queryFn: () => api.get(`/journals/${slug}/editor/manuscripts`, {
      params: { status: statusFilter || undefined, limit: 50 }
    }).then(r => r.data.data),
    enabled: !!slug,
  });

  const manuscripts = Array.isArray(data) ? data : [];

  const moveToEditor = useMutation({
    mutationFn: (id: string) => api.patch(`/journals/${slug}/editor/manuscripts/${id}/status`, { status: 'with_editor' }),
    onSuccess: () => { toast.success('Moved to editor review'); qc.invalidateQueries({ queryKey: ['editor-manuscripts', slug] }); },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });


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
        <button onClick={() => setShowVolumes(true)} className="btn-secondary">
          <BookOpen size={14} /> Volumes & Issues
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total',     value: stats.total,    icon: FileText,     color: 'text-stone-700 bg-stone-100' },
          { label: 'New',       value: stats.new,      icon: Clock,        color: 'text-blue-700 bg-blue-50' },
          { label: 'In review', value: stats.review,   icon: Users,        color: 'text-purple-700 bg-purple-50' },
          { label: 'Accepted',  value: stats.accepted, icon: CheckCircle2, color: 'text-primary-700 bg-primary-50' },
          { label: 'Flagged',   value: stats.flagged,  icon: AlertTriangle,color: 'text-red-700 bg-red-50' },
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

      {/* Status filter */}
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
                  const plagPct = ms.plagiarism_score != null ? Math.round(ms.plagiarism_score * 100) : null;
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
                        ) : <span className="text-xs text-stone-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge text-xs ${sm.cls}`}>{sm.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {/* Step 1: submitted → move to editor */}
                          {ms.status === 'submitted' && (
                            <button onClick={() => moveToEditor.mutate(ms.id)} disabled={moveToEditor.isPending}
                              className="btn-ghost btn-sm text-xs">
                              {moveToEditor.isPending ? <Loader2 size={10} className="animate-spin" /> : 'Accept'}
                            </button>
                          )}
                          {/* Step 2: assign reviewer */}
                          {['with_editor','under_review'].includes(ms.status) && (
                            <button onClick={() => setAssignMs(ms)}
                              className="btn-ghost btn-sm text-xs">
                              <UserPlus size={11} /> Assign
                            </button>
                          )}
                          {/* Step 3: make decision */}
                          {['with_editor','under_review','revision_requested','resubmitted'].includes(ms.status) && (
                            <button onClick={() => setDecisionMs(ms)}
                              className="btn-ghost btn-sm text-xs">Decide</button>
                          )}
                          {/* Step 4: publish accepted */}
                          {ms.status === 'accepted' && (
                            <button onClick={() => setPublishMs(ms)}
                              className="btn-primary btn-sm text-xs">
                              Publish
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

      {decisionMs  && <DecisionModal manuscript={decisionMs} onClose={() => setDecisionMs(null)} />}
      {assignMs    && <AssignReviewerModal manuscript={assignMs} onClose={() => setAssignMs(null)} />}
      {publishMs   && <PublishModal manuscript={publishMs} onClose={() => setPublishMs(null)} />}
      {showVolumes && <VolumeIssueModal onClose={() => setShowVolumes(false)} />}
    </div>
  );
}
