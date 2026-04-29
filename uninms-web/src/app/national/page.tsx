'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communityApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  Globe, Plus, X, ShieldCheck, Lock, Eye, BookOpen, CheckCircle2,
  AlertTriangle, Clock, FileText, ThumbsUp, ThumbsDown, RotateCcw,
  Coins, Download, ChevronRight, Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

/* ── constants ──────────────────────────────────────────────────────────── */
const ACCESS_LEVELS = [
  { key: 'open',             label: 'Open',              icon: Globe,      color: 'badge-green',  desc: 'Freely accessible to all' },
  { key: 'abstract_only',    label: 'Abstract only',     icon: Eye,        color: 'badge-blue',   desc: 'Summary visible; full details restricted' },
  { key: 'full_with_consent',label: 'Full with consent', icon: ShieldCheck,color: 'badge-gold',   desc: 'Accessible after FPIC approval' },
  { key: 'metadata_only',    label: 'Metadata only',     icon: Lock,       color: 'badge-stone',  desc: 'Only title and community name visible' },
];

/* ── helpers ────────────────────────────────────────────────────────────── */
function accessConfig(level: string) {
  return ACCESS_LEVELS.find(a => a.key === level) ?? ACCESS_LEVELS[0];
}

function AccessBadge({ level }: { level: string }) {
  const c = accessConfig(level);
  return (
    <span className={`badge text-xs flex items-center gap-1 ${c.color}`}>
      <c.icon size={9} />{c.label}
    </span>
  );
}

/* ── Register as community rep modal ────────────────────────────────────── */
function RepRegisterModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [communityName, setCommunityName] = useState('');
  const { mutate, isPending, error } = useMutation({
    mutationFn: () => communityApi.registerRep({ communityName }),
    onSuccess: () => {
      toast.success('Registration submitted — awaiting admin verification');
      qc.invalidateQueries({ queryKey: ['community-rep'] });
      onClose();
    },
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-semibold text-stone-900">Register as Community Rep</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={16} /></button>
        </div>
        <p className="text-sm text-stone-500 mb-4">
          Register to protect and manage your community's indigenous knowledge assets on the national platform.
          An administrator will verify your identity before granting access.
        </p>
        <label className="label">Community name <span className="text-red-500">*</span></label>
        <input className="input mb-4" placeholder="e.g. Ijaw Nation, Yoruba Heritage Council…"
          value={communityName} onChange={e => setCommunityName(e.target.value)} autoFocus />
        {error && <p className="text-sm text-red-600 mb-3">{(error as any)?.response?.data?.error?.message ?? 'Failed'}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => mutate()} disabled={isPending || communityName.trim().length < 3}
            className="btn-primary disabled:opacity-40">
            {isPending ? 'Submitting…' : 'Register'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Register IK asset modal ────────────────────────────────────────────── */
function AssetForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [culturalContext, setCulturalContext] = useState('');
  const [provenance, setProvenance] = useState('');
  const [accessLevel, setAccessLevel] = useState('full_with_consent');

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => communityApi.createAsset({ title, description, culturalContext, provenance, accessLevel }),
    onSuccess: () => {
      toast.success('Indigenous knowledge asset registered');
      qc.invalidateQueries({ queryKey: ['community-assets'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <h2 className="font-display font-semibold text-stone-900">Register Knowledge Asset</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="label">Title <span className="text-red-500">*</span></label>
            <input className="input" placeholder="e.g. Traditional healing practices of the Tiv people"
              value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Description <span className="text-red-500">*</span></label>
            <textarea className="input resize-none" rows={4}
              placeholder="Describe the knowledge, its origins and cultural significance…"
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="label">Cultural context <span className="text-stone-400 font-normal">(optional)</span></label>
            <textarea className="input resize-none" rows={2}
              placeholder="Ceremonies, seasonal practices, sacred contexts…"
              value={culturalContext} onChange={e => setCulturalContext(e.target.value)} />
          </div>
          <div>
            <label className="label">Provenance <span className="text-stone-400 font-normal">(optional)</span></label>
            <input className="input" placeholder="Where and when this knowledge originated"
              value={provenance} onChange={e => setProvenance(e.target.value)} />
          </div>
          <div>
            <label className="label">Access level</label>
            <div className="grid grid-cols-2 gap-2">
              {ACCESS_LEVELS.map(a => (
                <button key={a.key} type="button" onClick={() => setAccessLevel(a.key)}
                  className={`p-3 rounded-xl border text-left transition-colors ${accessLevel === a.key ? 'border-primary-400 bg-primary-50' : 'border-stone-200 hover:border-stone-300'}`}>
                  <p className="text-xs font-semibold text-stone-800">{a.label}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5 leading-tight">{a.desc}</p>
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{(error as any)?.response?.data?.error?.message ?? 'Failed'}</p>}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-stone-100">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => mutate()}
            disabled={isPending || title.trim().length < 3 || description.trim().length < 20}
            className="btn-primary disabled:opacity-40">
            {isPending ? 'Registering…' : 'Register asset'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Access request modal ───────────────────────────────────────────────── */
function AccessRequestModal({ assetId, assetTitle, onClose }: { assetId: string; assetTitle: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [purpose, setPurpose]       = useState('');
  const [requestType, setRequestType] = useState('access');
  const { mutate, isPending, error } = useMutation({
    mutationFn: () => communityApi.requestAccess(assetId, { purpose, requestType }),
    onSuccess: (res: any) => {
      toast.success(res?.message ?? 'Access request submitted');
      qc.invalidateQueries({ queryKey: ['community-assets'] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Request failed'),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-stone-900">Request Access</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={16} /></button>
        </div>
        <p className="text-sm text-stone-500 mb-4">
          Requesting access to: <span className="font-medium text-stone-700">{assetTitle}</span>
        </p>
        <div className="mb-4">
          <label className="label">Request type</label>
          <div className="flex rounded-lg border border-stone-200 overflow-hidden">
            <button type="button" onClick={() => setRequestType('access')}
              className={`flex-1 py-2 text-sm transition-colors ${requestType === 'access' ? 'bg-primary-600 text-white font-medium' : 'bg-white text-stone-500 hover:bg-stone-50'}`}>
              Access
            </button>
            <button type="button" onClick={() => setRequestType('commercialisation')}
              className={`flex-1 py-2 text-sm border-l border-stone-200 transition-colors ${requestType === 'commercialisation' ? 'bg-primary-600 text-white font-medium' : 'bg-white text-stone-500 hover:bg-stone-50'}`}>
              Commercialisation
            </button>
          </div>
        </div>
        <div className="mb-4">
          <label className="label">Purpose <span className="text-red-500">*</span></label>
          <textarea className="input resize-none" rows={3}
            placeholder="Explain how you intend to use this knowledge…"
            value={purpose} onChange={e => setPurpose(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600 mb-3">{(error as any)?.response?.data?.error?.message ?? 'Failed'}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => mutate()} disabled={isPending || purpose.trim().length < 10}
            className="btn-primary disabled:opacity-40">
            {isPending ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Asset detail modal ─────────────────────────────────────────────────── */
function AssetDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [activeReqId, setActiveReqId] = useState<string | null>(null);
  const isRep = user?.roles?.includes('community_rep');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['community-asset', id],
    queryFn: () => communityApi.asset(id),
  });

  const { data: reqData } = useQuery({
    queryKey: ['asset-requests', id],
    queryFn: () => communityApi.assetRequests(id),
    enabled: !!isRep,
  });

  const { data: tokenData } = useQuery({
    queryKey: ['asset-tokens', id],
    queryFn: () => communityApi.tokenLedger(id),
    enabled: !!isRep,
  });

  const markSacredMut = useMutation({
    mutationFn: () => communityApi.markSacred(id),
    onSuccess: (res: any) => { toast.success(res?.message ?? 'Marked as sacred'); refetch(); },
    onError: () => toast.error('Failed'),
  });
  const approveMut = useMutation({
    mutationFn: (reqId: string) => communityApi.approveRequest(reqId),
    onSuccess: () => { toast.success('Request approved'); qc.invalidateQueries({ queryKey: ['asset-requests', id] }); },
  });
  const rejectMut = useMutation({
    mutationFn: ({ reqId, reason }: { reqId: string; reason: string }) => communityApi.rejectRequest(reqId, reason),
    onSuccess: () => { toast.success('Request rejected'); setActiveReqId(null); qc.invalidateQueries({ queryKey: ['asset-requests', id] }); },
  });
  const revokeMut = useMutation({
    mutationFn: ({ reqId, reason }: { reqId: string; reason: string }) => communityApi.revokeRequest(reqId, reason),
    onSuccess: () => { toast.success('Consent revoked'); qc.invalidateQueries({ queryKey: ['asset-requests', id] }); },
  });
  const confirmTokenMut = useMutation({
    mutationFn: (tokenId: string) => communityApi.confirmToken(tokenId),
    onSuccess: () => { toast.success('Receipt confirmed'); qc.invalidateQueries({ queryKey: ['asset-tokens', id] }); },
  });

  const asset = (data as any)?.data;
  const requests = (reqData as any)?.data ?? [];
  const tokens = (tokenData as any)?.data;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-stone-100">
          <div className="flex-1 min-w-0">
            {isLoading ? <div className="h-5 w-64 skeleton" /> : asset && (
              <>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <AccessBadge level={asset.access_level} />
                  {asset.is_sacred && (
                    <span className="badge text-xs bg-red-50 text-red-700 border-red-100 flex items-center gap-1">
                      <AlertTriangle size={9} />Sacred
                    </span>
                  )}
                </div>
                <h2 className="font-display font-semibold text-stone-900 text-lg leading-tight">{asset.title}</h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  {asset.community_name} · {asset.registered_by_name}
                  {asset.created_at && ` · ${formatDistanceToNow(new Date(asset.created_at), { addSuffix: true })}`}
                </p>
              </>
            )}
          </div>
          <button onClick={onClose} className="ml-3 p-1 rounded-lg text-stone-400 hover:bg-stone-100 flex-shrink-0"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-10 skeleton" />)}</div>
          ) : asset ? (
            <>
              {asset.description && (
                <div>
                  <h3 className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Description</h3>
                  <p className="text-sm text-stone-700 leading-relaxed">{asset.description}</p>
                </div>
              )}
              {asset.cultural_context && (
                <div>
                  <h3 className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Cultural context</h3>
                  <p className="text-sm text-stone-700 leading-relaxed">{asset.cultural_context}</p>
                </div>
              )}
              {asset.provenance && (
                <div>
                  <h3 className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Provenance</h3>
                  <p className="text-sm text-stone-600">{asset.provenance}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                {!isRep && ['full_with_consent', 'abstract_only'].includes(asset.access_level) && (
                  <button onClick={() => setShowRequestModal(true)} className="btn-primary text-sm flex items-center gap-1.5">
                    <ShieldCheck size={13} /> Request access
                  </button>
                )}
                {isRep && !asset.is_sacred && (
                  <button
                    onClick={() => { if (confirm('Mark as sacred? This is PERMANENT and irreversible.')) markSacredMut.mutate(); }}
                    disabled={markSacredMut.isPending}
                    className="btn-secondary text-sm flex items-center gap-1.5 text-red-600">
                    <AlertTriangle size={13} /> Mark sacred
                  </button>
                )}
                {isRep && tokens && (
                  <a href={communityApi.exportTokens(id)}
                    className="btn-secondary text-sm flex items-center gap-1.5">
                    <Download size={13} /> Export ledger
                  </a>
                )}
              </div>

              {/* Token ledger (reps only) */}
              {isRep && tokens && (
                <div>
                  <h3 className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-3 flex items-center gap-1.5">
                    <Coins size={11} />Benefit ledger · Community balance: ₦{Number(tokens.community_balance).toLocaleString()}
                  </h3>
                  {tokens.transactions?.length > 0 ? (
                    <div className="space-y-1.5">
                      {tokens.transactions.map((t: any) => (
                        <div key={t.id} className="flex items-center gap-3 text-xs p-2 rounded-lg border border-stone-100">
                          <span className="text-stone-500 capitalize flex-1">{t.transaction_type.replace(/_/g, ' ')}</span>
                          <span className="font-medium text-stone-800">₦{Number(t.amount).toLocaleString()}</span>
                          <span className="text-stone-400">{t.recipient}</span>
                          {t.confirmed_at ? (
                            <CheckCircle2 size={12} className="text-green-500" />
                          ) : (
                            <button onClick={() => confirmTokenMut.mutate(t.id)} disabled={confirmTokenMut.isPending}
                              className="text-primary-600 hover:underline">Confirm</button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-stone-400">No transactions yet.</p>}
                </div>
              )}

              {/* FPIC Requests (reps only) */}
              {isRep && requests.length > 0 && (
                <div>
                  <h3 className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-3 flex items-center gap-1.5">
                    <FileText size={11} />Access requests ({requests.length})
                  </h3>
                  <div className="space-y-3">
                    {requests.map((r: any) => (
                      <div key={r.id} className="card p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-stone-800">{r.requester_name}</p>
                            <p className="text-xs text-stone-400">{r.requester_email} · {r.request_type}</p>
                          </div>
                          <span className={`badge text-xs ${
                            r.status === 'pending'  ? 'badge-gold'  :
                            r.status === 'approved' ? 'badge-green' :
                            r.status === 'revoked'  ? 'badge-stone' : 'text-red-600 bg-red-50'
                          }`}>{r.status}</span>
                        </div>
                        <p className="text-xs text-stone-600">{r.purpose}</p>
                        {r.status === 'pending' && (
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => approveMut.mutate(r.id)} disabled={approveMut.isPending}
                              className="btn-primary text-xs flex items-center gap-1">
                              <ThumbsUp size={11} /> Approve
                            </button>
                            {activeReqId === r.id ? (
                              <div className="flex gap-1 flex-1">
                                <input className="input text-xs flex-1 py-1" placeholder="Reason for rejection…"
                                  value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                                <button onClick={() => rejectMut.mutate({ reqId: r.id, reason: rejectReason })}
                                  disabled={!rejectReason.trim() || rejectMut.isPending}
                                  className="btn-secondary text-xs text-red-600 disabled:opacity-40">
                                  Confirm
                                </button>
                                <button onClick={() => setActiveReqId(null)} className="btn-secondary text-xs">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => { setActiveReqId(r.id); setRejectReason(''); }}
                                className="btn-secondary text-xs flex items-center gap-1 text-red-600">
                                <ThumbsDown size={11} /> Reject
                              </button>
                            )}
                          </div>
                        )}
                        {r.status === 'approved' && (
                          <div className="flex gap-1 pt-1">
                            {activeReqId === r.id ? (
                              <>
                                <input className="input text-xs flex-1 py-1" placeholder="Reason for revocation…"
                                  value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                                <button onClick={() => revokeMut.mutate({ reqId: r.id, reason: rejectReason })}
                                  disabled={!rejectReason.trim() || revokeMut.isPending}
                                  className="btn-secondary text-xs text-red-600 disabled:opacity-40">
                                  Confirm revoke
                                </button>
                                <button onClick={() => setActiveReqId(null)} className="btn-secondary text-xs">Cancel</button>
                              </>
                            ) : (
                              <button onClick={() => { setActiveReqId(r.id); setRejectReason(''); }}
                                className="btn-secondary text-xs flex items-center gap-1 text-orange-600">
                                <RotateCcw size={11} /> Revoke consent
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
      {showRequestModal && asset && (
        <AccessRequestModal assetId={id} assetTitle={asset.title} onClose={() => setShowRequestModal(false)} />
      )}
    </div>
  );
}

/* ── Asset card ─────────────────────────────────────────────────────────── */
function AssetCard({ asset, onClick }: { asset: any; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card p-4 text-left w-full hover:shadow-md hover:-translate-y-0.5 transition-all group">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <AccessBadge level={asset.access_level} />
            {asset.is_sacred && (
              <span className="badge text-xs bg-red-50 text-red-700 flex items-center gap-1">
                <AlertTriangle size={9} />Sacred
              </span>
            )}
          </div>
          <p className="font-semibold text-stone-900 text-sm leading-snug line-clamp-2">{asset.title}</p>
          <p className="text-xs text-stone-400 mt-1 flex items-center gap-1.5">
            <Globe size={10} />{asset.community_name}
          </p>
          {asset.description && (
            <p className="text-xs text-stone-500 mt-1.5 line-clamp-2 leading-relaxed">{asset.description}</p>
          )}
        </div>
        <ChevronRight size={14} className="text-stone-300 group-hover:text-primary-500 flex-shrink-0 mt-1 transition-colors" />
      </div>
    </button>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function NationalHubPage() {
  const { user } = useAuthStore();
  const isRep = user?.roles?.includes('community_rep');

  const [search, setSearch]           = useState('');
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [showAssetForm, setShowAssetForm]   = useState(false);
  const [showRegModal, setShowRegModal]     = useState(false);

  const { data: repData } = useQuery({
    queryKey: ['community-rep'],
    queryFn: () => communityApi.myRep(),
    retry: false,
  });
  const rep = (repData as any)?.data;

  const { data, isLoading } = useQuery({
    queryKey: ['community-assets'],
    queryFn: () => communityApi.assets(),
  });
  const allAssets: any[] = (data as any)?.data ?? [];

  const assets = allAssets.filter(a =>
    !search || a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.community_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden mb-6"
        style={{ background: 'linear-gradient(135deg,#09432c 0%,#1a6b44 100%)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 50%,#d4a017,transparent 60%)' }} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <Globe size={18} className="text-primary-300" />
            <span className="text-primary-300 text-sm">National Knowledge Hub</span>
          </div>
          <h2 className="font-display text-2xl font-semibold mb-1">Indigenous Knowledge Assets</h2>
          <p className="text-white/60 text-sm">
            Protecting and sharing Nigeria's indigenous knowledge with FPIC-compliant consent management.
          </p>
        </div>
      </div>

      {/* Rep status banner */}
      {!rep ? (
        <div className="card p-4 border-primary-200 bg-primary-50/50 mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-stone-800">Are you a community representative?</p>
            <p className="text-xs text-stone-500 mt-0.5">Register to manage your community's indigenous knowledge assets.</p>
          </div>
          <button onClick={() => setShowRegModal(true)} className="btn-primary text-sm shrink-0">
            Register as rep
          </button>
        </div>
      ) : !rep.verified ? (
        <div className="card p-4 bg-amber-50 border-amber-200 mb-5 flex items-center gap-3">
          <Clock size={16} className="text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900">Verification pending</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Your registration for <strong>{rep.community_name}</strong> is awaiting admin verification.
            </p>
          </div>
        </div>
      ) : (
        <div className="card p-4 bg-green-50 border-green-200 mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-900">Verified rep · {rep.community_name}</p>
              <p className="text-xs text-green-700 mt-0.5">{rep.asset_count} asset{rep.asset_count !== 1 ? 's' : ''} registered</p>
            </div>
          </div>
          <button onClick={() => setShowAssetForm(true)} className="btn-primary text-sm shrink-0">
            <Plus size={13} /> Register asset
          </button>
        </div>
      )}

      {/* Search + header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className="input pl-8 text-sm" placeholder="Search by title or community…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="text-xs text-stone-400">{assets.length} asset{assets.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Asset grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 skeleton rounded-xl" />)}
        </div>
      ) : assets.length === 0 ? (
        <div className="card p-16 text-center">
          <BookOpen size={36} className="mx-auto mb-3 text-stone-300" />
          <p className="text-stone-500 font-medium">
            {search ? 'No assets match your search' : 'No knowledge assets registered yet'}
          </p>
          {search && (
            <button onClick={() => setSearch('')} className="btn-secondary mt-3 text-sm">Clear search</button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {assets.map((a: any) => (
            <AssetCard key={a.id} asset={a} onClick={() => setSelectedId(a.id)} />
          ))}
        </div>
      )}

      {showRegModal   && <RepRegisterModal onClose={() => setShowRegModal(false)} />}
      {showAssetForm  && <AssetForm onClose={() => setShowAssetForm(false)} />}
      {selectedId     && <AssetDetail id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
