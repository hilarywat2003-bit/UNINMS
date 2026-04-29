'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { intelligenceApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  Brain, AlertTriangle, Trophy, Users, Lightbulb, Plus, Loader2,
  RefreshCw, Search, Check, X,
  BookOpen, Quote, Star,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'gaps' | 'researchers' | 'graph' | 'recommendations';
type LeaderPeriod = 'monthly' | 'quarterly' | 'annual';
type GapStatus = 'unaddressed' | 'being_researched' | 'solved' | 'dismissed';
type RecStatus = 'accepted' | 'rejected' | 'implemented' | 'dismissed';

// ── Small shared components ────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap
        ${active ? 'bg-primary-800 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
      {children}
    </button>
  );
}

function SectionHeader({ icon: Icon, title, action }: { icon: React.ElementType; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-primary-700" />
        <h3 className="font-display font-semibold text-stone-900">{title}</h3>
      </div>
      {action}
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <div className="card p-10 text-center text-stone-400 text-sm">{message}</div>;
}

function Skeleton({ rows = 4 }: { rows?: number }) {
  return <div className="space-y-3">{[...Array(rows)].map((_, i) => <div key={i} className="h-12 skeleton rounded-xl" />)}</div>;
}

// ── GAP STATUS helpers ─────────────────────────────────────────────────────────

const GAP_STATUS_COLORS: Record<string, string> = {
  unaddressed:     'text-red-700 bg-red-50 border-red-200',
  being_researched:'text-blue-700 bg-blue-50 border-blue-200',
  solved:          'text-green-700 bg-green-50 border-green-200',
  dismissed:       'text-stone-500 bg-stone-50 border-stone-200',
};

const PRIORITY_COLORS = (p: number) =>
  p >= 8 ? 'text-red-600 bg-red-50 border-red-200'
  : p >= 5 ? 'text-gold-700 bg-gold-50 border-gold-200'
  : 'text-blue-700 bg-blue-50 border-blue-200';

// ── REC STATUS helpers ─────────────────────────────────────────────────────────

const REC_STATUS_COLORS: Record<string, string> = {
  pending_review: 'text-gold-700 bg-gold-50',
  accepted:       'text-green-700 bg-green-50',
  rejected:       'text-red-700 bg-red-50',
  implemented:    'text-primary-700 bg-primary-50',
  dismissed:      'text-stone-500 bg-stone-50',
};

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Overview  (leaderboard + collaborators)
// ══════════════════════════════════════════════════════════════════════════════

function OverviewTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<LeaderPeriod>('quarterly');

  const { data: leaderData, isLoading: leaderLoading } = useQuery({
    queryKey: ['intelligence', 'leaderboard', period],
    queryFn:  () => intelligenceApi.leaderboard(period),
  });
  const { data: collabData, isLoading: collabLoading } = useQuery({
    queryKey: ['intelligence', 'collaborators'],
    queryFn:  () => intelligenceApi.collaborators(8),
  });

  const computeMutation = useMutation({
    mutationFn: () => intelligenceApi.computeLeaderboard(period),
    onSuccess: (res: any) => {
      toast.success(`Computed ${res.data?.computed ?? 0} rankings`);
      qc.invalidateQueries({ queryKey: ['intelligence', 'leaderboard', period] });
    },
    onError: () => toast.error('Compute failed'),
  });

  const leaderboard   = (leaderData?.data as any[]) ?? [];
  const collaborators = (collabData?.data as any[]) ?? [];

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Leaderboard */}
      <div className="card p-5">
        <SectionHeader icon={Trophy} title="University rankings"
          action={
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-stone-200 overflow-hidden text-xs">
                {(['monthly','quarterly','annual'] as LeaderPeriod[]).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-2.5 py-1 capitalize transition-colors ${period === p ? 'bg-primary-800 text-white' : 'text-stone-500 hover:bg-stone-50'}`}>
                    {p === 'quarterly' ? 'Qtr' : p === 'monthly' ? 'Mo' : 'Yr'}
                  </button>
                ))}
              </div>
              {isAdmin && (
                <button onClick={() => computeMutation.mutate()} disabled={computeMutation.isPending}
                  title="Recompute rankings"
                  className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-primary-700 transition-colors">
                  {computeMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                </button>
              )}
            </div>
          }
        />
        {leaderLoading ? <Skeleton rows={5} /> : leaderboard.length === 0 ? (
          <Empty message="No rankings yet. Click ↻ to compute." />
        ) : (
          <div className="space-y-1">
            {leaderboard.slice(0, 10).map((entry: any, i: number) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
              return (
                <div key={entry.university_id}
                  className={`flex items-center gap-3 py-2.5 px-3 rounded-xl ${i < 3 ? 'bg-gold-50/60' : 'hover:bg-stone-50'} transition-colors`}>
                  <div className="w-7 text-center shrink-0">
                    {medal ? <span className="text-lg">{medal}</span>
                      : <span className="text-xs font-bold text-stone-400">#{entry.rank_position ?? i+1}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-900 text-sm truncate">{entry.university_name}</p>
                    <p className="text-xs text-stone-500">
                      {Number(entry.total_citations).toLocaleString()} citations ·{' '}
                      {Number(entry.doc_count).toLocaleString()} docs
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Suggested collaborators */}
      <div className="lg:col-span-2 card p-5">
        <SectionHeader icon={Users} title="Suggested collaborators" />
        {collabLoading ? <Skeleton rows={4} /> : collaborators.length === 0 ? (
          <Empty message="Upload documents with tags to discover collaborators." />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {collaborators.map((c: any) => (
              <Link href={`/users/${c.id}/profile`} key={c.id}
                className="flex items-center gap-3 p-4 rounded-xl border border-stone-100 hover:border-primary-200 hover:bg-primary-50/30 transition-all group">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                  <span className="text-primary-700 font-semibold text-sm">
                    {c.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-900 text-sm truncate group-hover:text-primary-800">{c.full_name}</p>
                  <p className="text-xs text-stone-500 truncate">{c.university_name ?? c.department_name}</p>
                  {c.shared_tag_count != null && (
                    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-100">
                      {c.shared_tag_count} shared topics
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Research Gaps
// ══════════════════════════════════════════════════════════════════════════════

function GapsTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['intelligence', 'gaps', statusFilter],
    queryFn:  () => intelligenceApi.gaps(statusFilter ? { status: statusFilter, limit: 50 } : { limit: 50 }),
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<{
    description: string; researchArea: string; priorityScore: number;
  }>();

  const submitMutation = useMutation({
    mutationFn: (d: any) => intelligenceApi.submitGap({ description: d.description, researchArea: d.researchArea, priorityScore: d.priorityScore }),
    onSuccess: () => {
      toast.success('Gap submitted'); qc.invalidateQueries({ queryKey: ['intelligence', 'gaps'] });
      setShowForm(false); reset();
    },
    onError: () => toast.error('Submission failed'),
  });

  const detectMutation = useMutation({
    mutationFn: () => intelligenceApi.detectGaps(),
    onSuccess: (res: any) => {
      toast.success(`Detected ${res.data?.gapsDetected ?? 0} new gaps`);
      qc.invalidateQueries({ queryKey: ['intelligence', 'gaps'] });
    },
    onError: () => toast.error('Detection failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => intelligenceApi.updateGap(id, status),
    onSuccess: () => {
      toast.success('Gap updated'); setUpdatingId(null);
      qc.invalidateQueries({ queryKey: ['intelligence', 'gaps'] });
    },
    onError: () => toast.error('Update failed'),
  });

  const gaps = (data?.data as any)?.gaps ?? [];

  const STATUS_FILTERS = [
    { value: '',                label: 'All' },
    { value: 'unaddressed',     label: 'Unaddressed' },
    { value: 'being_researched',label: 'In progress' },
    { value: 'solved',          label: 'Solved' },
    { value: 'dismissed',       label: 'Dismissed' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors
                ${statusFilter === f.value
                  ? 'bg-primary-800 text-white border-primary-800'
                  : 'border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          {isAdmin && (
            <button onClick={() => detectMutation.mutate()} disabled={detectMutation.isPending}
              className="btn-secondary btn-sm">
              {detectMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Auto-detect
            </button>
          )}
          <button onClick={() => setShowForm(!showForm)} className="btn-primary btn-sm">
            <Plus size={13} /> Submit gap
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(d => submitMutation.mutate(d))} className="card p-5 space-y-4">
          <h4 className="font-display font-semibold text-stone-900">Submit a research gap</h4>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Research area</label>
              <input {...register('researchArea')} placeholder="e.g. IoT in Nigerian agriculture" className="input" />
            </div>
            <div>
              <label className="label">Priority (1–10)</label>
              <input {...register('priorityScore')} type="number" min={1} max={10} defaultValue={5} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Description <span className="text-stone-400">(min 20 chars)</span></label>
            <textarea {...register('description', { required: true, minLength: 20 })} rows={3}
              placeholder="Describe the gap in existing research…" className="input resize-none" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowForm(false); reset(); }} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">Submit gap</button>
          </div>
        </form>
      )}

      {isLoading ? <Skeleton rows={6} /> : gaps.length === 0 ? (
        <Empty message="No gaps match this filter." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {gaps.map((gap: any) => (
            <div key={gap.id} className="card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold ${PRIORITY_COLORS(gap.priority_score)}`}>
                  {gap.priority_score}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {gap.research_area && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                        {gap.research_area}
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${GAP_STATUS_COLORS[gap.status] ?? 'text-stone-500 bg-stone-50 border-stone-200'}`}>
                      {gap.status?.replace('_', ' ')}
                    </span>
                    {gap.auto_detected && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                        auto-detected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-stone-700 leading-relaxed line-clamp-3">{gap.gap_description}</p>
                </div>
              </div>

              {isAdmin && gap.status !== 'solved' && gap.status !== 'dismissed' && (
                <div className="flex gap-1.5 pt-2 border-t border-stone-100">
                  {(['being_researched','solved','dismissed'] as GapStatus[])
                    .filter(s => s !== gap.status)
                    .map(s => (
                      <button key={s}
                        onClick={() => { setUpdatingId(gap.id); updateMutation.mutate({ id: gap.id, status: s }); }}
                        disabled={updateMutation.isPending && updatingId === gap.id}
                        className="text-[10px] px-2.5 py-1 rounded-full border border-stone-200 text-stone-500 hover:border-primary-300 hover:text-primary-700 transition-colors capitalize">
                        → {s.replace('_', ' ')}
                      </button>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Top Researchers
// ══════════════════════════════════════════════════════════════════════════════

function ResearchersTab() {
  const [tagName, setTagName] = useState('');
  const [tagInput, setTagInput] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['intelligence', 'top-researchers', tagName],
    queryFn:  () => intelligenceApi.topResearchers({ limit: 20, ...(tagName ? { tagName } : {}) }),
  });

  const researchers = (data?.data as any[]) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={tagInput} onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setTagName(tagInput.trim()); } }}
            placeholder="Filter by topic / tag…" className="input pl-8 text-sm" />
        </div>
        <button onClick={() => setTagName(tagInput.trim())} className="btn-secondary btn-sm">
          <Search size={13} /> Search
        </button>
        {tagName && (
          <button onClick={() => { setTagName(''); setTagInput(''); }} className="btn-ghost btn-sm text-stone-500">
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {isLoading ? <Skeleton rows={6} /> : researchers.length === 0 ? (
        <Empty message="No researchers found." />
      ) : (
        <div className="space-y-3">
          {researchers.map((r: any) => (
            <Link href={`/users/${r.id}/profile`} key={r.id}
              className="card flex items-center gap-4 p-4 hover:border-primary-200 hover:bg-primary-50/20 transition-all group">
              <div className="w-9 text-center shrink-0">
                <span className={`text-sm font-bold ${r.rank <= 3 ? 'text-gold-600' : 'text-stone-400'}`}>
                  #{r.rank}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                <span className="text-primary-700 font-semibold text-sm">
                  {r.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-900 text-sm group-hover:text-primary-800 truncate">{r.full_name}</p>
                <p className="text-xs text-stone-500 truncate">{r.department_name} · {r.university_name}</p>
              </div>
              <div className="hidden sm:flex items-center gap-5 text-xs text-stone-500 shrink-0">
                <span className="flex items-center gap-1.5">
                  <BookOpen size={12} className="text-stone-400" />
                  {Number(r.doc_count).toLocaleString()} docs
                </span>
                <span className="flex items-center gap-1.5">
                  <Quote size={12} className="text-stone-400" />
                  {Number(r.total_citations).toLocaleString()} citations
                </span>
                {r.avg_rating > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Star size={12} className="text-gold-500" />
                    {r.avg_rating.toFixed(1)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Knowledge Graph
// ══════════════════════════════════════════════════════════════════════════════

function GraphTab() {
  const [researchArea, setResearchArea] = useState('');
  const [areaInput, setAreaInput]     = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['intelligence', 'graph', researchArea],
    queryFn:  () => intelligenceApi.graph(researchArea ? { researchArea, limit: 80 } : { limit: 80 }),
  });

  const graph   = (data?.data as any) ?? {};
  const nodes   = (graph.nodes ?? []) as any[];
  const edges   = (graph.edges ?? []) as any[];
  const stats   = graph.stats ?? {};

  const universities = nodes.filter((n: any) => n.type === 'university').slice(0, 12);
  const tags         = nodes.filter((n: any) => n.type === 'tag').slice(0, 16);

  // Top connections: edges sorted by weight
  const topEdges = [...edges]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10)
    .map((e: any) => ({
      ...e,
      universityLabel: nodes.find((n: any) => n.id === e.source)?.label ?? '—',
      tagLabel:        nodes.find((n: any) => n.id === e.target)?.label ?? '—',
    }));

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={areaInput} onChange={e => setAreaInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setResearchArea(areaInput.trim()); }}
            placeholder="Filter by research area…" className="input pl-8 text-sm" />
        </div>
        <button onClick={() => setResearchArea(areaInput.trim())} className="btn-secondary btn-sm">
          <Search size={13} /> Filter
        </button>
        {researchArea && (
          <button onClick={() => { setResearchArea(''); setAreaInput(''); }} className="btn-ghost btn-sm text-stone-500">
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {isLoading ? <Skeleton rows={4} /> : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Universities', value: stats.universities ?? 0 },
              { label: 'Research topics', value: stats.tags ?? 0 },
              { label: 'Connections', value: stats.edges ?? 0 },
            ].map(s => (
              <div key={s.label} className="card p-4 text-center">
                <p className="text-2xl font-display font-bold text-stone-900">{Number(s.value).toLocaleString()}</p>
                <p className="text-xs text-stone-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Top topics */}
            <div className="card p-5">
              <h4 className="font-display font-semibold text-stone-900 mb-3 text-sm">Top research topics</h4>
              <div className="flex flex-wrap gap-2">
                {tags.map((t: any) => (
                  <span key={t.id}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-primary-50 text-primary-800 border border-primary-100">
                    {t.label}
                    <span className="text-primary-400">{t.docCount}</span>
                  </span>
                ))}
                {tags.length === 0 && <p className="text-sm text-stone-400">No topics found.</p>}
              </div>
            </div>

            {/* Top connections */}
            <div className="card p-5">
              <h4 className="font-display font-semibold text-stone-900 mb-3 text-sm">Strongest university–topic links</h4>
              {topEdges.length === 0 ? (
                <p className="text-sm text-stone-400">No connections yet.</p>
              ) : (
                <div className="space-y-2">
                  {topEdges.map((e: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-stone-400 text-xs w-4 shrink-0">#{i + 1}</span>
                      <span className="text-stone-700 truncate flex-1">{e.universityLabel}</span>
                      <span className="text-stone-300 mx-1">→</span>
                      <span className="text-primary-700 font-medium truncate">{e.tagLabel}</span>
                      <span className="text-xs text-stone-400 shrink-0">{e.weight}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* University nodes */}
          {universities.length > 0 && (
            <div className="card p-5">
              <h4 className="font-display font-semibold text-stone-900 mb-3 text-sm">Universities in the graph</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-stone-100 text-xs text-stone-500">
                      <th className="pb-2 pr-4 font-medium">University</th>
                      <th className="pb-2 pr-4 font-medium">State</th>
                      <th className="pb-2 pr-4 font-medium text-right">Docs</th>
                      <th className="pb-2 font-medium text-right">Researchers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {universities.map((u: any) => (
                      <tr key={u.id} className="border-b border-stone-50 hover:bg-stone-50">
                        <td className="py-2 pr-4 font-medium text-stone-800 truncate max-w-[200px]">{u.label}</td>
                        <td className="py-2 pr-4 text-stone-500">{u.state ?? '—'}</td>
                        <td className="py-2 pr-4 text-right text-stone-600">{Number(u.docCount).toLocaleString()}</td>
                        <td className="py-2 text-right text-stone-600">{Number(u.researcherCount).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: Recommendations (admin only)
// ══════════════════════════════════════════════════════════════════════════════

function RecommendationsTab() {
  const qc = useQueryClient();
  const [uniId, setUniId] = useState('');
  const [genUniId, setGenUniId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['intelligence', 'recommendations', statusFilter],
    queryFn:  () => intelligenceApi.recommendations(statusFilter ? { status: statusFilter } : {}),
  });

  const generateMutation = useMutation({
    mutationFn: () => intelligenceApi.generateRecommendations(genUniId),
    onSuccess: (res: any) => {
      toast.success(`Generated ${res.data?.generated ?? 0} recommendations`);
      qc.invalidateQueries({ queryKey: ['intelligence', 'recommendations'] });
      setGenUniId('');
    },
    onError: () => toast.error('Generation failed — check university ID'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      intelligenceApi.updateRecommendation(id, status),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['intelligence', 'recommendations'] });
    },
    onError: () => toast.error('Update failed'),
  });

  const recs = (data?.data as any[]) ?? [];

  const STATUS_OPTS = [
    { value: '',              label: 'All' },
    { value: 'pending_review',label: 'Pending' },
    { value: 'accepted',      label: 'Accepted' },
    { value: 'implemented',   label: 'Implemented' },
    { value: 'rejected',      label: 'Rejected' },
    { value: 'dismissed',     label: 'Dismissed' },
  ];

  const ACTION_STATUSES: RecStatus[] = ['accepted', 'implemented', 'rejected', 'dismissed'];

  return (
    <div className="space-y-5">
      {/* Generate panel */}
      <div className="card p-5">
        <h4 className="font-display font-semibold text-stone-900 mb-3">Generate recommendations</h4>
        <div className="flex gap-3">
          <input value={genUniId} onChange={e => setGenUniId(e.target.value)}
            placeholder="University UUID…" className="input flex-1 text-sm font-mono" />
          <button onClick={() => generateMutation.mutate()} disabled={!genUniId || generateMutation.isPending}
            className="btn-primary shrink-0">
            {generateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Generate
          </button>
        </div>
        <p className="text-xs text-stone-400 mt-2">Runs 4 rules: citation rate, research gaps, upload activity, mentorship pairs.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_OPTS.map(f => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors
              ${statusFilter === f.value
                ? 'bg-primary-800 text-white border-primary-800'
                : 'border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? <Skeleton rows={4} /> : recs.length === 0 ? (
        <Empty message="No recommendations found. Generate some above." />
      ) : (
        <div className="space-y-4">
          {recs.map((rec: any) => (
            <div key={rec.id} className="card p-5 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="badge badge-stone capitalize">{rec.category}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${REC_STATUS_COLORS[rec.status] ?? 'bg-stone-50 text-stone-500'}`}>
                    {rec.status?.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-stone-400">
                    {Math.round((rec.confidence_score ?? 0) * 100)}% confidence
                  </span>
                </div>
                {/* Status action buttons */}
                <div className="flex gap-1.5">
                  {ACTION_STATUSES
                    .filter(s => s !== rec.status)
                    .map(s => (
                      <button key={s} onClick={() => updateMutation.mutate({ id: rec.id, status: s })}
                        disabled={updateMutation.isPending}
                        className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors capitalize
                          ${s === 'accepted'    ? 'border-green-200 text-green-700 hover:bg-green-50'
                          : s === 'implemented' ? 'border-primary-200 text-primary-700 hover:bg-primary-50'
                          : s === 'rejected'    ? 'border-red-200 text-red-700 hover:bg-red-50'
                          : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}>
                        {s === 'accepted' ? <Check size={9} className="inline mr-0.5" /> : null}
                        {s === 'rejected' ? <X size={9} className="inline mr-0.5" /> : null}
                        {s.replace('_', ' ')}
                      </button>
                    ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-stone-900 text-sm mb-1">{rec.title}</h4>
                <p className="text-sm text-stone-600 leading-relaxed">{rec.description}</p>
              </div>

              {rec.action_required && (
                <div className="bg-primary-50 rounded-xl p-3 border border-primary-100">
                  <p className="text-xs font-semibold text-primary-800 mb-0.5">Recommended action</p>
                  <p className="text-xs text-primary-700">{rec.action_required}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main page
// ══════════════════════════════════════════════════════════════════════════════

export default function IntelligencePage() {
  const { isAdmin } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const tabs: { id: Tab; label: string; adminOnly?: boolean }[] = [
    { id: 'overview',        label: 'Overview' },
    { id: 'gaps',            label: 'Research gaps' },
    { id: 'researchers',     label: 'Top researchers' },
    { id: 'graph',           label: 'Knowledge graph' },
    { id: 'recommendations', label: 'Recommendations', adminOnly: true },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Hero */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#09432c 0%,#0d6b44 100%)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 50%,#d4a017,transparent 60%)' }} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Brain size={20} className="text-primary-300" />
            <span className="text-primary-300 text-sm">AI Intelligence Layer</span>
          </div>
          <h2 className="font-display text-2xl font-semibold mb-1">National research insights</h2>
          <p className="text-white/60 text-sm">
            Semantic analysis across the national knowledge graph — gaps, collaborators, rankings, and strategic intelligence.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap p-1 bg-stone-100 rounded-xl w-fit">
        {tabs
          .filter(t => !t.adminOnly || isAdmin())
          .map(t => (
            <TabBtn key={t.id} active={activeTab === t.id} onClick={() => setActiveTab(t.id)}>
              {t.label}
            </TabBtn>
          ))}
      </div>

      {/* Tab panels */}
      {activeTab === 'overview'        && <OverviewTab isAdmin={isAdmin()} />}
      {activeTab === 'gaps'            && <GapsTab isAdmin={isAdmin()} />}
      {activeTab === 'researchers'     && <ResearchersTab />}
      {activeTab === 'graph'           && <GraphTab />}
      {activeTab === 'recommendations' && isAdmin() && <RecommendationsTab />}
    </div>
  );
}
