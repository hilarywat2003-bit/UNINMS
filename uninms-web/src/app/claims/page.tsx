'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { claimsApi, documentsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  Award, Plus, X, ChevronRight, ThumbsUp, ExternalLink,
  FileText, MapPin, Calendar, Building2, CheckCircle2, Clock, AlertCircle, RotateCcw,
} from 'lucide-react';

/* ── constants ──────────────────────────────────────────────────────────── */
const CLAIM_TYPES = [
  { key: 'policy',    label: 'Policy',    desc: 'Influenced government or institutional policy', color: 'bg-blue-100 text-blue-700' },
  { key: 'product',   label: 'Product',   desc: 'Led to a product or technology', color: 'bg-purple-100 text-purple-700' },
  { key: 'practice',  label: 'Practice',  desc: 'Changed professional practice', color: 'bg-green-100 text-green-700' },
  { key: 'community', label: 'Community', desc: 'Benefited a community or population', color: 'bg-gold-100 text-gold-700' },
];

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending:          { label: 'Pending review', icon: Clock,         color: 'badge-gold' },
  approved:         { label: 'Approved',        icon: CheckCircle2,  color: 'badge-green' },
  rejected:         { label: 'Rejected',        icon: AlertCircle,   color: 'text-red-600 bg-red-50' },
  revision_needed:  { label: 'Revision needed', icon: RotateCcw,     color: 'badge-stone' },
};

/* ── types ──────────────────────────────────────────────────────────────── */
interface Claim {
  id: string; title: string; claim_type: string; description: string;
  organization: string | null; location: string | null;
  implementation_date: string | null; evidence_url: string | null;
  impact_summary: string | null; status: string; review_note: string | null;
  endorsement_count: number; created_at: string;
  submitter_name: string; submitter_photo: string | null; submitter_department: string | null;
  document_title: string | null; document_id: string | null;
  is_mine: boolean; endorsed: boolean;
  endorsements?: Endorsement[];
  reviewer_name?: string | null; reviewed_at?: string | null;
}
interface Endorsement {
  id: string; comment: string | null; created_at: string;
  full_name: string; profile_photo_url: string | null; department_name: string | null;
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

function TypeBadge({ type }: { type: string }) {
  const t = CLAIM_TYPES.find(c => c.key === type);
  return <span className={`badge text-xs ${t?.color ?? 'badge-stone'}`}>{t?.label ?? type}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status];
  if (!s) return null;
  return <span className={`badge text-xs flex items-center gap-1 ${s.color}`}><s.icon size={9} />{s.label}</span>;
}

/* ── Claim detail modal ─────────────────────────────────────────────────── */
function ClaimDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { user, isStaff } = useAuthStore();
  const qc = useQueryClient();
  const [endorseComment, setEndorseComment] = useState('');
  const [reviewStatus, setReviewStatus] = useState('approved');
  const [reviewNote, setReviewNote] = useState('');
  const [showReview, setShowReview] = useState(false);

  const { data, isLoading, refetch } = useQuery<{ data: Claim }>({
    queryKey: ['claim', id],
    queryFn: () => claimsApi.get(id),
  });
  const claim = data?.data;

  const endorseMut = useMutation({
    mutationFn: () => claimsApi.endorse(id, endorseComment ? { comment: endorseComment } : undefined),
    onSuccess: () => { refetch(); qc.invalidateQueries({ queryKey: ['claims'] }); setEndorseComment(''); },
  });
  const unendorseMut = useMutation({
    mutationFn: () => claimsApi.unendorse(id),
    onSuccess: () => { refetch(); qc.invalidateQueries({ queryKey: ['claims'] }); },
  });
  const reviewMut = useMutation({
    mutationFn: () => claimsApi.review(id, { status: reviewStatus, reviewNote }),
    onSuccess: () => { refetch(); qc.invalidateQueries({ queryKey: ['claims'] }); setShowReview(false); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-stone-100">
          <div className="flex-1 min-w-0">
            {isLoading ? <div className="h-5 w-64 skeleton" /> : (
              <>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {claim && <TypeBadge type={claim.claim_type} />}
                  {claim && <StatusBadge status={claim.status} />}
                </div>
                <h2 className="font-display font-semibold text-stone-900 text-lg leading-tight">{claim?.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Avatar name={claim?.submitter_name ?? ''} url={claim?.submitter_photo} size={5} />
                  <span className="text-xs text-stone-400">{claim?.submitter_name} · {claim?.submitter_department}</span>
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} className="ml-3 p-1 rounded-lg text-stone-400 hover:bg-stone-100 flex-shrink-0"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-8 skeleton" />)}</div>
          ) : claim ? (
            <>
              {/* meta */}
              <div className="flex flex-wrap gap-4 text-xs text-stone-500">
                {claim.organization && <span className="flex items-center gap-1"><Building2 size={11} />{claim.organization}</span>}
                {claim.location     && <span className="flex items-center gap-1"><MapPin size={11} />{claim.location}</span>}
                {claim.implementation_date && (
                  <span className="flex items-center gap-1"><Calendar size={11} />{new Date(claim.implementation_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'long' })}</span>
                )}
                {claim.document_title && (
                  <span className="flex items-center gap-1"><FileText size={11} />Based on: <em>{claim.document_title}</em></span>
                )}
              </div>

              {/* description */}
              <div>
                <h3 className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-2">Description</h3>
                <p className="text-sm text-stone-700 leading-relaxed">{claim.description}</p>
              </div>

              {/* impact */}
              {claim.impact_summary && (
                <div>
                  <h3 className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-2">Impact</h3>
                  <p className="text-sm text-stone-700 leading-relaxed">{claim.impact_summary}</p>
                </div>
              )}

              {/* evidence */}
              {claim.evidence_url && (
                <a href={claim.evidence_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary-700 hover:underline">
                  <ExternalLink size={13} /> View evidence
                </a>
              )}

              {/* review note */}
              {claim.review_note && (
                <div className={`p-3 rounded-xl text-sm ${claim.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
                  <p className="font-medium mb-0.5">Reviewer note</p>
                  <p>{claim.review_note}</p>
                  {claim.reviewer_name && <p className="text-xs opacity-70 mt-1">— {claim.reviewer_name}</p>}
                </div>
              )}

              {/* endorse section */}
              {claim.status === 'approved' && !claim.is_mine && (
                <div>
                  <h3 className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-3">
                    Endorsements ({claim.endorsement_count})
                  </h3>
                  {(claim.endorsements ?? []).map(e => (
                    <div key={e.id} className="flex items-start gap-2 mb-2">
                      <Avatar name={e.full_name} url={e.profile_photo_url} size={6} />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-stone-700">{e.full_name} <span className="text-stone-400 font-normal">· {e.department_name}</span></p>
                        {e.comment && <p className="text-xs text-stone-500 mt-0.5">{e.comment}</p>}
                      </div>
                    </div>
                  ))}

                  {!claim.endorsed ? (
                    <div className="mt-3 space-y-2">
                      <textarea className="input resize-none text-sm py-1.5" rows={2}
                        placeholder="Add a comment with your endorsement… (optional)"
                        value={endorseComment} onChange={e => setEndorseComment(e.target.value)} />
                      <button onClick={() => endorseMut.mutate()} disabled={endorseMut.isPending}
                        className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-40">
                        <ThumbsUp size={13} /> {endorseMut.isPending ? 'Endorsing…' : 'Endorse this claim'}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => unendorseMut.mutate()} disabled={unendorseMut.isPending}
                      className="mt-2 text-xs text-stone-400 hover:text-red-500 transition-colors">
                      Remove my endorsement
                    </button>
                  )}
                </div>
              )}

              {/* admin review panel */}
              {isStaff() && claim.status === 'pending' && (
                <div className="border-t border-stone-100 pt-4">
                  {!showReview ? (
                    <button onClick={() => setShowReview(true)} className="btn-primary text-sm">Review this claim</button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-stone-800">Review decision</p>
                      <div className="flex rounded-lg border border-stone-200 overflow-hidden">
                        {[{ v: 'approved', l: 'Approve' }, { v: 'rejected', l: 'Reject' }, { v: 'revision_needed', l: 'Request revision' }].map((o, i) => (
                          <button key={o.v} type="button" onClick={() => setReviewStatus(o.v)}
                            className={`flex-1 py-2 text-xs transition-colors ${reviewStatus === o.v ? 'bg-primary-600 text-white font-medium' : 'bg-white text-stone-500 hover:bg-stone-50'} ${i > 0 ? 'border-l border-stone-200' : ''}`}>
                            {o.l}
                          </button>
                        ))}
                      </div>
                      <textarea className="input resize-none text-sm py-1.5" rows={2}
                        placeholder="Note to submitter… (optional for approvals)"
                        value={reviewNote} onChange={e => setReviewNote(e.target.value)} />
                      <div className="flex gap-2">
                        <button onClick={() => reviewMut.mutate()} disabled={reviewMut.isPending}
                          className="btn-primary text-sm disabled:opacity-40">
                          {reviewMut.isPending ? 'Submitting…' : 'Submit review'}
                        </button>
                        <button onClick={() => setShowReview(false)} className="btn-secondary text-sm">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── Submit / Edit form modal ────────────────────────────────────────────── */
function ClaimForm({ existing, onClose }: { existing?: Partial<Claim>; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(existing?.title ?? '');
  const [claimType, setClaimType] = useState(existing?.claim_type ?? 'practice');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [organization, setOrganization] = useState(existing?.organization ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [implDate, setImplDate] = useState(existing?.implementation_date?.slice(0, 10) ?? '');
  const [evidenceUrl, setEvidenceUrl] = useState(existing?.evidence_url ?? '');
  const [impactSummary, setImpactSummary] = useState(existing?.impact_summary ?? '');
  const [docSearch, setDocSearch] = useState(existing?.document_title ?? '');
  const [docId, setDocId] = useState(existing?.document_id ?? '');

  const { data: docsData } = useQuery({
    queryKey: ['doc-search', docSearch],
    queryFn: () => documentsApi.list({ search: docSearch, limit: 6 }),
    enabled: docSearch.length >= 2 && !docId,
  });
  const docs = (docsData?.data as any)?.documents ?? [];

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => existing?.id
      ? claimsApi.update(existing.id, { title, description, organization, location, implementationDate: implDate, evidenceUrl, impactSummary })
      : claimsApi.create({ title, claimType, description, documentId: docId || null, organization, location, implementationDate: implDate, evidenceUrl, impactSummary }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['claims'] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <h2 className="font-display font-semibold text-stone-900">{existing ? 'Edit claim' : 'Submit implementation claim'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* title */}
          <div>
            <label className="label">Claim title <span className="text-red-500">*</span></label>
            <input className="input" placeholder="e.g. Research findings used in National Health Policy 2024"
              value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          {/* type */}
          {!existing && (
            <div>
              <label className="label">Implementation type <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                {CLAIM_TYPES.map(t => (
                  <button key={t.key} type="button" onClick={() => setClaimType(t.key)}
                    className={`p-3 rounded-xl border text-left text-sm transition-colors ${claimType === t.key ? 'border-primary-400 bg-primary-50' : 'border-stone-200 hover:border-stone-300'}`}>
                    <p className="font-medium text-stone-800">{t.label}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* description */}
          <div>
            <label className="label">Description <span className="text-red-500">*</span></label>
            <textarea className="input resize-none" rows={4}
              placeholder="Describe how the research was implemented and the context…"
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {/* linked document */}
          {!existing && (
            <div>
              <label className="label">Linked research <span className="text-stone-400 font-normal">(optional)</span></label>
              {docId ? (
                <div className="flex items-center gap-2 p-2.5 bg-stone-50 rounded-xl">
                  <FileText size={13} className="text-stone-400" />
                  <span className="flex-1 text-sm text-stone-700 truncate">{docSearch}</span>
                  <button onClick={() => { setDocId(''); setDocSearch(''); }} className="text-stone-400 hover:text-red-500"><X size={13} /></button>
                </div>
              ) : (
                <>
                  <input className="input" placeholder="Search for your published document…"
                    value={docSearch} onChange={e => setDocSearch(e.target.value)} />
                  {docs.length > 0 && (
                    <div className="mt-1 border border-stone-200 rounded-xl overflow-hidden">
                      {docs.map((d: any) => (
                        <button key={d.id} onClick={() => { setDocId(d.id); setDocSearch(d.title); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-stone-50 border-b border-stone-100 last:border-0">
                          <FileText size={12} className="text-stone-400 flex-shrink-0" />
                          <span className="truncate">{d.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* org + location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Organization</label>
              <input className="input" placeholder="e.g. Federal Ministry of Health"
                value={organization} onChange={e => setOrganization(e.target.value)} />
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" placeholder="e.g. Abuja, Nigeria"
                value={location} onChange={e => setLocation(e.target.value)} />
            </div>
          </div>

          {/* date */}
          <div>
            <label className="label">Implementation date</label>
            <input className="input" type="date" value={implDate} onChange={e => setImplDate(e.target.value)} />
          </div>

          {/* impact */}
          <div>
            <label className="label">Impact summary</label>
            <textarea className="input resize-none" rows={3}
              placeholder="What measurable impact did the implementation have?"
              value={impactSummary} onChange={e => setImpactSummary(e.target.value)} />
          </div>

          {/* evidence */}
          <div>
            <label className="label">Evidence URL</label>
            <input className="input" type="url" placeholder="https://…"
              value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600">{(error as any)?.response?.data?.error?.message ?? 'Something went wrong'}</p>}
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-stone-100">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => mutate()}
            disabled={isPending || title.trim().length < 5 || description.trim().length < 20}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
            {isPending ? 'Submitting…' : existing ? 'Update claim' : 'Submit claim'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Claim card ─────────────────────────────────────────────────────────── */
function ClaimCard({ claim, onClick }: { claim: Claim; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card p-4 text-left w-full hover:shadow-md hover:-translate-y-0.5 transition-all group">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <TypeBadge type={claim.claim_type} />
            {claim.is_mine && <StatusBadge status={claim.status} />}
          </div>
          <p className="font-display font-semibold text-stone-900 text-sm leading-snug line-clamp-2">{claim.title}</p>
          <p className="text-xs text-stone-400 mt-1 truncate">
            {claim.submitter_name}
            {claim.organization && ` · ${claim.organization}`}
            {claim.location && ` · ${claim.location}`}
          </p>
          {claim.document_title && (
            <p className="text-xs text-stone-400 flex items-center gap-1 mt-1">
              <FileText size={10} />{claim.document_title}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <ChevronRight size={14} className="text-stone-300 group-hover:text-primary-500 transition-colors" />
          {claim.endorsement_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-stone-400">
              <ThumbsUp size={10} />{claim.endorsement_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function ClaimsPage() {
  const { isStaff } = useAuthStore();
  const [tab, setTab] = useState<'browse' | 'mine' | 'pending'>('browse');
  const [typeFilter, setTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: browseData, isLoading: browseLoading } = useQuery<{ data: Claim[] }>({
    queryKey: ['claims', 'browse', typeFilter],
    queryFn: () => claimsApi.list({ status: 'approved', type: typeFilter || undefined }),
    enabled: tab === 'browse',
  });

  const { data: mineData, isLoading: mineLoading } = useQuery<{ data: Claim[] }>({
    queryKey: ['claims', 'mine'],
    queryFn: () => claimsApi.list({ mine: 'true' }),
    enabled: tab === 'mine',
  });

  const { data: pendingData, isLoading: pendingLoading } = useQuery<{ data: Claim[] }>({
    queryKey: ['claims', 'pending'],
    queryFn: () => claimsApi.list({ status: 'pending' }),
    enabled: tab === 'pending' && isStaff(),
  });

  const claims = tab === 'browse' ? (browseData?.data ?? [])
               : tab === 'mine'   ? (mineData?.data ?? [])
               : (pendingData?.data ?? []);
  const loading = tab === 'browse' ? browseLoading : tab === 'mine' ? mineLoading : pendingLoading;

  const pendingCount = pendingData?.data?.length ?? 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl font-semibold text-stone-900">Implementation Claims</h2>
          <p className="text-stone-500 text-sm mt-1">Track the real-world impact of research</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Submit claim
        </button>
      </div>

      {/* tabs */}
      <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-6 w-fit">
        {([
          { key: 'browse', label: 'Approved claims' },
          { key: 'mine',   label: 'My claims' },
          ...(isStaff() ? [{ key: 'pending', label: `Pending review${pendingCount > 0 ? ` (${pendingCount})` : ''}` }] : []),
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* type filter (browse tab only) */}
      {tab === 'browse' && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {[{ key: '', label: 'All types' }, ...CLAIM_TYPES].map(t => (
            <button key={t.key} onClick={() => setTypeFilter(t.key)}
              className={`px-3 py-1.5 rounded-xl border text-sm transition-colors ${typeFilter === t.key ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-stone-200 text-stone-500 hover:border-stone-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* list */}
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 skeleton rounded-xl" />)}
        </div>
      ) : claims.length === 0 ? (
        <div className="card p-16 text-center">
          <Award size={36} className="mx-auto mb-3 text-stone-300" />
          <p className="text-stone-500 font-medium">
            {tab === 'browse' ? 'No approved claims yet'
            : tab === 'mine'  ? "You haven't submitted any claims"
            : 'No pending claims to review'}
          </p>
          <p className="text-stone-400 text-sm mt-1">
            {tab === 'mine' ? 'Has your research been implemented somewhere? Submit a claim.' : ''}
          </p>
          {tab === 'mine' && <button onClick={() => setShowForm(true)} className="btn-primary mt-4 text-sm">Submit a claim</button>}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {claims.map(c => <ClaimCard key={c.id} claim={c} onClick={() => setSelectedId(c.id)} />)}
        </div>
      )}

      {showForm    && <ClaimForm onClose={() => setShowForm(false)} />}
      {selectedId  && <ClaimDetail id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
