'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { plagiarismApi } from '@/lib/api';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ShieldCheck, ShieldAlert, RefreshCw, Loader2,
  FileText, BarChart2, AlertTriangle, Copy, Cpu, AlignLeft,
  Globe, ExternalLink, ChevronDown, ChevronUp, Quote,
  Bot, Lock, TrendingUp, Search, Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(score: number | null | undefined) {
  if (score == null) return '—';
  return `${Math.round(score * 100)}%`;
}

function ScoreBadge({ score }: { score: number }) {
  const p = Math.round(score * 100);
  if (p >= 50) return <span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>{p}% — High risk</span>;
  if (p >= 30) return <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>{p}% — Moderate</span>;
  return <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>{p}% — Low / Original</span>;
}

function ScoreBar({ value, label, color }: { value: number; label: string; color: string }) {
  const p = Math.min(100, Math.round(value * 100));
  return (
    <div>
      <div className="flex justify-between text-xs text-stone-500 mb-1">
        <span>{label}</span><span className="font-medium text-stone-700">{p}%</span>
      </div>
      <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
        <div className="h-2 rounded-full transition-all" style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
  );
}

const METHOD_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  exact_hash:      { label: 'Exact hash',       icon: <Copy size={12} />,       color: '#dc2626' },
  semantic_vector: { label: 'Semantic AI',       icon: <Cpu size={12} />,        color: '#6366f1' },
  text_shingle:    { label: 'Text fingerprint',  icon: <AlignLeft size={12} />,  color: '#0ea5e9' },
  external_source: { label: 'External sources',  icon: <Globe size={12} />,      color: '#f97316' },
};

const SOURCE_LABELS: Record<string, string> = {
  crossref:         'CrossRef',
  semantic_scholar: 'Semantic Scholar',
};

const AI_LABEL_META: Record<string, { label: string; color: string; bg: string }> = {
  human: { label: 'Human written',  color: '#166534', bg: '#dcfce7' },
  mixed: { label: 'Likely mixed',   color: '#92400e', bg: '#fef3c7' },
  ai:    { label: 'AI generated',   color: '#991b1b', bg: '#fee2e2' },
};

const PLAN_ORDER = ['free', 'basic', 'standard', 'premium', 'enterprise'];
const PLAN_UPGRADE_LABEL: Record<string, string> = {
  free:     'Upgrade to Basic',
  basic:    'Upgrade to Standard',
  standard: 'Upgrade to Premium',
  premium:  'Upgrade to Enterprise',
};

// ── Locked feature placeholder ────────────────────────────────────────────────
function LockedFeature({ title, description, requiredPlan }: {
  title: string; description: string; requiredPlan: string;
}) {
  return (
    <div className="card p-5 border-dashed border-2 border-stone-200">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
          <Lock size={14} className="text-stone-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-stone-700">{title}</p>
          <p className="text-xs text-stone-400 mt-0.5">{description}</p>
          <Link href="/admin/billing"
            className="inline-flex items-center gap-1 mt-2 text-xs text-primary-600 hover:text-primary-800 font-medium">
            <TrendingUp size={11} />
            {PLAN_UPGRADE_LABEL[requiredPlan] ?? 'Upgrade plan'} to unlock
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Quota badge ───────────────────────────────────────────────────────────────
function QuotaBadge({ quota }: { quota: any }) {
  if (!quota) return null;
  const pctUsed = quota.total > 0 ? quota.used / quota.total : 0;
  const color   = pctUsed >= 0.9 ? 'text-red-600' : pctUsed >= 0.7 ? 'text-amber-600' : 'text-stone-500';
  return (
    <div className={`flex items-center gap-1.5 text-xs ${color}`}>
      <Layers size={12} />
      <span className="capitalize font-medium">{quota.plan}</span>
      <span>·</span>
      <span>{quota.remaining} checks remaining this month</span>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ExternalMatchRow({ m }: { m: any }) {
  const source  = SOURCE_LABELS[m.source] ?? m.source;
  const simPct  = m.score != null ? Math.round(m.score * 100) : null;
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-stone-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800 line-clamp-2">{m.title}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
          {m.year    && <span className="text-xs text-stone-400">{m.year}</span>}
          {m.journal && <span className="text-xs text-stone-400 truncate max-w-[200px]">{m.journal}</span>}
          <span className="text-xs text-stone-400 font-medium">{source}</span>
          {m.doi     && <span className="text-xs text-stone-400 font-mono">DOI: {m.doi}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {simPct != null && (
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
            simPct >= 70 ? 'bg-red-50 text-red-700'
            : simPct >= 40 ? 'bg-amber-50 text-amber-700'
            : 'bg-stone-50 text-stone-600'
          }`}>{simPct}% title match</span>
        )}
        {m.url && (
          <a href={m.url} target="_blank" rel="noopener noreferrer"
            className="text-stone-400 hover:text-primary-600 transition-colors">
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  );
}

function WebMatchRow({ m }: { m: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-stone-100 rounded-lg overflow-hidden mb-2">
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-stone-50 transition-colors">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-800 truncate">{m.title}</p>
          <p className="text-xs text-stone-400 truncate">{m.url}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <a href={m.url} target="_blank" rel="noopener noreferrer"
            className="text-stone-400 hover:text-primary-600" onClick={e => e.stopPropagation()}>
            <ExternalLink size={12} />
          </a>
          {expanded ? <ChevronUp size={13} className="text-stone-400" /> : <ChevronDown size={13} className="text-stone-400" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3 border-t border-stone-100 pt-2.5 space-y-2">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-1">Matched sentence</p>
            <p className="text-xs text-stone-700 bg-red-50 border border-red-100 rounded p-2 leading-relaxed">{m.sentence}</p>
          </div>
          {m.snippet && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-1">Web snippet</p>
              <p className="text-xs text-stone-600 italic">{m.snippet}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SentencePairRow({ pair }: { pair: any }) {
  const [expanded, setExpanded] = useState(false);
  const score = pair.score ?? 0;
  const color = score >= 0.7 ? 'text-red-600 bg-red-50'
              : score >= 0.4 ? 'text-amber-600 bg-amber-50'
              : 'text-stone-600 bg-stone-50';
  return (
    <div className="border border-stone-100 rounded-lg overflow-hidden mb-2">
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-stone-50 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <Quote size={12} className="text-stone-300 shrink-0" />
          <span className="text-sm text-stone-700 truncate">{pair.source}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${color}`}>
            {Math.round(score * 100)}%
          </span>
          {expanded ? <ChevronUp size={13} className="text-stone-400" /> : <ChevronDown size={13} className="text-stone-400" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-stone-100 pt-2.5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-1">Your text</p>
            <p className="text-xs text-stone-700 bg-red-50 border border-red-100 rounded p-2 leading-relaxed">{pair.source}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-1">Matched text</p>
            <p className="text-xs text-stone-600 bg-amber-50 border border-amber-100 rounded p-2 leading-relaxed">{pair.target}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CopyleaksSection({ report, features }: { report: any; features: any }) {
  if (!features?.deep_check) {
    return (
      <LockedFeature
        title="Deep web + paraphrase detection"
        description="Checks 60B+ web pages, detects paraphrasing, and includes AI writing detection via Copyleaks."
        requiredPlan="premium"
      />
    );
  }

  const status = report?.copyleaks_status ?? 'not_submitted';

  if (status === 'not_submitted') return null;

  if (status === 'submitted') {
    return (
      <div className="card p-5 flex items-center gap-3 text-sm text-stone-600">
        <Loader2 size={15} className="animate-spin text-stone-400 shrink-0" />
        <div>
          <p className="font-medium">Deep check in progress</p>
          <p className="text-xs text-stone-400 mt-0.5">Copyleaks is scanning 60B+ web pages. Results appear automatically when ready.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="card p-4 flex items-center gap-2 text-sm text-amber-600">
        <AlertTriangle size={14} className="shrink-0" />
        Deep check failed — will retry on next re-check.
      </div>
    );
  }

  if (status === 'completed') {
    const matches: any[] = report?.copyleaks_matches ?? [];
    const score = report?.copyleaks_score;
    return (
      <div className="card p-5">
        <h2 className="font-display font-semibold text-stone-900 mb-1 flex items-center gap-2">
          <Layers size={15} className="text-stone-400" /> Deep check results (Copyleaks)
        </h2>
        <div className="flex items-center gap-3 mb-4">
          {score != null && (
            <span className={`text-sm font-bold ${
              score >= 0.5 ? 'text-red-600' : score >= 0.3 ? 'text-amber-600' : 'text-green-700'
            }`}>{Math.round(score * 100)}% matched</span>
          )}
          {report?.copyleaks_report_url && (
            <a href={report.copyleaks_report_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
              <ExternalLink size={11} /> Full Copyleaks report
            </a>
          )}
        </div>
        {matches.length > 0 ? (
          <div className="space-y-1.5">
            {matches.slice(0, 10).map((m: any, i: number) => (
              <div key={i} className="flex items-start justify-between gap-3 py-2 border-b border-stone-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-800 truncate">{m.title || m.url}</p>
                  <p className="text-xs text-stone-400 font-medium capitalize">{m.type}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {m.score != null && (
                    <span className={`text-xs font-semibold ${
                      m.score >= 0.5 ? 'text-red-600' : m.score >= 0.3 ? 'text-amber-600' : 'text-stone-500'
                    }`}>{Math.round(m.score * 100)}%</span>
                  )}
                  {m.url && (
                    <a href={m.url} target="_blank" rel="noopener noreferrer"
                      className="text-stone-400 hover:text-primary-600">
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone-400">No matches found in Copyleaks database.</p>
        )}
      </div>
    );
  }

  return null;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PlagiarismReportPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['plagiarism-report', id],
    queryFn:  () => plagiarismApi.report(id),
    enabled:  !!id,
    refetchInterval: (query) => {
      const d = (query.state.data as any)?.data;
      const s = d?.plagiarism_status;
      const cl = d?.report?.copyleaks_status;
      // Keep polling while core check running OR Copyleaks still processing
      return (s === 'pending' || s === 'checking' || cl === 'submitted') ? 4000 : false;
    },
  });

  const checkMutation = useMutation({
    mutationFn: () => plagiarismApi.check(id),
    onSuccess:  () => { toast.success('Check complete'); refetch(); },
    onError:    (err: any) => {
      const msg = err?.response?.data?.error?.message ?? 'Check failed';
      toast.error(msg);
    },
  });

  const result   = (data as any)?.data;
  const report   = result?.report;
  const quota    = result?.quota;
  const features = result?.features;
  const status: string = result?.plagiarism_status ?? 'unchecked';

  const STATUS_ICONS: Record<string, React.ReactNode> = {
    clear:     <ShieldCheck size={18} className="text-green-600" />,
    flagged:   <ShieldAlert size={18} className="text-red-600" />,
    duplicate: <Copy size={18} className="text-red-700" />,
    checking:  <Loader2 size={18} className="animate-spin text-stone-400" />,
    pending:   <Loader2 size={18} className="animate-spin text-stone-400" />,
    error:     <AlertTriangle size={18} className="text-amber-500" />,
    unchecked: <ShieldCheck size={18} className="text-stone-300" />,
  };

  const externalMatches: any[] = report?.external_matches ?? [];
  const sentenceMatches: any[] = report?.sentence_matches  ?? [];
  const webMatches: any[]      = report?.web_matches       ?? [];
  const aiLabel                = report?.ai_label ? AI_LABEL_META[report.ai_label] : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link href={`/repository/${id}`}
        className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 transition-colors">
        <ArrowLeft size={14} /> Back to document
      </Link>

      {/* Header + quota */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-xl font-semibold text-stone-900 mb-1">Similarity Report</h1>
            {result?.document_title && (
              <p className="text-sm text-stone-500 line-clamp-2">{result.document_title}</p>
            )}
          </div>
          <button
            onClick={() => checkMutation.mutate()}
            disabled={checkMutation.isPending || status === 'pending' || status === 'checking'}
            className="btn-secondary shrink-0"
          >
            {checkMutation.isPending || status === 'pending' || status === 'checking'
              ? <><Loader2 size={14} className="animate-spin" />Checking…</>
              : <><RefreshCw size={14} />{report ? 'Re-check' : 'Run check'}</>
            }
          </button>
        </div>

        {quota && (
          <div className="mt-3 pt-3 border-t border-stone-100">
            <QuotaBadge quota={quota} />
            {quota.remaining === 0 && (
              <Link href="/admin/billing"
                className="inline-flex items-center gap-1 mt-1.5 text-xs text-primary-600 hover:underline font-medium">
                <TrendingUp size={11} /> Upgrade for more checks
              </Link>
            )}
          </div>
        )}

        {(status === 'pending' || status === 'checking') && (
          <div className="mt-4 rounded-lg bg-stone-50 border border-stone-200 p-3 text-sm text-stone-600 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin shrink-0" />
            Plagiarism check in progress — this page updates automatically.
          </div>
        )}
      </div>

      {report ? (
        <>
          {/* Duplicate alert */}
          {report.is_duplicate && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <Copy size={18} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Exact duplicate detected</p>
                <p className="text-xs text-red-600 mt-0.5">
                  This document is identical to an existing submission.
                  {report.top_match && (
                    <> Matches:{' '}
                      <Link href={`/repository/${report.top_match.document_id}`}
                        className="underline hover:text-red-800">{report.top_match.title}</Link>.
                    </>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* AI detection banner */}
          {report.ai_checked && aiLabel && (
            <div className="rounded-lg border p-4 flex items-start gap-3"
              style={{ borderColor: aiLabel.color + '44', background: aiLabel.bg }}>
              <Bot size={18} className="shrink-0 mt-0.5" style={{ color: aiLabel.color }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: aiLabel.color }}>
                  {aiLabel.label} — {pct(report.ai_score)} AI probability
                </p>
                <p className="text-xs mt-0.5" style={{ color: aiLabel.color + 'cc' }}>
                  {report.ai_label === 'ai'
                    ? 'This document was likely generated by an AI writing tool.'
                    : report.ai_label === 'mixed'
                    ? 'This document contains a mix of human and AI-generated content.'
                    : 'This document appears to be human written.'}
                </p>
              </div>
            </div>
          )}

          {/* Score overview */}
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-3">
              {STATUS_ICONS[status]}
              <div>
                <div className="text-sm text-stone-500 mb-0.5">Overall similarity score</div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-3xl font-bold text-stone-900">
                    {pct(report.overall_score)}
                  </span>
                  <ScoreBadge score={report.overall_score} />
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-stone-100">
              <ScoreBar label="Combined score" value={report.overall_score}
                color={report.overall_score >= 0.5 ? '#ef4444' : report.overall_score >= 0.3 ? '#f59e0b' : '#22c55e'} />
              {report.semantic_score != null && (
                <ScoreBar label="Semantic similarity (AI)" value={report.semantic_score} color="#6366f1" />
              )}
              {report.text_score != null && (
                <ScoreBar label="Text fingerprint (shingle)" value={report.text_score} color="#0ea5e9" />
              )}
              {report.ai_checked && report.ai_score != null && (
                <ScoreBar label="AI authorship probability" value={report.ai_score} color="#f97316" />
              )}
              {report.copyleaks_score != null && (
                <ScoreBar label="Deep check (Copyleaks)" value={report.copyleaks_score} color="#8b5cf6" />
              )}
            </div>

            {/* Detection method chips */}
            {Array.isArray(report.methods_used) && report.methods_used.length > 0 && (
              <div className="pt-2 border-t border-stone-100">
                <p className="text-xs text-stone-400 mb-2">Detection methods</p>
                <div className="flex flex-wrap gap-2">
                  {(report.methods_used as string[]).map(m => {
                    const meta = METHOD_META[m];
                    return (
                      <span key={m} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border"
                        style={meta
                          ? { borderColor: meta.color + '55', background: meta.color + '11', color: meta.color }
                          : { borderColor: '#d6d3d1', color: '#78716c' }}>
                        {meta?.icon}{meta?.label ?? m}
                      </span>
                    );
                  })}
                  {report.ai_checked && (
                    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border"
                      style={{ borderColor: '#f9741655', background: '#f9741611', color: '#f97316' }}>
                      <Bot size={12} /> AI detection
                    </span>
                  )}
                  {report.web_checked && (
                    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border"
                      style={{ borderColor: '#10b98155', background: '#10b98111', color: '#059669' }}>
                      <Search size={12} /> Web search
                    </span>
                  )}
                  {report.copyleaks_status === 'completed' && (
                    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border"
                      style={{ borderColor: '#8b5cf655', background: '#8b5cf611', color: '#8b5cf6' }}>
                      <Layers size={12} /> Deep check
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="text-xs text-stone-400">
              Checked {report.checked_at ? new Date(report.checked_at).toLocaleString() : '—'} ·
              Flag threshold: {Math.round((result?.threshold ?? 0.3) * 100)}%
            </div>
          </div>

          {/* AI detection — locked for lower plans */}
          {!report.ai_checked && features && !features.ai_detection && (
            <LockedFeature
              title="AI-generated text detection"
              description="Detects content written by ChatGPT, Claude, and other AI tools using GPTZero."
              requiredPlan="standard"
            />
          )}

          {/* Closest internal match */}
          {report.top_match && (
            <div className="card p-5">
              <h2 className="font-display font-semibold text-stone-900 mb-3 flex items-center gap-2">
                <BarChart2 size={15} className="text-stone-400" /> Closest internal match
              </h2>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-stone-800">{report.top_match.title}</p>
                  <Link href={`/repository/${report.top_match.document_id}`}
                    className="text-xs text-primary-600 hover:underline mt-0.5 inline-block">
                    View document →
                  </Link>
                </div>
                <span className="badge badge-stone shrink-0">{pct(report.overall_score)} similarity</span>
              </div>
            </div>
          )}

          {/* Internal match details table */}
          {Array.isArray(report.match_details) && report.match_details.length > 0 && (
            <div className="card p-5">
              <h2 className="font-display font-semibold text-stone-900 mb-4 flex items-center gap-2">
                <FileText size={15} className="text-stone-400" /> Similar documents in repository
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-stone-100">
                      <th className="pb-2 font-medium text-stone-500 pr-4">Title</th>
                      <th className="pb-2 font-medium text-stone-500 text-right pr-4">Text</th>
                      <th className="pb-2 font-medium text-stone-500 text-right pr-4">Semantic</th>
                      <th className="pb-2 font-medium text-stone-500 text-right">Combined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.match_details as any[]).map((m: any) => (
                      <tr key={m.document_id} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                        <td className="py-2 pr-4">
                          <Link href={`/repository/${m.document_id}`}
                            className="text-primary-700 hover:underline line-clamp-1">{m.title}</Link>
                        </td>
                        <td className="py-2 pr-4 text-right text-stone-600">{pct(m.text_score)}</td>
                        <td className="py-2 pr-4 text-right text-stone-600">
                          {m.semantic_score != null ? pct(m.semantic_score) : '—'}
                        </td>
                        <td className={`py-2 text-right font-semibold ${
                          m.combined_score >= 0.5 ? 'text-red-600'
                          : m.combined_score >= 0.3 ? 'text-amber-600'
                          : 'text-green-700'
                        }`}>{pct(m.combined_score)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Matching passages (sentence-level) */}
          {sentenceMatches.length > 0 && (
            <div className="card p-5">
              <h2 className="font-display font-semibold text-stone-900 mb-1 flex items-center gap-2">
                <Quote size={15} className="text-stone-400" /> Matching passages
              </h2>
              <p className="text-xs text-stone-400 mb-4">
                Sentences in your document that closely match text in the repository. Click to expand.
              </p>
              {sentenceMatches.map((pair: any, i: number) => (
                <SentencePairRow key={i} pair={pair} />
              ))}
            </div>
          )}

          {/* External academic sources */}
          {externalMatches.length > 0 && (
            <div className="card p-5">
              <h2 className="font-display font-semibold text-stone-900 mb-1 flex items-center gap-2">
                <Globe size={15} className="text-stone-400" /> External source matches
              </h2>
              <p className="text-xs text-stone-400 mb-4">
                Papers with similar titles found in CrossRef and Semantic Scholar.
              </p>
              {externalMatches.map((m: any, i: number) => (
                <ExternalMatchRow key={i} m={m} />
              ))}
            </div>
          )}
          {report.external_source_checked && externalMatches.length === 0 && (
            <div className="card p-4 flex items-center gap-2 text-sm text-stone-500">
              <Globe size={14} className="text-stone-300" />
              No matching papers found in CrossRef or Semantic Scholar.
            </div>
          )}

          {/* Web search results */}
          {webMatches.length > 0 ? (
            <div className="card p-5">
              <h2 className="font-display font-semibold text-stone-900 mb-1 flex items-center gap-2">
                <Search size={15} className="text-stone-400" /> Web matches
              </h2>
              <p className="text-xs text-stone-400 mb-4">
                Sentences from this document found verbatim on the open web.
              </p>
              {webMatches.map((m: any, i: number) => <WebMatchRow key={i} m={m} />)}
            </div>
          ) : (
            report.web_checked && (
              <div className="card p-4 flex items-center gap-2 text-sm text-stone-500">
                <Search size={14} className="text-stone-300" />
                No verbatim matches found on the web.
              </div>
            )
          )}
          {features && !features.web_search && !report.web_checked && (
            <LockedFeature
              title="Web search"
              description="Checks whether sentences from this document appear verbatim on the open web using Bing."
              requiredPlan="standard"
            />
          )}

          {/* Deep check (Copyleaks) */}
          <CopyleaksSection report={report} features={features} />
        </>
      ) : (
        !checkMutation.isPending && status !== 'pending' && (
          <div className="card p-10 text-center text-stone-400">
            <ShieldCheck size={40} className="mx-auto mb-3 text-stone-200" />
            <p className="text-sm">No check has been run yet.</p>
            <p className="text-xs mt-1">Click <strong>Run check</strong> above to analyse this document.</p>
          </div>
        )
      )}
    </div>
  );
}
