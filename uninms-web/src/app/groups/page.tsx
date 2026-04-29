'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsApi, usersApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  Users, Plus, Search, X, LogIn, LogOut, Trash2, ChevronRight,
  Lock, Globe, User, UserPlus, Check, Bell,
} from 'lucide-react';

/* ── types ───────────────────────────────────────────────────────────────── */
interface Group {
  id: string; name: string; description: string | null;
  type: string; is_public: boolean; member_count: number;
  created_at: string; creator_name: string; is_member: boolean; is_owner: boolean;
}
interface Member {
  id: string; full_name: string; profile_photo_url: string | null;
  department_name: string | null; university_short: string | null;
  role: string; joined_at: string;
}
interface GroupDetail extends Group { members: Member[]; }
interface Invite {
  id: string; group_id: string; group_name: string;
  description: string | null; inviter_name: string; created_at: string;
}
interface PendingInvitee {
  id: string; user_id: string; full_name: string;
  profile_photo_url: string | null; department_name: string | null; created_at: string;
}
interface UserResult {
  id: string; full_name: string; profile_photo_url: string | null;
  department_name: string | null; university_short: string | null;
}

/* ── Avatar ──────────────────────────────────────────────────────────────── */
function Avatar({ name, url, size = 8 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (url) return <img src={url} alt={name} className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div className={`w-${size} h-${size} rounded-full bg-primary-100 text-primary-700 text-xs font-semibold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  );
}

/* ── Pending invites banner ──────────────────────────────────────────────── */
function InvitesBanner({ onOpen }: { onOpen: () => void }) {
  const { data } = useQuery<{ data: Invite[] }>({
    queryKey: ['my-invites'],
    queryFn: () => groupsApi.myInvites(),
    refetchInterval: 30000,
  });
  const invites = data?.data ?? [];
  if (invites.length === 0) return null;
  return (
    <button onClick={onOpen}
      className="w-full flex items-center gap-3 px-4 py-3 mb-5 rounded-xl bg-primary-50 border border-primary-200 text-left hover:bg-primary-100 transition-colors">
      <Bell size={16} className="text-primary-600 flex-shrink-0" />
      <span className="flex-1 text-sm text-primary-800 font-medium">
        You have {invites.length} pending group invite{invites.length > 1 ? 's' : ''}
      </span>
      <ChevronRight size={14} className="text-primary-400" />
    </button>
  );
}

/* ── My invites modal ────────────────────────────────────────────────────── */
function MyInvitesModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ data: Invite[] }>({
    queryKey: ['my-invites'],
    queryFn: () => groupsApi.myInvites(),
  });
  const invites = data?.data ?? [];

  const acceptMut = useMutation({
    mutationFn: (id: string) => groupsApi.acceptInvite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-invites'] }),
  });
  const declineMut = useMutation({
    mutationFn: (id: string) => groupsApi.declineInvite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-invites'] }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-semibold text-stone-900">Group Invites</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={16} /></button>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="h-16 skeleton" />)}</div>
        ) : invites.length === 0 ? (
          <div className="py-10 text-center text-stone-400">
            <Users size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No pending invites</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invites.map(inv => (
              <div key={inv.id} className="flex items-start gap-3 p-3 rounded-xl border border-stone-100 bg-stone-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-900 truncate">{inv.group_name}</p>
                  {inv.description && <p className="text-xs text-stone-500 truncate">{inv.description}</p>}
                  <p className="text-xs text-stone-400 mt-0.5">Invited by {inv.inviter_name}</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => acceptMut.mutate(inv.id)}
                    disabled={acceptMut.isPending}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 transition-colors"
                  >
                    <Check size={11} /> Accept
                  </button>
                  <button
                    onClick={() => declineMut.mutate(inv.id)}
                    disabled={declineMut.isPending}
                    className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-500 text-xs hover:bg-stone-100 transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Invite member panel (inside GroupDetail, owner only) ────────────────── */
function InvitePanel({ groupId }: { groupId: string }) {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data: searchData } = useQuery<{ data: UserResult[] }>({
    queryKey: ['user-search', debouncedQ],
    queryFn: () => usersApi.search(debouncedQ),
    enabled: debouncedQ.length >= 2,
  });

  const { data: pendingData, refetch: refetchPending } = useQuery<{ data: PendingInvitee[] }>({
    queryKey: ['group-invites', groupId],
    queryFn: () => groupsApi.groupInvites(groupId),
  });

  const inviteMut = useMutation({
    mutationFn: (userId: string) => groupsApi.invite(groupId, userId),
    onSuccess: () => { refetchPending(); setQuery(''); setDebouncedQ(''); },
  });
  const revokeMut = useMutation({
    mutationFn: (inviteId: string) => groupsApi.declineInvite(inviteId),
    onSuccess: () => refetchPending(),
  });

  const results = searchData?.data ?? [];
  const pending = pendingData?.data ?? [];
  const pendingIds = new Set(pending.map(p => p.user_id));

  return (
    <div className="border-t border-stone-100 pt-4 mt-2">
      <h3 className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-3 flex items-center gap-1.5">
        <UserPlus size={11} /> Invite members
      </h3>

      {/* search */}
      <div className="relative mb-3">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          className="input pl-8 py-2 text-sm"
          placeholder="Search by name or email…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {/* search results */}
      {debouncedQ.length >= 2 && results.length > 0 && (
        <div className="space-y-1 mb-3">
          {results.map(u => {
            const alreadyInvited = pendingIds.has(u.id);
            return (
              <div key={u.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-stone-50">
                <Avatar name={u.full_name} url={u.profile_photo_url} size={7} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-800 truncate">{u.full_name}</p>
                  <p className="text-xs text-stone-400 truncate">{[u.department_name, u.university_short].filter(Boolean).join(' · ')}</p>
                </div>
                <button
                  onClick={() => inviteMut.mutate(u.id)}
                  disabled={alreadyInvited || inviteMut.isPending}
                  className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-lg transition-colors ${
                    alreadyInvited
                      ? 'bg-stone-100 text-stone-400 cursor-default'
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  {alreadyInvited ? 'Invited' : 'Invite'}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {debouncedQ.length >= 2 && results.length === 0 && (
        <p className="text-xs text-stone-400 mb-3">No users found</p>
      )}

      {/* pending invites */}
      {pending.length > 0 && (
        <>
          <p className="text-xs text-stone-400 mb-2">Pending invites</p>
          <div className="space-y-1">
            {pending.map(p => (
              <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-stone-50">
                <Avatar name={p.full_name} url={p.profile_photo_url} size={7} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-700 truncate">{p.full_name}</p>
                  {p.department_name && <p className="text-xs text-stone-400 truncate">{p.department_name}</p>}
                </div>
                <button
                  onClick={() => revokeMut.mutate(p.id)}
                  disabled={revokeMut.isPending}
                  className="flex-shrink-0 text-xs px-2 py-1 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Create group modal ──────────────────────────────────────────────────── */
function CreateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => groupsApi.create({ name, description, isPublic }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups'] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-semibold text-stone-900">Create Research Group</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={16} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Group name <span className="text-red-500">*</span></label>
            <input className="input" placeholder="e.g. AI & Machine Learning Lab" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={3} placeholder="What is this group about?" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="label">Visibility</label>
            <div className="flex rounded-lg border border-stone-200 overflow-hidden">
              <button type="button" onClick={() => setIsPublic(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm transition-colors ${isPublic ? 'bg-primary-600 text-white font-medium' : 'bg-white text-stone-500 hover:bg-stone-50'}`}>
                <Globe size={14} /> Public
              </button>
              <button type="button" onClick={() => setIsPublic(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm border-l border-stone-200 transition-colors ${!isPublic ? 'bg-stone-700 text-white font-medium' : 'bg-white text-stone-500 hover:bg-stone-50'}`}>
                <Lock size={14} /> Private
              </button>
            </div>
            <p className="text-xs text-stone-400 mt-1">{isPublic ? 'Anyone can find and join this group' : 'Only invited members can join'}</p>
          </div>
          {error && <p className="text-sm text-red-600">{(error as any)?.response?.data?.error?.message ?? 'Something went wrong'}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => mutate()} disabled={isPending || name.trim().length < 3}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
            {isPending ? 'Creating…' : 'Create group'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Group detail panel ──────────────────────────────────────────────────── */
function GroupDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ data: GroupDetail }>({
    queryKey: ['groups', id],
    queryFn: () => groupsApi.get(id),
  });

  const joinMut = useMutation({
    mutationFn: () => groupsApi.join(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
  const leaveMut = useMutation({
    mutationFn: () => groupsApi.leave(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups'] }); onClose(); },
  });
  const deleteMut = useMutation({
    mutationFn: () => groupsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups'] }); onClose(); },
  });

  const g = data?.data;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* header */}
        <div className="flex items-start justify-between p-5 border-b border-stone-100">
          <div className="flex-1 min-w-0">
            {isLoading ? <div className="h-5 w-48 skeleton mb-2" /> : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display font-semibold text-stone-900 truncate">{g?.name}</h2>
                  {g && (
                    <span className={`badge text-xs ${g.is_public ? 'badge-green' : 'badge-stone'}`}>
                      {g.is_public ? <><Globe size={9} className="inline mr-0.5" />Public</> : <><Lock size={9} className="inline mr-0.5" />Private</>}
                    </span>
                  )}
                </div>
                {g?.description && <p className="text-sm text-stone-500 mt-0.5">{g.description}</p>}
                <p className="text-xs text-stone-400 mt-1">{g?.member_count ?? 0} member{g?.member_count !== 1 ? 's' : ''} · Created by {g?.creator_name}</p>
              </>
            )}
          </div>
          <button onClick={onClose} className="ml-3 p-1 rounded-lg text-stone-400 hover:bg-stone-100 flex-shrink-0"><X size={16} /></button>
        </div>

        {/* actions bar */}
        {g && (
          <div className="px-5 py-3 border-b border-stone-100 flex gap-2 flex-wrap">
            {!g.is_member && g.is_public && (
              <button onClick={() => joinMut.mutate()} disabled={joinMut.isPending} className="btn-primary text-sm flex items-center gap-1.5">
                <LogIn size={14} /> {joinMut.isPending ? 'Joining…' : 'Join group'}
              </button>
            )}
            {!g.is_member && !g.is_public && (
              <span className="text-xs text-stone-400 self-center flex items-center gap-1"><Lock size={11} />Private — join by invite only</span>
            )}
            {g.is_member && !g.is_owner && (
              <button onClick={() => leaveMut.mutate()} disabled={leaveMut.isPending}
                className="btn-secondary text-sm flex items-center gap-1.5 text-red-600 hover:text-red-700">
                <LogOut size={14} /> {leaveMut.isPending ? 'Leaving…' : 'Leave group'}
              </button>
            )}
            {g.is_owner && (
              <button onClick={() => { if (confirm('Delete this group? This cannot be undone.')) deleteMut.mutate(); }}
                disabled={deleteMut.isPending}
                className="btn-secondary text-sm flex items-center gap-1.5 text-red-600 hover:text-red-700">
                <Trash2 size={14} /> {deleteMut.isPending ? 'Deleting…' : 'Delete group'}
              </button>
            )}
            {g.is_member && <span className="ml-auto text-xs text-primary-600 font-medium self-center">You are a member</span>}
          </div>
        )}

        {/* scrollable body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* members */}
          <h3 className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-3">Members</h3>
          {isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-10 skeleton" />)}</div>
          ) : (g?.members ?? []).length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-4">No members yet</p>
          ) : (
            <div className="space-y-2">
              {(g?.members ?? []).map(m => (
                <div key={m.id} className="flex items-center gap-3">
                  <Avatar name={m.full_name} url={m.profile_photo_url} size={8} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-800 font-medium truncate flex items-center gap-1.5">
                      {m.full_name}
                      {m.id === user?.id && <span className="text-xs text-stone-400">(you)</span>}
                    </p>
                    <p className="text-xs text-stone-400 truncate">{[m.department_name, m.university_short].filter(Boolean).join(' · ')}</p>
                  </div>
                  <span className={`badge text-xs flex-shrink-0 ${m.role === 'owner' ? 'badge-gold' : 'badge-stone'}`}>{m.role}</span>
                </div>
              ))}
            </div>
          )}

          {/* invite panel — owners only */}
          {g?.is_owner && <InvitePanel groupId={id} />}
        </div>
      </div>
    </div>
  );
}

/* ── Group card ──────────────────────────────────────────────────────────── */
function GroupCard({ group, onClick }: { group: Group; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card p-4 text-left w-full hover:shadow-md hover:-translate-y-0.5 transition-all group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-semibold text-stone-900 text-sm truncate">{group.name}</span>
            {group.is_member && <span className="badge badge-green text-xs">Joined</span>}
            {!group.is_public && <Lock size={11} className="text-stone-400" />}
          </div>
          {group.description && <p className="text-xs text-stone-500 mt-1 line-clamp-2">{group.description}</p>}
          <div className="flex items-center gap-3 mt-2 text-xs text-stone-400">
            <span className="flex items-center gap-1"><User size={10} />{group.member_count} member{group.member_count !== 1 ? 's' : ''}</span>
            <span>{group.creator_name}</span>
          </div>
        </div>
        <ChevronRight size={14} className="text-stone-300 group-hover:text-primary-500 flex-shrink-0 mt-1 transition-colors" />
      </div>
    </button>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function GroupsPage() {
  const [search, setSearch] = useState('');
  const [mine, setMine] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInvites, setShowInvites] = useState(false);

  const { data, isLoading } = useQuery<{ data: Group[] }>({
    queryKey: ['groups', { search, mine }],
    queryFn: () => groupsApi.list({ search: search || undefined, mine: mine ? 'true' : undefined }),
  });

  const groups = data?.data ?? [];

  return (
    <div className="max-w-4xl mx-auto">
      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl font-semibold text-stone-900">Research Groups</h2>
          <p className="text-stone-500 text-sm mt-1">Collaborate with researchers across disciplines</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> New group
        </button>
      </div>

      {/* pending invites banner */}
      <InvitesBanner onOpen={() => setShowInvites(true)} />

      {/* filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className="input pl-8 py-2 text-sm" placeholder="Search groups…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setMine(p => !p)}
          className={`px-3 py-2 rounded-lg border text-sm transition-colors ${mine ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-stone-200 text-stone-500 hover:border-stone-300'}`}>
          My groups
        </button>
      </div>

      {/* group list */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 skeleton rounded-xl" />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="card p-16 text-center">
          <Users size={36} className="mx-auto mb-3 text-stone-300" />
          <p className="text-stone-500 font-medium">{mine ? "You haven't joined any groups yet" : 'No groups found'}</p>
          <p className="text-stone-400 text-sm mt-1">{mine ? 'Browse public groups or create your own.' : 'Try a different search or create a new group.'}</p>
          <button onClick={() => { setMine(false); setShowCreate(true); }} className="btn-primary mt-4 text-sm">
            Create a group
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {groups.map(g => <GroupCard key={g.id} group={g} onClick={() => setSelectedId(g.id)} />)}
        </div>
      )}

      {showCreate  && <CreateModal onClose={() => setShowCreate(false)} />}
      {selectedId  && <GroupDetailPanel id={selectedId} onClose={() => setSelectedId(null)} />}
      {showInvites && <MyInvitesModal onClose={() => setShowInvites(false)} />}
    </div>
  );
}
