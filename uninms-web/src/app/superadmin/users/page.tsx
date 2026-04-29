'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformUsersApi, platformApi } from '@/lib/api';
import {
  Users, UserPlus, Search, ChevronLeft, ChevronRight, X, Loader2,
  MoreHorizontal, ShieldCheck, ShieldOff, Building2, Eye, EyeOff,
  Download, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

/* ── Constants ───────────────────────────────────────────────────────────── */
const PLATFORM_ROLES = ['admin', 'management', 'community_rep', 'industry_partner', 'super_admin'];

const ROLE_LABEL: Record<string, string> = {
  admin:            'IT Admin',
  management:       'Management',
  community_rep:    'Community Rep',
  industry_partner: 'Industry Partner',
  super_admin:      'Super Admin',
};

const ROLE_BADGE: Record<string, string> = {
  admin:            'badge-blue',
  management:       'badge-gold',
  community_rep:    'badge-green',
  industry_partner: 'badge-purple',
  super_admin:      'badge-stone',
};

/* ── Create user modal ───────────────────────────────────────────────────── */
function CreateUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({
    fullName: '', email: '', password: '',
    role: 'admin', universityId: '',
  });

  const needsUniversity = ['admin', 'management'].includes(form.role);

  const { data: uniData } = useQuery({
    queryKey: ['platform-universities-all'],
    queryFn:  () => platformApi.universities({ limit: 200 }),
  });
  const universities = (uniData as any)?.data?.universities ?? [];

  const mutation = useMutation({
    mutationFn: () => platformUsersApi.create({
      fullName:     form.fullName.trim(),
      email:        form.email.trim(),
      password:     form.password,
      role:         form.role,
      universityId: needsUniversity ? form.universityId : undefined,
    }),
    onSuccess: () => {
      toast.success('User created');
      qc.invalidateQueries({ queryKey: ['platform-users'] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const valid = form.fullName.trim().length >= 2
    && form.email.includes('@')
    && form.password.length >= 6
    && (!needsUniversity || form.universityId);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card-md w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-display text-xl font-semibold text-stone-900">Add platform user</h3>
            <p className="text-xs text-stone-400 mt-0.5">Students, lecturers & researchers are managed by IT admins</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">Full name *</label>
            <input value={form.fullName} onChange={set('fullName')} placeholder="e.g. Emeka Okafor"
              className="input" autoFocus />
          </div>
          <div>
            <label className="label">Email *</label>
            <input type="email" value={form.email} onChange={set('email')}
              placeholder="user@example.com" className="input" />
          </div>
          <div>
            <label className="label">Password *</label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={form.password}
                onChange={set('password')} placeholder="Min. 6 characters" className="input pr-10" />
              <button type="button" onClick={() => setShowPwd(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Role *</label>
            <select value={form.role} onChange={set('role')} className="input">
              {PLATFORM_ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </div>
          {needsUniversity && (
            <div>
              <label className="label">University *</label>
              <select value={form.universityId} onChange={set('universityId')} className="input">
                <option value="">— Select university —</option>
                {universities.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <p className="text-xs text-stone-400 mt-1">
                IT admins and management users must be linked to a specific university.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}
            className="btn-primary flex-1">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus size={14} />}
            Create user
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Role actions dropdown ───────────────────────────────────────────────── */
function RoleMenu({ user }: { user: any }) {
  const qc   = useQueryClient();
  const [open, setOpen] = useState(false);

  const roleMut = useMutation({
    mutationFn: ({ role, action }: { role: string; action: 'assign' | 'revoke' }) =>
      platformUsersApi.updateRole(user.id, role, action),
    onSuccess: () => {
      toast.success('Role updated');
      qc.invalidateQueries({ queryKey: ['platform-users'] });
      setOpen(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const isSuperAdmin = user.roles?.includes('super_admin');

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
        title="Manage roles">
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-white border border-stone-200 rounded-xl shadow-card-md py-1.5 min-w-[200px]">
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Roles</p>
            {!isSuperAdmin ? (
              <button onClick={() => roleMut.mutate({ role: 'super_admin', action: 'assign' })}
                disabled={roleMut.isPending}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50">
                <ShieldCheck size={13} className="text-primary-600" /> Promote to super admin
              </button>
            ) : (
              <button onClick={() => roleMut.mutate({ role: 'super_admin', action: 'revoke' })}
                disabled={roleMut.isPending}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-amber-600 hover:bg-stone-50">
                <ShieldOff size={13} /> Revoke super admin
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Activate / Deactivate buttons ──────────────────────────────────────── */
function StatusButtons({ user }: { user: any }) {
  const qc  = useQueryClient();
  const mut = useMutation({
    mutationFn: (newStatus: string) => platformUsersApi.updateStatus(user.id, newStatus),
    onSuccess: (_: any, newStatus: string) => {
      toast.success(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      qc.invalidateQueries({ queryKey: ['platform-users'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const isActive  = user.status === 'active';
  const isPending = mut.isPending;

  return (
    <div className="flex items-center gap-1.5">
      {/* Status indicator */}
      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
        ${isActive ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>
        {isActive ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
        {isActive ? 'Active' : 'Inactive'}
      </span>

      {/* Action button — shows opposite of current state */}
      {isActive ? (
        <button
          onClick={() => mut.mutate('suspended')}
          disabled={isPending}
          className="px-2 py-0.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors">
          {isPending ? <Loader2 size={11} className="animate-spin" /> : 'Deactivate'}
        </button>
      ) : (
        <button
          onClick={() => mut.mutate('active')}
          disabled={isPending}
          className="px-2 py-0.5 rounded-lg text-xs font-medium border border-green-200 text-green-700 bg-white hover:bg-green-50 transition-colors">
          {isPending ? <Loader2 size={11} className="animate-spin" /> : 'Activate'}
        </button>
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function SuperAdminUsersPage() {
  const [q,        setQ]        = useState('');
  const [activeQ,  setActiveQ]  = useState('');
  const [role,     setRole]     = useState('');
  const [status,   setStatus]   = useState('');
  const [page,     setPage]     = useState(1);
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['platform-users', activeQ, role, status, page],
    queryFn:  () => platformUsersApi.list({
      q: activeQ || undefined,
      role: role || undefined,
      status: status || undefined,
      page, limit: 20,
    }),
  });

  const users      = (data as any)?.data?.users ?? [];
  const total      = (data as any)?.data?.total ?? 0;
  const totalPages = (data as any)?.data?.totalPages ?? 1;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <p className="text-stone-500 text-sm">
          {total.toLocaleString()} platform user{total !== 1 ? 's' : ''} · excludes students, lecturers & researchers
        </p>
        <div className="flex items-center gap-2">
          <a
            href="/api/placeholder"
            onClick={e => { e.preventDefault(); toast.success('Check scripts/it-admin-credentials.csv on the server'); }}
            className="btn-secondary text-xs gap-1.5">
            <Download size={13} /> Credentials CSV
          </a>
          <button onClick={() => setCreating(true)} className="btn-primary">
            <UserPlus size={14} /> Add user
          </button>
        </div>
      </div>

      {/* Info banner for IT admins */}
      {(!role || role === 'admin') && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5 text-xs text-blue-700">
          <strong>157 universities</strong> each have one IT admin account created automatically.
          Default password: <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">ITAdmin@2025</code> · Distribute credentials and ask each admin to change their password.
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 mb-5 space-y-3">
        <form onSubmit={e => { e.preventDefault(); setActiveQ(q); setPage(1); }} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search by name or email…" className="input pl-10" />
          </div>
          <button type="submit" className="btn-primary px-5">Search</button>
        </form>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1.5 flex-wrap">
            {['', ...PLATFORM_ROLES].map(r => (
              <button key={r} onClick={() => { setRole(r); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                  ${role === r ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'}`}>
                {r ? ROLE_LABEL[r] : 'All roles'}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 ml-auto">
            {['', 'active', 'suspended'].map(s => (
              <button key={s} onClick={() => { setStatus(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                  ${status === s ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'}`}>
                {s === 'active' ? 'Active' : s === 'suspended' ? 'Inactive' : 'All status'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
      ) : users.length === 0 ? (
        <div className="card p-16 text-center">
          <Users size={40} className="mx-auto mb-3 text-stone-300" />
          <p className="text-stone-400 text-sm">No platform users found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3">User</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3">Role</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">University</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3 hidden xl:table-cell">Last login</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3">Status</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {users.map((u: any) => (
                <tr key={u.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-stone-900">{u.full_name}</p>
                    <p className="text-xs text-stone-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(u.roles ?? []).map((r: string) => (
                        <span key={r} className={`badge text-xs ${ROLE_BADGE[r] ?? 'badge-stone'}`}>
                          {ROLE_LABEL[r] ?? r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {u.university_name ? (
                      <div className="flex items-center gap-1.5">
                        <Building2 size={11} className="text-stone-400 flex-shrink-0" />
                        <span className="text-xs text-stone-600 truncate max-w-[180px]" title={u.university_name}>
                          {u.university_short ?? u.university_name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-stone-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-400 hidden xl:table-cell">
                    {u.last_login
                      ? formatDistanceToNow(new Date(u.last_login), { addSuffix: true })
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusButtons user={u} />
                  </td>
                  <td className="px-4 py-3">
                    <RoleMenu user={u} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary btn-sm">
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm text-stone-600">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary btn-sm">
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {creating && <CreateUserModal onClose={() => setCreating(false)} />}
    </div>
  );
}
