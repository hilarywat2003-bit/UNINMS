'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  BookOpen, Plus, Edit, Globe, Loader2,
  CheckCircle2, XCircle, Clock, UserPlus, Search, Trash2,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth.store';

type Journal = {
  id: string; slug: string; title: string; status: string;
  frequency: string; review_type: string; is_open_access: boolean;
  issn_online: string | null; article_count: number; editor_name: string | null;
  department_name: string | null; university_name: string | null;
};

function CreateJournalModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.roles?.includes('super_admin');

  const [form, setForm] = useState({
    title: '', scope: '', description: '', frequency: 'biannual',
    reviewType: 'double_blind', isOpenAccess: true, language: 'English',
    issn_print: '', issn_online: '', subjects: '',
    universityId: '',
  });
  const [saving, setSaving] = useState(false);

  // Load universities list for super_admin
  const { data: universities } = useQuery({
    queryKey: ['universities-list'],
    queryFn: () => api.get('/auth/universities').then(r => r.data.data),
    enabled: !!isSuperAdmin,
  });

  const submit = async () => {
    if (!form.title) return toast.error('Title is required');
    if (isSuperAdmin && !form.universityId) return toast.error('Select a university');
    setSaving(true);
    try {
      await api.post('/journals', {
        ...form,
        subjects: form.subjects ? form.subjects.split(',').map(s => s.trim()).filter(Boolean) : [],
        universityId: form.universityId || undefined,
      });
      toast.success('Journal created');
      qc.invalidateQueries({ queryKey: ['admin-journals'] });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to create journal');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-card-md my-8">
        <div className="p-6 border-b border-stone-100">
          <h2 className="font-display text-lg font-semibold text-stone-900">Create new journal</h2>
          <p className="text-sm text-stone-500 mt-0.5">Set up a new peer-reviewed journal for your university.</p>
        </div>
        <div className="p-6 space-y-4">

          {/* University selector — super_admin only */}
          {isSuperAdmin && (
            <div>
              <label className="label">University *</label>
              <select value={form.universityId}
                onChange={e => setForm(f => ({ ...f, universityId: e.target.value }))}
                className="input">
                <option value="">Select university…</option>
                {(universities ?? []).map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.short_name})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">Journal title *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Journal of Computer Science Education" className="input" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Print ISSN</label>
              <input value={form.issn_print} onChange={e => setForm(f => ({ ...f, issn_print: e.target.value }))}
                placeholder="e.g. 2756-0001" className="input" />
            </div>
            <div>
              <label className="label">Online ISSN</label>
              <input value={form.issn_online} onChange={e => setForm(f => ({ ...f, issn_online: e.target.value }))}
                placeholder="e.g. 2756-0002" className="input" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Publication frequency</label>
              <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                className="input">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="biannual">Bi-annual</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div>
              <label className="label">Review type</label>
              <select value={form.reviewType} onChange={e => setForm(f => ({ ...f, reviewType: e.target.value }))}
                className="input">
                <option value="double_blind">Double blind</option>
                <option value="single_blind">Single blind</option>
                <option value="open">Open review</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Aims & scope</label>
            <textarea value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}
              rows={3} placeholder="Describe the aims and scope of the journal…" className="input resize-none" />
          </div>

          <div>
            <label className="label">Description <span className="text-stone-400 font-normal">(short, shown on cards)</span></label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="One-line description" className="input" />
          </div>

          <div>
            <label className="label">Subject areas <span className="text-stone-400 font-normal">(comma-separated)</span></label>
            <input value={form.subjects} onChange={e => setForm(f => ({ ...f, subjects: e.target.value }))}
              placeholder="e.g. Computer Science, Engineering, Mathematics" className="input" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isOpenAccess}
              onChange={e => setForm(f => ({ ...f, isOpenAccess: e.target.checked }))}
              className="w-4 h-4 rounded accent-primary-700" />
            <span className="text-sm text-stone-600">Open access (free to read)</span>
          </label>
        </div>

        <div className="p-6 border-t border-stone-100 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? <><Loader2 size={14} className="animate-spin" />Creating…</> : 'Create journal'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Board Management Modal ─────────────────────────────────────────────────────
function BoardModal({ journal, onClose }: { journal: Journal; onClose: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [role, setRole] = useState('associate_editor');
  const [affiliation, setAffiliation] = useState('');

  const { data: members, isLoading: loadingMembers } = useQuery({
    queryKey: ['board', journal.slug],
    queryFn: () => api.get(`/journals/${journal.slug}/board`).then(r => r.data.data),
  });

  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['board-users', journal.slug, search],
    queryFn: () => api.get(`/journals/${journal.slug}/editor/users`, { params: { search } }).then(r => r.data.data),
    enabled: search.length > 1,
  });

  const add = useMutation({
    mutationFn: () => api.post(`/journals/${journal.slug}/board`, {
      userId: selectedUser.id, role, affiliation: affiliation || undefined,
    }),
    onSuccess: () => {
      toast.success(`${selectedUser.full_name} added to editorial board`);
      qc.invalidateQueries({ queryKey: ['board', journal.slug] });
      setSelectedUser(null); setSearch(''); setAffiliation('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const remove = useMutation({
    mutationFn: (memberId: string) => api.delete(`/journals/${journal.slug}/board/${memberId}`),
    onSuccess: () => { toast.success('Removed'); qc.invalidateQueries({ queryKey: ['board', journal.slug] }); },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const BOARD_ROLES = [
    { val: 'chief_editor',      label: 'Editor-in-Chief' },
    { val: 'associate_editor',  label: 'Associate Editor' },
    { val: 'section_editor',    label: 'Section Editor' },
    { val: 'reviewer',          label: 'Standing Reviewer' },
    { val: 'advisory_board',    label: 'Advisory Board' },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-card-md my-8">
        <div className="p-6 border-b border-stone-100">
          <h2 className="font-display text-lg font-semibold text-stone-900">Editorial Board</h2>
          <p className="text-sm text-stone-500 mt-0.5 line-clamp-1">{journal.title}</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Current board members */}
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-3">Current members</p>
            {loadingMembers ? (
              <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-stone-400" /></div>
            ) : !members?.length ? (
              <p className="text-sm text-stone-400 text-center py-4 border border-dashed border-stone-200 rounded-xl">
                No board members yet
              </p>
            ) : (
              <div className="space-y-2">
                {members.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl">
                    <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-700 text-xs font-semibold">
                        {m.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-900">{m.full_name}</p>
                      <p className="text-xs text-stone-500">
                        {BOARD_ROLES.find(r => r.val === m.role)?.label ?? m.role}
                        {m.affiliation ? ` · ${m.affiliation}` : ''}
                        {m.department_name ? ` · ${m.department_name}` : ''}
                      </p>
                    </div>
                    <button onClick={() => remove.mutate(m.id)} disabled={remove.isPending}
                      className="text-stone-400 hover:text-red-500 transition-colors p-1">
                      <XCircle size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add new member */}
          <div className="border-t border-stone-100 pt-5">
            <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-3">Add member</p>
            <div className="space-y-3">
              {/* User search */}
              <div>
                <label className="label">Search user</label>
                <input value={search} onChange={e => { setSearch(e.target.value); setSelectedUser(null); }}
                  placeholder="Type name or email (min 2 chars)…" className="input" />
              </div>

              {/* Search results */}
              {search.length > 1 && (
                <div className="border border-stone-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                  {loadingUsers ? (
                    <div className="p-3 text-center"><Loader2 size={14} className="animate-spin text-stone-400 mx-auto" /></div>
                  ) : !users?.length ? (
                    <p className="p-3 text-sm text-stone-400 text-center">No users found</p>
                  ) : (
                    users.map((u: any) => (
                      <button key={u.id} onClick={() => { setSelectedUser(u); setSearch(u.full_name); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b last:border-0 border-stone-100 transition-colors
                          ${selectedUser?.id === u.id ? 'bg-primary-50' : 'hover:bg-stone-50'}`}>
                        <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary-700 text-xs font-semibold">
                            {u.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-stone-900 truncate">{u.full_name}</p>
                          <p className="text-xs text-stone-400 truncate">{u.email}</p>
                        </div>
                        {selectedUser?.id === u.id && <CheckCircle2 size={14} className="text-primary-600 flex-shrink-0" />}
                      </button>
                    ))
                  )}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Board role *</label>
                  <select value={role} onChange={e => setRole(e.target.value)} className="input">
                    {BOARD_ROLES.map(r => (
                      <option key={r.val} value={r.val}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Affiliation <span className="text-stone-400 font-normal">(optional)</span></label>
                  <input value={affiliation} onChange={e => setAffiliation(e.target.value)}
                    placeholder="University, Dept…" className="input" />
                </div>
              </div>

              <button onClick={() => add.mutate()} disabled={!selectedUser || add.isPending}
                className="btn-primary w-full">
                {add.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Add to board'}
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <button onClick={onClose} className="btn-secondary w-full">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Assign Editor Modal ───────────────────────────────────────────────────────
function AssignEditorModal({ journal, onClose }: { journal: Journal; onClose: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const { data: editors, isLoading: loadingEditors } = useQuery({
    queryKey: ['journal-editors', journal.slug],
    queryFn: () => api.get(`/journals/${journal.slug}/editors`).then(r => r.data.data),
  });

  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['users-search', search],
    queryFn: () => api.get('/journals/' + journal.slug + '/editor/users', { params: { search } }).then(r => r.data.data),
    enabled: search.length > 1,
  });

  const assign = useMutation({
    mutationFn: () => api.post(`/journals/${journal.slug}/editors`, { userId: selectedUser.id }),
    onSuccess: (res: any) => {
      toast.success(res.data?.message ?? 'Editor assigned');
      qc.invalidateQueries({ queryKey: ['journal-editors', journal.slug] });
      qc.invalidateQueries({ queryKey: ['admin-journals'] });
      setSelectedUser(null); setSearch('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => api.delete(`/journals/${journal.slug}/editors/${userId}`),
    onSuccess: () => {
      toast.success('Editor removed');
      qc.invalidateQueries({ queryKey: ['journal-editors', journal.slug] });
      qc.invalidateQueries({ queryKey: ['admin-journals'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-card-md my-8">
        <div className="p-6 border-b border-stone-100">
          <h2 className="font-display text-lg font-semibold text-stone-900">Assign Journal Editors</h2>
          <p className="text-sm text-stone-500 mt-0.5 line-clamp-1">{journal.title}</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Current editors */}
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-3">Assigned editors</p>
            {loadingEditors ? (
              <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-stone-400" /></div>
            ) : !(editors as any[])?.length ? (
              <p className="text-sm text-stone-400 text-center py-4 border border-dashed border-stone-200 rounded-xl">
                No editors assigned yet
              </p>
            ) : (
              <div className="space-y-2">
                {(editors as any[]).map((e: any) => (
                  <div key={e.id} className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl">
                    <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-700 text-xs font-semibold">
                        {e.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-900">{e.full_name}</p>
                      <p className="text-xs text-stone-400">{e.email}{e.department_name ? ` · ${e.department_name}` : ''}</p>
                    </div>
                    <button onClick={() => remove.mutate(e.user_id)} disabled={remove.isPending}
                      className="text-stone-400 hover:text-red-500 transition-colors p-1" title="Remove editor">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assign new editor */}
          <div className="border-t border-stone-100 pt-5">
            <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-3">Add editor</p>
            <div className="relative mb-3">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setSelectedUser(null); }}
                placeholder="Search by name or email…"
                className="input pl-8 text-sm"
              />
            </div>

            {search.length > 1 && (
              <div className="border border-stone-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto mb-3">
                {loadingUsers ? (
                  <div className="p-3 text-center"><Loader2 size={14} className="animate-spin text-stone-400 mx-auto" /></div>
                ) : !(users as any[])?.length ? (
                  <p className="p-3 text-sm text-stone-400 text-center">No users found</p>
                ) : (
                  (users as any[]).map((u: any) => (
                    <button key={u.id} onClick={() => { setSelectedUser(u); setSearch(u.full_name); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b last:border-0 border-stone-100 transition-colors
                        ${selectedUser?.id === u.id ? 'bg-primary-50' : 'hover:bg-stone-50'}`}>
                      <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary-700 text-xs font-semibold">
                          {u.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-900 truncate">{u.full_name}</p>
                        <p className="text-xs text-stone-400 truncate">{u.email}</p>
                      </div>
                      {selectedUser?.id === u.id && <CheckCircle2 size={14} className="text-primary-600 shrink-0" />}
                    </button>
                  ))
                )}
              </div>
            )}

            <button
              onClick={() => assign.mutate()}
              disabled={!selectedUser || assign.isPending}
              className="btn-primary w-full"
            >
              {assign.isPending
                ? <><Loader2 size={14} className="animate-spin" />Assigning…</>
                : <><UserPlus size={14} />Assign as editor</>
              }
            </button>
            <p className="text-xs text-stone-400 mt-2 text-center">
              The user will be granted the <strong>journal_editor</strong> role and can manage this journal's manuscripts.
            </p>
          </div>
        </div>

        <div className="px-6 pb-6">
          <button onClick={onClose} className="btn-secondary w-full">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Status meta ────────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  pending:   { label: 'Pending',   icon: Clock,        cls: 'badge-stone' },
  active:    { label: 'Active',    icon: CheckCircle2, cls: 'badge-green' },
  suspended: { label: 'Suspended', icon: XCircle,      cls: 'badge-red'   },
};

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AdminJournalsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [boardJournal, setBoardJournal] = useState<Journal | null>(null);
  const [editorJournal, setEditorJournal] = useState<Journal | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-journals'],
    queryFn: () => api.get('/journals/admin/all').then(r => r.data.data),
  });

  const journals: Journal[] = data?.journals ?? [];

  const activate = useMutation({
    mutationFn: (slug: string) => api.patch(`/journals/${slug}`, { status: 'active' }),
    onSuccess: () => { toast.success('Journal activated'); qc.invalidateQueries({ queryKey: ['admin-journals'] }); },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const suspend = useMutation({
    mutationFn: (slug: string) => api.patch(`/journals/${slug}`, { status: 'suspended' }),
    onSuccess: () => { toast.success('Journal suspended'); qc.invalidateQueries({ queryKey: ['admin-journals'] }); },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">Journal management</h1>
          <p className="text-stone-500 text-sm mt-1">Create and manage peer-reviewed journals hosted by your university.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={16} /> New journal
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
        </div>
      ) : journals.length === 0 ? (
        <div className="card p-16 text-center">
          <BookOpen size={40} className="mx-auto mb-3 text-stone-300" />
          <h3 className="font-display font-semibold text-stone-700 mb-1">No journals yet</h3>
          <p className="text-stone-400 text-sm mb-4">Create your university's first peer-reviewed journal.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex">
            <Plus size={14} /> Create journal
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {['Journal', 'University', 'Status', 'Frequency', 'Articles', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {journals.map(j => {
                const sm = STATUS_META[j.status] ?? STATUS_META.pending;
                const Icon = sm.icon;
                return (
                  <tr key={j.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                          <BookOpen size={16} className="text-primary-700" />
                        </div>
                        <div>
                          <p className="font-medium text-stone-900 text-sm">{j.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {j.issn_online && <span className="text-xs font-mono text-stone-400">ISSN {j.issn_online}</span>}
                            {j.is_open_access && <span className="badge badge-green text-xs">OA</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-stone-600">{j.university_name ?? '—'}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`badge text-xs flex items-center gap-1 w-fit ${sm.cls}`}>
                        <Icon size={11} /> {sm.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-stone-600 capitalize">{j.frequency}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-stone-600">{j.article_count ?? 0}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 flex-wrap">
                        <Link href={`/editor/${j.slug}`} className="btn-ghost btn-sm text-xs">
                          <Edit size={12} /> Editor
                        </Link>
                        <button onClick={() => setEditorJournal(j)} className="btn-ghost btn-sm text-xs">
                          <UserPlus size={12} /> Editors
                        </button>
                        <button onClick={() => setBoardJournal(j)} className="btn-ghost btn-sm text-xs">
                          Board
                        </button>
                        <Link href={`/journals/${j.slug}`} target="_blank" className="btn-ghost btn-sm text-xs">
                          <Globe size={12} /> View
                        </Link>
                        {j.status !== 'active' ? (
                          <button onClick={() => activate.mutate(j.slug)} disabled={activate.isPending}
                            className="btn-ghost btn-sm text-xs text-primary-700">
                            <CheckCircle2 size={12} /> Activate
                          </button>
                        ) : (
                          <button onClick={() => suspend.mutate(j.slug)} disabled={suspend.isPending}
                            className="btn-ghost btn-sm text-xs text-red-600">
                            <XCircle size={12} /> Suspend
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

      {showCreate    && <CreateJournalModal onClose={() => setShowCreate(false)} />}
      {boardJournal  && <BoardModal journal={boardJournal} onClose={() => setBoardJournal(null)} />}
      {editorJournal && <AssignEditorModal journal={editorJournal} onClose={() => setEditorJournal(null)} />}
    </div>
  );
}
