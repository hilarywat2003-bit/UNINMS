'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tetfundApi } from '@/lib/api';
import {
  Award, RefreshCw, Download, TrendingUp, Users,
  BookOpen, Quote, Handshake, BarChart3, Activity, Loader2,
  ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ── helpers ────────────────────────────────────────────────────────────── */
function scoreColor(score: number) {
  if (score >= 80) return { text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  ring: 'ring-green-500' };
  if (score >= 60) return { text: 'text-primary-700',bg: 'bg-primary-50',border: 'border-primary-200',ring: 'ring-primary-500' };
  if (score >= 40) return { text: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  ring: 'ring-amber-500' };
  return             { text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    ring: 'ring-red-500' };
}

function MultiplierBadge({ value }: { value: number }) {
  const v = Number(value);
  const cls = v >= 1.3 ? 'bg-green-100 text-green-800 border-green-200'
            : v >= 1.0 ? 'bg-primary-50 text-primary-800 border-primary-200'
            : 'bg-red-50 text-red-700 border-red-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-semibold border ${cls}`}>
      {v.toFixed(1)}× allocation
    </span>
  );
}

function MetricBar({ label, score, rawValue, unit, benchmark, weight, weightedScore, icon: Icon }: any) {
  const w = Math.min(100, Math.max(0, score));
  const clr = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-primary-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
            <Icon size={14} className="text-stone-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-800">{label}</p>
            <p className="text-xs text-stone-400">{weight * 100}% weight · {weightedScore} pts</p>
          </div>
        </div>
        <span className={`text-lg font-bold font-display ${score >= 80 ? 'text-green-700' : score >= 60 ? 'text-primary-700' : score >= 40 ? 'text-amber-700' : 'text-red-700'}`}>
          {score.toFixed(1)}
        </span>
      </div>

      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${clr}`} style={{ width: `${w}%` }} />
      </div>

      <div className="flex justify-between text-xs text-stone-400">
        <span><span className="font-medium text-stone-600">{Number(rawValue).toLocaleString()}</span> {unit}</span>
        <span>Benchmark: {benchmark}</span>
      </div>
    </div>
  );
}

const METRIC_ICONS: Record<string, React.ElementType> = {
  research_publications:  BookOpen,
  citation_impact:        Quote,
  postgraduate_output:    Award,
  research_collaboration: Users,
  industry_engagement:    Handshake,
  platform_utilisation:   Activity,
};

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function TETFundPage() {
  const qc = useQueryClient();
  const [period, setPeriod]         = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [generating, setGenerating]   = useState(false);

  const currentYear = new Date().getFullYear();
  const PERIODS = [
    `${currentYear}-Annual`,
    `${currentYear}-Q4`, `${currentYear}-Q3`,
    `${currentYear}-Q2`, `${currentYear}-Q1`,
    `${currentYear - 1}-Annual`,
  ];

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tetfund-report', period],
    queryFn:  () => tetfundApi.report(period ? { period } : {}),
  });

  const { data: histData, isLoading: histLoading } = useQuery({
    queryKey: ['tetfund-history'],
    queryFn:  () => tetfundApi.history(),
    enabled:  showHistory,
  });

  const generateMut = useMutation({
    mutationFn: () => tetfundApi.generate(period ? { period } : {}),
    onSuccess: (res: any) => {
      toast.success(`Report saved — score: ${res.data?.performance_score?.toFixed(1)}`);
      qc.invalidateQueries({ queryKey: ['tetfund-report'] });
      qc.invalidateQueries({ queryKey: ['tetfund-history'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Generation failed'),
  });

  const report = (data as any)?.data;
  const history = (histData as any)?.data;
  const sc = report ? scoreColor(report.performance_score) : null;
  const metrics = report?.metrics ? Object.entries(report.metrics) : [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Hero header */}
      <div className="rounded-2xl p-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#09432c 0%,#0d6b44 100%)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 50%,#d4a017,transparent 60%)' }} />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Award size={18} className="text-primary-300" />
              <span className="text-primary-300 text-sm">TETFund Performance Reporting</span>
            </div>
            <h2 className="font-display text-2xl font-semibold text-white mb-1">Institutional Performance Score</h2>
            <p className="text-white/60 text-sm">
              Composite metric aligned with Tertiary Education Trust Fund reporting requirements.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a href={tetfundApi.exportUrl('csv')} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors">
              <Download size={13} /> CSV
            </a>
            <a href={tetfundApi.exportUrl('json')} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors">
              <Download size={13} /> JSON
            </a>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={period} onChange={e => setPeriod(e.target.value)}
          className="input text-sm py-2 max-w-[200px]">
          <option value="">Current period</option>
          {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={() => refetch()} className="btn-secondary flex items-center gap-1.5">
          <RefreshCw size={13} /> Refresh
        </button>
        <button onClick={() => generateMut.mutate()} disabled={generateMut.isPending}
          className="btn-primary flex items-center gap-1.5">
          {generateMut.isPending
            ? <><Loader2 size={13} className="animate-spin" /> Generating…</>
            : <><TrendingUp size={13} /> Save snapshot</>}
        </button>
        {report?.source === 'live' && (
          <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            <Clock size={10} /> Live (unsaved)
          </span>
        )}
        {report?.source === 'snapshot' && (
          <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
            <CheckCircle2 size={10} /> Saved snapshot
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 skeleton rounded-2xl" />)}
        </div>
      ) : report ? (
        <>
          {/* Score + multiplier + population */}
          <div className="grid sm:grid-cols-3 gap-4">
            {/* Score */}
            <div className={`card p-6 text-center ${sc!.bg} ${sc!.border} sm:col-span-1`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Performance score</p>
              <p className={`text-6xl font-display font-bold ${sc!.text}`}>
                {report.performance_score.toFixed(1)}
              </p>
              <p className="text-xs text-stone-400 mt-1">out of 100</p>
            </div>

            {/* Multiplier */}
            <div className="card p-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Allocation multiplier</p>
              <MultiplierBadge value={report.allocation_multiplier} />
              <div className="mt-4 grid grid-cols-4 gap-1">
                {[
                  { band: '≥90', mult: '1.5×' }, { band: '≥80', mult: '1.3×' },
                  { band: '≥70', mult: '1.2×' }, { band: '≥60', mult: '1.1×' },
                  { band: '≥50', mult: '1.0×' }, { band: '≥40', mult: '0.9×' },
                  { band: '<40',  mult: '0.8×' },
                ].map(b => {
                  const thresholds: Record<string, number> = { '≥90': 90, '≥80': 80, '≥70': 70, '≥60': 60, '≥50': 50, '≥40': 40, '<40': -1 };
                  const t = thresholds[b.band];
                  const active = t >= 0 ? report.performance_score >= t && (b.band === '≥90' || report.performance_score < (Object.values(thresholds).sort((a,b)=>b-a).find(v => v > t) ?? Infinity)) : report.performance_score < 40;
                  return (
                    <div key={b.band} className={`col-span-2 text-center p-1 rounded text-[10px] ${active ? 'bg-primary-600 text-white font-bold' : 'bg-stone-50 text-stone-400'}`}>
                      {b.band} → {b.mult}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Population */}
            {report.population && (
              <div className="card p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Institution</p>
                {report.university_name && (
                  <p className="font-semibold text-stone-800 text-sm mb-3 truncate">{report.university_name}</p>
                )}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Students</span>
                    <span className="font-medium text-stone-800">{Number(report.population.students).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Staff</span>
                    <span className="font-medium text-stone-800">{Number(report.population.staff).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-stone-100">
                    <span className="text-stone-500">Period</span>
                    <span className="font-medium text-stone-700">{report.period_label}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 6 Metric cards */}
          <div>
            <h3 className="font-display font-semibold text-stone-900 mb-3">Metric breakdown</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {metrics.map(([key, m]: [string, any]) => (
                <MetricBar
                  key={key}
                  label={m.label}
                  score={m.score}
                  rawValue={m.raw_value}
                  unit={m.unit}
                  benchmark={m.benchmark}
                  weight={m.weight}
                  weightedScore={m.weighted_score}
                  icon={METRIC_ICONS[key] ?? BarChart3}
                />
              ))}
            </div>
          </div>

          {/* Metric weights legend */}
          <div className="card p-4">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Metric weights</p>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'Research Publications',    pct: 30 },
                { key: 'Citation Impact',          pct: 20 },
                { key: 'Postgraduate Output',      pct: 20 },
                { key: 'Research Collaboration',   pct: 15 },
                { key: 'Industry Engagement',      pct: 10 },
                { key: 'Platform Utilisation',     pct: 5  },
              ].map(w => (
                <div key={w.key} className="flex items-center gap-1.5 text-xs text-stone-600 bg-stone-50 px-2.5 py-1 rounded-full border border-stone-200">
                  <span className="font-semibold text-stone-800">{w.pct}%</span> {w.key}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="card p-16 text-center">
          <AlertCircle size={36} className="mx-auto mb-3 text-stone-300" />
          <p className="text-stone-500 font-medium">No report data available</p>
          <p className="text-stone-400 text-sm mt-1">Click "Save snapshot" to generate the first report.</p>
        </div>
      )}

      {/* Historical trend */}
      <div className="card overflow-hidden">
        <button onClick={() => setShowHistory(v => !v)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-stone-50 transition-colors">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-stone-500" />
            <span className="font-display font-semibold text-stone-900">Historical snapshots</span>
            {history?.history?.length > 0 && (
              <span className="badge badge-stone text-xs">{history.history.length}</span>
            )}
          </div>
          {showHistory ? <ChevronUp size={15} className="text-stone-400" /> : <ChevronDown size={15} className="text-stone-400" />}
        </button>

        {showHistory && (
          <div className="border-t border-stone-100">
            {histLoading ? (
              <div className="p-5 space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-10 skeleton" />)}
              </div>
            ) : (history?.history ?? []).length === 0 ? (
              <p className="p-5 text-sm text-stone-400 text-center">No snapshots saved yet. Click "Save snapshot" to record the current report.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 bg-stone-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Period</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Score</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Multiplier</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide hidden sm:table-cell">Generated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {(history.history as any[]).map((h: any) => {
                      const c = scoreColor(h.performance_score);
                      return (
                        <tr key={h.period_label} className="hover:bg-stone-50 transition-colors">
                          <td className="px-5 py-3 font-medium text-stone-800">{h.period_label}</td>
                          <td className="px-5 py-3 text-right">
                            <span className={`font-bold ${c.text}`}>{h.performance_score.toFixed(1)}</span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="text-stone-600">{Number(h.allocation_multiplier).toFixed(1)}×</span>
                          </td>
                          <td className="px-5 py-3 text-right text-stone-400 hidden sm:table-cell text-xs">
                            {new Date(h.generated_at).toLocaleDateString('en-NG')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
