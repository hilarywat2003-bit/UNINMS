'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import {
  Users, UserPlus, Search, ChevronLeft, ChevronRight,
  X, Loader2, Upload, CheckCircle2, AlertCircle, Eye, EyeOff,
  MoreHorizontal, ShieldCheck, ShieldOff, UserX, UserCheck,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const ROLES = ['student', 'lecturer', 'researcher', 'management'];

const ROLE_BADGE: Record<string, string> = {
  student: 'badge-green', lecturer: 'badge-blue',
  researcher: 'badge-purple', management: 'badge-gold',
  admin: 'badge-stone', super_admin: 'badge-stone',
};

/* ── Register single user modal ──────────────────────────────────────────── */
function RegisterModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', role: 'student',
    departmentId: '', matricNumber: '', staffId: '',
  });

  const { data: deptData } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: () => adminApi.departments(),
  });
  const departments = (deptData?.data as any[]) ?? [];

  const mutation = useMutation({
    mutationFn: () => adminApi.register({
      fullName: form.fullName, email: form.email, password: form.password,
      role: form.role, departmentId: form.departmentId || undefined,
      matricNumber: form.role === 'student' ? form.matricNumber || undefined : undefined,
      staffId: form.role !== 'student' ? form.staffId || undefined : undefined,
    }),
    onSuccess: () => {
      toast.success(`${form.role.charAt(0).toUpperCase() + form.role.slice(1)} registered!`);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Registration failed'),
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const valid = form.fullName.trim().length >= 2 && form.email.includes('@') && form.password.length >= 6;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card-md w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-xl font-semibold text-stone-900">Register user</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Full name *</label>
            <input value={form.fullName} onChange={set('fullName')} placeholder="e.g. Amaka Nwosu" className="input" autoFocus />
          </div>
          <div>
            <label className="label">Email *</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="student@uninms.edu.ng" className="input" />
          </div>
          <div>
            <label className="label">Password *</label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={form.password} onChange={set('password')}
                placeholder="Min. 6 characters" className="input pr-10" />
              <button type="button" onClick={() => setShowPwd(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Role *</label>
              <select value={form.role} onChange={set('role')} className="input">
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Department</label>
              <select value={form.departmentId} onChange={set('departmentId')} className="input">
                <option value="">— select —</option>
                {departments.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.faculty_name ? `${d.faculty_name} › ` : ''}{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          {form.role === 'student' ? (
            <div>
              <label className="label">Matric number</label>
              <input value={form.matricNumber} onChange={set('matricNumber')} placeholder="e.g. 2021/CSC/001" className="input" />
            </div>
          ) : (
            <div>
              <label className="label">Staff ID</label>
              <input value={form.staffId} onChange={set('staffId')} placeholder="e.g. STAFF-001" className="input" />
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending} className="btn-primary flex-1">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus size={14} />} Register
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Bulk register modal ─────────────────────────────────────────────────── */
function BulkRegisterModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ created: number; failed: any[] } | null>(null);

  const mutation = useMutation({
    mutationFn: (users: object[]) => adminApi.bulkRegister(users),
    onSuccess: (res: any) => {
      const d = res?.data;
      setResult(d);
      if (d?.created > 0) qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Bulk registration failed'),
  });

  const handleSubmit = () => {
    try {
      const lines = text.trim().split('\n').filter(Boolean);
      const users = lines.map(line => {
        const [fullName, email, password, role = 'student', matricNumber = ''] = line.split(',').map(s => s.trim());
        return { fullName, email, password, role, matricNumber: matricNumber || undefined };
      });
      if (!users.length) { toast.error('No valid entries found'); return; }
      mutation.mutate(users);
    } catch { toast.error('Invalid format. Check CSV structure.'); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card-md w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-xl font-semibold text-stone-900">Bulk register users</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>
        {!result ? (
          <>
            <div className="bg-stone-50 rounded-xl p-3 mb-4 text-xs text-stone-500 font-mono">
              Format (one per line): fullName, email, password, role, matricNumber<br />
              Example: Amaka Nwosu, amaka@uninms.edu.ng, Pass@123, student, 2024/CSC/001
            </div>
            <textarea value={text} onChange={e => setText(e.target.value)}
              className="input w-full font-mono text-sm" rows={10}
              placeholder={`Amaka Nwosu, amaka@uninms.edu.ng, Pass@123, student, 2024/CSC/001\nEmeka Obi, emeka@uninms.edu.ng, Pass@456, student, 2024/CSC/002`} />
            <div className="flex gap-3 mt-4">
              <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSubmit} disabled={!text.trim() || mutation.isPending} className="btn-primary flex-1">
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload size={14} />} Import
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <CheckCircle2 size={24} className="mx-auto mb-1 text-green-600" />
                <p className="text-2xl font-display font-semibold text-green-700">{result.created}</p>
                <p className="text-xs text-green-600">Created</p>
              </div>
              <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <AlertCircle size={24} className="mx-auto mb-1 text-red-500" />
                <p className="text-2xl font-display font-semibold text-red-600">{result.failed?.length ?? 0}</p>
                <p className="text-xs text-red-500">Failed</p>
              </div>
            </div>
            {result.failed?.length > 0 && (
              <div className="bg-stone-50 rounded-xl p-3 max-h-40 overflow-y-auto">
                {result.failed.map((f, i) => (
                  <p key={i} className="text-xs text-stone-500 font-mono">{f.email}: {f.error}</p>
                ))}
              </div>
            )}
            <button onClick={onClose} className="btn-primary w-full">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── User actions dropdown ───────────────────────────────────────────────── */
function UserActions({ user }: { user: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const statusMut = useMutation({
    mutationFn: (status: string) => adminApi.updateUserStatus(user.id, status),
    onSuccess: (_: any, status: string) => {
      toast.success(`User ${status}`);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setOpen(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const roleMut = useMutation({
    mutationFn: ({ role, action }: { role: string; action: 'assign' | 'revoke' }) =>
      adminApi.updateUserRole(user.id, role, action),
    onSuccess: (_: any, { role, action }: any) => {
      toast.success(`Role "${role}" ${action}ed`);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setOpen(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const isActive    = user.status === 'active';
  const isSuspended = user.status === 'suspended';
  const hasResearcher = (user.roles ?? []).includes('researcher');

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors">
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-white border border-stone-200 rounded-xl shadow-card-md py-1.5 min-w-[180px]">
            {isActive && (
              <button onClick={() => statusMut.mutate('suspended')}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                <UserX size={14} /> Suspend user
              </button>
            )}
            {isSuspended && (
              <button onClick={() => statusMut.mutate('active')}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-green-700 hover:bg-green-50 transition-colors">
                <UserCheck size={14} /> Reactivate
              </button>
            )}
            {!hasResearcher && (
              <button onClick={() => roleMut.mutate({ role: 'researcher', action: 'assign' })}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors">
                <ShieldCheck size={14} /> Add researcher role
              </button>
            )}
            {hasResearcher && (
              <button onClick={() => roleMut.mutate({ role: 'researcher', action: 'revoke' })}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors">
                <ShieldOff size={14} /> Remove researcher role
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function AdminUsersPage() {
  const [q, setQ]               = useState('');
  const [activeQ, setActiveQ]   = useState('');
  const [role, setRole]         = useState('');
  const [page, setPage]         = useState(1);
  const [showRegister, setShowRegister] = useState(false);
  const [showBulk, setShowBulk]         = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', activeQ, role, page],
    queryFn: () => adminApi.listUsers({ q: activeQ || undefined, role: role || undefined, page, limit: 20 }),
  });

  const users      = (data?.data as any)?.users ?? [];
  const total      = (data?.data as any)?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <p className="text-stone-500 text-sm">{total.toLocaleString()} user{total !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <button onClick={() => setShowBulk(true)} className="btn-secondary">
            <Upload size={14} /> Bulk import
          </button>
          <button onClick={() => setShowRegister(true)} className="btn-primary">
            <UserPlus size={14} /> Register user
          </button>
        </div>
      </div>

      <div className="card p-4 mb-5 space-y-3">
        <form onSubmit={e => { e.preventDefault(); setActiveQ(q); setPage(1); }} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or email…" className="input pl-10" />
          </div>
          <button type="submit" className="btn-primary px-5">Search</button>
        </form>
        <div className="flex flex-wrap gap-2">
          {['', ...ROLES].map(r => (
            <button key={r} onClick={() => { setRole(r); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                ${role === r ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'}`}>
              {r ? r.charAt(0).toUpperCase() + r.slice(1) : 'All roles'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
      ) : users.length === 0 ? (
        <div className="card p-16 text-center">
          <Users size={40} className="mx-auto mb-3 text-stone-300" />
          <h3 className="font-display font-semibold text-stone-700 mb-1">No users found</h3>
          <p className="text-stone-400 text-sm">Try a different search or register a new user.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3">User</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Role</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Department</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Last login</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3">Status</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {users.map((u: any) => (
                <tr key={u.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-stone-900">{u.full_name}</p>
                    <p className="text-xs text-stone-400">{u.email}</p>
                    {u.matric_number && <p className="text-xs text-stone-400 font-mono">{u.matric_number}</p>}
                    {u.staff_id && <p className="text-xs text-stone-400 font-mono">{u.staff_id}</p>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(u.roles ?? []).map((r: string) => (
                        <span key={r} className={`badge text-xs ${ROLE_BADGE[r] ?? 'badge-stone'}`}>{r.replace('_', ' ')}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-sm text-stone-500">{u.department_name ?? '—'}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-stone-400">
                    {u.last_login ? formatDistanceToNow(new Date(u.last_login), { addSuffix: true }) : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge text-xs ${u.status === 'active' ? 'badge-green' : u.status === 'suspended' ? 'badge bg-red-50 text-red-600' : 'badge-gold'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <UserActions user={u} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary btn-sm"><ChevronLeft size={14} /></button>
          <span className="text-sm text-stone-600">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary btn-sm"><ChevronRight size={14} /></button>
        </div>
      )}

      {showRegister && <RegisterModal onClose={() => setShowRegister(false)} />}
      {showBulk && <BulkRegisterModal onClose={() => setShowBulk(false)} />}
    </div>
  );
}
