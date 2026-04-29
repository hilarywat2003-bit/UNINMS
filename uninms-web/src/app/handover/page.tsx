'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { handoverApi, usersApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  Package, Plus, X, ChevronRight, Check, Send, CheckCircle2,
  Clock, FileText, Trash2, Search, ArrowRight, Flag,
  Building2, Globe, ArrowDownToLine, ArrowUpFromLine,
} from 'lucide-react';

/* ── constants ──────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { key: 'ongoing_projects',        label: 'Ongoing Projects',        color: 'bg-blue-100 text-blue-700' },
  { key: 'key_contacts',            label: 'Key Contacts',            color: 'bg-purple-100 text-purple-700' },
  { key: 'procedures',              label: 'Procedures & Processes',   color: 'bg-green-100 text-green-700' },
  { key: 'access_credentials',      label: 'Access & Credentials',    color: 'bg-red-100 text-red-700' },
  { key: 'reports',                 label: 'Reports & Documents',     color: 'bg-amber-100 text-amber-700' },
  { key: 'meetings',                label: 'Meetings & Schedules',    color: 'bg-teal-100 text-teal-700' },
  { key: 'institutional_knowledge', label: 'Institutional Knowledge', color: 'bg-stone-200 text-stone-700' },
  { key: 'other',                   label: 'Other',                   color: 'bg-stone-100 text-stone-500' },
];

const PRIORITIES = [
  { key: 'high',   label: 'High',   color: 'text-red-600' },
  { key: 'medium', label: 'Medium', color: 'text-amber-600' },
  { key: 'low',    label: 'Low',    color: 'text-stone-400' },
];

const EXTERNAL_TYPES = [
  { key: 'industry',           label: 'Industry / Company' },
  { key: 'government',         label: 'Government Agency' },
  { key: 'ngo',                label: 'NGO / Civil Society' },
  { key: 'international',      label: 'International Body' },
  { key: 'research_institute', label: 'Research Institute' },
  { key: 'other',              label: 'Other' },
];

const TRANSFER_TYPES = [
  { key: 'internal', label: 'Internal',          desc: 'Between staff members',               icon: ArrowRight },
  { key: 'outgoing', label: 'Outgoing (to ext)', desc: 'University → industry / third party', icon: ArrowUpFromLine },
  { key: 'incoming', label: 'Incoming (from ext)', desc: 'Industry / third party → university', icon: ArrowDownToLine },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:        { label: 'Draft',        color: 'badge-stone',  icon: Clock },
  active:       { label: 'In progress',  color: 'badge-gold',   icon: Send },
  completed:    { label: 'Completed',    color: 'badge-green',  icon: CheckCircle2 },
  acknowledged: { label: 'Acknowledged', color: 'badge-green',  icon: CheckCircle2 },
};

/* ── types ──────────────────────────────────────────────────────────────── */
interface HandoverItem {
  id: string; category: string; title: string; description: string | null;
  document_title: string | null; priority: string; is_done: boolean;
}
interface Handover {
  id: string; title: string; context: string | null; status: string;
  deadline: string | null; completed_at: string | null; created_at: string;
  transfer_type: string;
  external_name: string | null; external_org: string | null;
  external_email: string | null; external_type: string | null;
  from_id: string; from_name: string; from_photo: string | null; from_department: string | null;
  to_id: string | null; to_name: string | null; to_photo: string | null; to_department: string | null;
  item_count: number; done_count: number;
  items?: HandoverItem[];
}

/* ── helpers ────────────────────────────────────────────────────────────── */
function Avatar({ name, url, size = 8 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (url) return <img src={url} alt={name} className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div className={`w-${size} h-${size} rounded-full bg-primary-100 text-primary-700 text-xs font-semibold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  );
}

function OrgAvatar({ name, size = 8 }: { name: string; size?: number }) {
  return (
    <div className={`w-${size} h-${size} rounded-full bg-stone-200 text-stone-600 flex items-center justify-center flex-shrink-0`}>
      <Building2 size={size * 2} />
    </div>
  );
}

function catColor(key: string) { return CATEGORIES.find(c => c.key === key)?.color ?? 'bg-stone-100 text-stone-500'; }
function catLabel(key: string) { return CATEGORIES.find(c => c.key === key)?.label ?? key; }
function priColor(key: string) { return PRIORITIES.find(p => p.key === key)?.color ?? 'text-stone-400'; }

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-stone-400 flex-shrink-0">{done}/{total}</span>
    </div>
  );
}

/* ── External party display ─────────────────────────────────────────────── */
function ExternalPartyChip({ h }: { h: Handover }) {
  const extType = EXTERNAL_TYPES.find(t => t.key === h.external_type);
  return (
    <div className="flex items-center gap-1.5">
      <Globe size={11} className="text-stone-400" />
      <span className="text-xs text-stone-600 font-medium">{h.external_org}</span>
      {h.external_name && <span className="text-xs text-stone-400">· {h.external_name}</span>}
      {extType && <span className="badge badge-stone text-xs">{extType.label}</span>}
    </div>
  );
}

/* ── Create modal ───────────────────────────────────────────────────────── */
function CreateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [transferType, setTransferType] = useState('internal');
  const [title, setTitle]       = useState('');
  const [context, setContext]   = useState('');
  const [deadline, setDeadline] = useState('');

  // internal
  const [userQuery, setUserQuery] = useState('');
  const [toUser, setToUser] = useState<{ id: string; full_name: string; department_name: string | null } | null>(null);

  // external
  const [extName, setExtName]   = useState('');
  const [extOrg, setExtOrg]     = useState('');
  const [extEmail, setExtEmail] = useState('');
  const [extType, setExtType]   = useState('industry');

  const { data: searchData } = useQuery<{ data: any[] }>({
    queryKey: ['user-search', userQuery],
    queryFn:  () => usersApi.search(userQuery),
    enabled:  userQuery.length >= 2 && !toUser,
  });
  const results = searchData?.data ?? [];

  const canSubmit = title.trim().length >= 3 && (
    (transferType === 'internal' && !!toUser) ||
    (transferType !== 'internal' && extOrg.trim().length >= 2)
  );

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => handoverApi.create({
      title, context, deadline,
      transferType,
      ...(transferType === 'internal'
        ? { toUserId: toUser!.id }
        : { externalName: extName, externalOrg: extOrg, externalEmail: extEmail, externalType: extType }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['handovers'] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <h2 className="font-display font-semibold text-stone-900">New Knowledge Transfer</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* transfer type */}
          <div>
            <label className="label">Transfer type</label>
            <div className="grid grid-cols-3 gap-2">
              {TRANSFER_TYPES.map(t => (
                <button key={t.key} type="button" onClick={() => setTransferType(t.key)}
                  className={`p-3 rounded-xl border text-left transition-colors ${transferType === t.key ? 'border-primary-400 bg-primary-50' : 'border-stone-200 hover:border-stone-300'}`}>
                  <t.icon size={14} className={transferType === t.key ? 'text-primary-600 mb-1' : 'text-stone-400 mb-1'} />
                  <p className="text-xs font-medium text-stone-800">{t.label}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5 leading-tight">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* recipient */}
          {transferType === 'internal' ? (
            <div>
              <label className="label">{transferType === 'internal' ? 'Recipient' : 'Internal contact'} <span className="text-red-500">*</span></label>
              {toUser ? (
                <div className="flex items-center gap-2 p-2.5 bg-stone-50 rounded-xl">
                  <Avatar name={toUser.full_name} size={7} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-800">{toUser.full_name}</p>
                    {toUser.department_name && <p className="text-xs text-stone-400">{toUser.department_name}</p>}
                  </div>
                  <button onClick={() => { setToUser(null); setUserQuery(''); }} className="text-stone-400 hover:text-red-500"><X size={13} /></button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input className="input pl-8" placeholder="Search by name or email…"
                      value={userQuery} onChange={e => setUserQuery(e.target.value)} />
                  </div>
                  {results.length > 0 && (
                    <div className="mt-1 border border-stone-200 rounded-xl overflow-hidden">
                      {results.map((u: any) => (
                        <button key={u.id} onClick={() => setToUser(u)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-stone-50 border-b border-stone-100 last:border-0">
                          <Avatar name={u.full_name} size={6} />
                          <div>
                            <p className="text-stone-800">{u.full_name}</p>
                            {u.department_name && <p className="text-xs text-stone-400">{u.department_name}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3 p-4 rounded-xl border border-stone-200 bg-stone-50">
              <p className="text-xs font-medium text-stone-700 flex items-center gap-1.5">
                <Globe size={12} /> External party details
              </p>
              <div>
                <label className="label text-xs">Organisation name <span className="text-red-500">*</span></label>
                <input className="input" placeholder="e.g. Dangote Industries, WHO, NITDA…"
                  value={extOrg} onChange={e => setExtOrg(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Contact person</label>
                  <input className="input" placeholder="Full name"
                    value={extName} onChange={e => setExtName(e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Contact email</label>
                  <input className="input" type="email" placeholder="email@org.com"
                    value={extEmail} onChange={e => setExtEmail(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label text-xs">Organisation type</label>
                <select className="input" value={extType} onChange={e => setExtType(e.target.value)}>
                  {EXTERNAL_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* title */}
          <div>
            <label className="label">Package title <span className="text-red-500">*</span></label>
            <input className="input" placeholder="e.g. Technology Licensing Transfer — NITDA 2026"
              value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="label">Context / reason</label>
            <textarea className="input resize-none" rows={2}
              placeholder={transferType === 'outgoing'
                ? 'e.g. Licensing research findings to industry partner…'
                : transferType === 'incoming'
                ? 'e.g. Industry partner documenting their process for our researchers…'
                : 'e.g. Transitioning to a new role, sabbatical leave…'}
              value={context} onChange={e => setContext(e.target.value)} />
          </div>

          <div>
            <label className="label">Target completion date</label>
            <input className="input" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600">{(error as any)?.response?.data?.error?.message ?? 'Something went wrong'}</p>}
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-stone-100">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => mutate()} disabled={isPending || !canSubmit}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
            {isPending ? 'Creating…' : 'Create package'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Handover detail modal ──────────────────────────────────────────────── */
function HandoverDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [newTitle, setNewTitle]       = useState('');
  const [newCategory, setNewCategory] = useState('other');
  const [newDesc, setNewDesc]         = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [showAddItem, setShowAddItem] = useState(false);

  const { data, isLoading, refetch } = useQuery<{ data: Handover }>({
    queryKey: ['handover', id],
    queryFn:  () => handoverApi.get(id),
  });
  const h = data?.data;
  const isSender    = h?.from_id === user?.id;
  const isRecipient = h?.to_id   === user?.id;
  const isExternal  = h?.transfer_type !== 'internal';

  const sendMut     = useMutation({ mutationFn: () => handoverApi.send(id),        onSuccess: () => { refetch(); qc.invalidateQueries({ queryKey: ['handovers'] }); } });
  const completeMut = useMutation({ mutationFn: () => handoverApi.complete(id),    onSuccess: () => { refetch(); qc.invalidateQueries({ queryKey: ['handovers'] }); } });
  const ackMut      = useMutation({ mutationFn: () => handoverApi.acknowledge(id), onSuccess: () => { refetch(); qc.invalidateQueries({ queryKey: ['handovers'] }); } });

  const addItemMut = useMutation({
    mutationFn: () => handoverApi.addItem(id, { title: newTitle, category: newCategory, description: newDesc, priority: newPriority }),
    onSuccess:  () => { refetch(); setNewTitle(''); setNewDesc(''); setShowAddItem(false); },
  });
  const toggleMut  = useMutation({
    mutationFn: ({ itemId, isDone }: { itemId: string; isDone: boolean }) => handoverApi.updateItem(id, itemId, { isDone }),
    onSuccess:  () => refetch(),
  });
  const deleteMut  = useMutation({
    mutationFn: (itemId: string) => handoverApi.deleteItem(id, itemId),
    onSuccess:  () => refetch(),
  });

  const grouped = (h?.items ?? []).reduce<Record<string, HandoverItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const sc = h ? STATUS_CONFIG[h.status] : null;
  const typeConfig = TRANSFER_TYPES.find(t => t.key === h?.transfer_type);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* header */}
        <div className="flex items-start justify-between p-5 border-b border-stone-100">
          <div className="flex-1 min-w-0">
            {isLoading ? <div className="h-5 w-56 skeleton" /> : h && (
              <>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {sc && <span className={`badge text-xs flex items-center gap-1 ${sc.color}`}><sc.icon size={9} />{sc.label}</span>}
                  {typeConfig && <span className="badge badge-stone text-xs flex items-center gap-1"><typeConfig.icon size={9} />{typeConfig.label}</span>}
                  {h.deadline && <span className="text-xs text-stone-400 flex items-center gap-1"><Clock size={10} />Due {new Date(h.deadline).toLocaleDateString()}</span>}
                </div>
                <h2 className="font-display font-semibold text-stone-900 leading-tight">{h.title}</h2>
                {h.context && <p className="text-xs text-stone-400 mt-0.5">{h.context}</p>}

                {/* parties */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Avatar name={h.from_name} url={h.from_photo} size={5} />
                  <span className="text-xs text-stone-500">{h.from_name}</span>
                  <ArrowRight size={10} className="text-stone-300" />
                  {isExternal ? (
                    h.external_org && <ExternalPartyChip h={h} />
                  ) : (
                    h.to_name && <>
                      <Avatar name={h.to_name} url={h.to_photo} size={5} />
                      <span className="text-xs text-stone-500">{h.to_name}</span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} className="ml-3 p-1 rounded-lg text-stone-400 hover:bg-stone-100 flex-shrink-0"><X size={16} /></button>
        </div>

        {/* progress */}
        {h && parseInt(String(h.item_count)) > 0 && (
          <div className="px-5 py-3 border-b border-stone-100">
            <Progress done={parseInt(String(h.done_count))} total={parseInt(String(h.item_count))} />
          </div>
        )}

        {/* action bar */}
        {h && (
          <div className="px-5 py-3 border-b border-stone-100 flex gap-2 flex-wrap">
            {isSender && h.status === 'draft' && (
              <button onClick={() => sendMut.mutate()} disabled={sendMut.isPending}
                className="btn-primary text-sm flex items-center gap-1.5">
                <Send size={13} /> {sendMut.isPending ? 'Sending…' : isExternal ? 'Mark as sent' : 'Send to recipient'}
              </button>
            )}
            {isSender && h.status === 'active' && (
              <button onClick={() => { if (confirm('Mark as fully transferred?')) completeMut.mutate(); }}
                disabled={completeMut.isPending} className="btn-primary text-sm flex items-center gap-1.5">
                <CheckCircle2 size={13} /> {completeMut.isPending ? '…' : 'Mark complete'}
              </button>
            )}
            {/* For external: sender can also acknowledge on behalf of external party */}
            {isSender && isExternal && h.status === 'completed' && (
              <button onClick={() => ackMut.mutate()} disabled={ackMut.isPending}
                className="btn-secondary text-sm flex items-center gap-1.5">
                <Check size={13} /> {ackMut.isPending ? '…' : 'Confirm receipt by external party'}
              </button>
            )}
            {isRecipient && !isExternal && h.status === 'completed' && (
              <button onClick={() => ackMut.mutate()} disabled={ackMut.isPending}
                className="btn-primary text-sm flex items-center gap-1.5">
                <Check size={13} /> {ackMut.isPending ? '…' : 'Acknowledge receipt'}
              </button>
            )}
            {isSender && ['draft', 'active'].includes(h.status) && (
              <button onClick={() => setShowAddItem(v => !v)}
                className="btn-secondary text-sm flex items-center gap-1.5">
                <Plus size={13} /> Add item
              </button>
            )}
          </div>
        )}

        {/* add item form */}
        {showAddItem && (
          <div className="px-5 py-4 border-b border-stone-100 bg-stone-50 space-y-3">
            <p className="text-xs font-medium text-stone-700">New knowledge item</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Category</label>
                <select className="input text-sm py-1.5" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs">Priority</label>
                <select className="input text-sm py-1.5" value={newPriority} onChange={e => setNewPriority(e.target.value)}>
                  {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <input className="input text-sm" placeholder="Item title *"
              value={newTitle} onChange={e => setNewTitle(e.target.value)} />
            <textarea className="input resize-none text-sm py-1.5" rows={2} placeholder="Description or instructions…"
              value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => addItemMut.mutate()} disabled={!newTitle.trim() || addItemMut.isPending}
                className="btn-primary text-sm disabled:opacity-40">{addItemMut.isPending ? 'Adding…' : 'Add'}</button>
              <button onClick={() => setShowAddItem(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        )}

        {/* items */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-14 skeleton" />)}</div>
          ) : (h?.items ?? []).length === 0 ? (
            <div className="text-center py-10 text-stone-400">
              <Package size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No items yet</p>
              {isSender && <p className="text-xs mt-1">Add knowledge items above.</p>}
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(grouped).map(([cat, items]) => (
                <section key={cat}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide mb-2">
                    <span className={`px-2 py-0.5 rounded-full ${catColor(cat)}`}>{catLabel(cat)}</span>
                  </h3>
                  <div className="space-y-2">
                    {items.map(item => (
                      <div key={item.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${item.is_done ? 'border-stone-100 bg-stone-50' : 'border-stone-200 bg-white'}`}>
                        <button onClick={() => toggleMut.mutate({ itemId: item.id, isDone: !item.is_done })}
                          className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${item.is_done ? 'bg-primary-500 border-primary-500' : 'border-stone-300'}`}>
                          {item.is_done && <Check size={9} className="text-white" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-sm font-medium ${item.is_done ? 'line-through text-stone-400' : 'text-stone-800'}`}>{item.title}</p>
                            <Flag size={10} className={`flex-shrink-0 ${priColor(item.priority)}`} />
                          </div>
                          {item.description && <p className="text-xs text-stone-500 mt-0.5">{item.description}</p>}
                          {item.document_title && (
                            <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
                              <FileText size={9} />{item.document_title}
                            </p>
                          )}
                        </div>
                        {isSender && ['draft', 'active'].includes(h?.status ?? '') && (
                          <button onClick={() => deleteMut.mutate(item.id)}
                            className="flex-shrink-0 text-stone-300 hover:text-red-400 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Handover card ──────────────────────────────────────────────────────── */
function HandoverCard({ h, userId, onClick }: { h: Handover; userId: string; onClick: () => void }) {
  const isSender   = h.from_id === userId;
  const isExternal = h.transfer_type !== 'internal';
  const sc         = STATUS_CONFIG[h.status];
  const typeConfig = TRANSFER_TYPES.find(t => t.key === h.transfer_type);
  const done  = parseInt(String(h.done_count));
  const total = parseInt(String(h.item_count));

  return (
    <button onClick={onClick} className="card p-4 text-left w-full hover:shadow-md hover:-translate-y-0.5 transition-all group">
      <div className="flex items-start gap-3">
        {isExternal ? <OrgAvatar name={h.external_org ?? ''} size={9} /> : (
          <Avatar name={isSender ? (h.to_name ?? '') : h.from_name} url={isSender ? h.to_photo : h.from_photo} size={9} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            {sc && <span className={`badge text-xs flex items-center gap-1 ${sc.color}`}><sc.icon size={9} />{sc.label}</span>}
            {typeConfig && <span className="badge badge-stone text-xs flex items-center gap-1"><typeConfig.icon size={9} />{typeConfig.label}</span>}
          </div>
          <p className="text-sm font-semibold text-stone-900 truncate">{h.title}</p>
          {isExternal ? (
            <p className="text-xs text-stone-400 truncate">
              {h.transfer_type === 'outgoing' ? 'To' : 'From'}: {h.external_org}
              {h.external_name && ` (${h.external_name})`}
            </p>
          ) : (
            <p className="text-xs text-stone-400">
              {isSender ? 'To' : 'From'}: {isSender ? h.to_name : h.from_name}
            </p>
          )}
          {total > 0 && <div className="mt-2"><Progress done={done} total={total} /></div>}
          {h.deadline && (
            <p className="text-xs text-stone-400 flex items-center gap-1 mt-1">
              <Clock size={10} />Due {new Date(h.deadline).toLocaleDateString()}
            </p>
          )}
        </div>
        <ChevronRight size={14} className="text-stone-300 group-hover:text-primary-500 flex-shrink-0 mt-1 transition-colors" />
      </div>
    </button>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function HandoverPage() {
  const { user } = useAuthStore();
  const [tab, setTab]         = useState<'all' | 'sent' | 'received'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const roleMap: Record<string, string> = { sent: 'sender', received: 'receiver', all: '' };

  const { data, isLoading } = useQuery<{ data: Handover[] }>({
    queryKey: ['handovers', tab],
    queryFn:  () => handoverApi.list(roleMap[tab] ? { role: roleMap[tab] } : undefined),
  });
  const handovers = data?.data ?? [];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl font-semibold text-stone-900">Knowledge Transfer</h2>
          <p className="text-stone-500 text-sm mt-1">Transfer institutional knowledge internally or with external partners</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> New transfer
        </button>
      </div>

      <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-6 w-fit">
        {([
          { key: 'all',      label: 'All' },
          { key: 'sent',     label: 'Sent by me' },
          { key: 'received', label: 'Received' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 skeleton rounded-xl" />)}
        </div>
      ) : handovers.length === 0 ? (
        <div className="card p-16 text-center">
          <Package size={36} className="mx-auto mb-3 text-stone-300" />
          <p className="text-stone-500 font-medium">No knowledge transfers yet</p>
          <p className="text-stone-400 text-sm mt-1">Transfer knowledge to a colleague, an industry partner, or receive it from a third party.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mt-4 text-sm">Create transfer package</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {handovers.map(h => <HandoverCard key={h.id} h={h} userId={user!.id} onClick={() => setSelectedId(h.id)} />)}
        </div>
      )}

      {showCreate  && <CreateModal onClose={() => setShowCreate(false)} />}
      {selectedId  && <HandoverDetail id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
