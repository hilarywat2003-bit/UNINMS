'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tetfundApi, platformApi } from '@/lib/api';
import {
  Award, RefreshCw, Download, TrendingUp,
  Search, Loader2, AlertCircle, ChevronRight,
  BookOpen, Quote, Users, Handshake, Activity, BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ── helpers ────────────────────────────────────────────────────────────── */
function scoreColor(score: number) {
  if (score >= 80) return { text: 'text-green-700',  ring: 'bg-green-100', bar: 'bg-green-500' };
  if (score >= 60) return { text: 'text-primary-700',ring: 'bg-primary-50', bar: 'bg-primary-500' };
  if (score >= 40) return { text: 'text-amber-700',  ring: 'bg-amber-50',  bar: 'bg-amber-500' };
  return             { text: 'text-red-700',    ring: 'bg-red-50',    bar: 'bg-red-500' };
}

const METRIC_ICONS: Record<string, React.ElementType> = {
  research_publications:  BookOpen,
  citation_impact:        Quote,
  postgraduate_output:    Award,
  research_collaboration: Users,
  industry_engagement:    Handshake,
  platform_utilisation:   Activity,
};

/* ── University picker ──────────────────────────────────────────────────── */
function UniPicker({ selected, onSelect }: { selected: any | null; onSelect: (u: any) => void }) {
  const [search, setSearch] = useState('');

  const { data } = useQuery({
    queryKey: ['platform-universities', search],
    queryFn:  () => platformApi.universities({ search: search || undefined, limit: 20 }),
  });
  const unis: any[] = (data as any)?.data?.universities ?? [];

  return (
    <div className="card p-5">
      <h3 className="font-display font-semibold text-stone-900 mb-3 text-sm">Select university</h3>
      <div className="relative mb-3">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input className="input pl-8 text-sm" placeholder="Search universities…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="space-y-1 max-h-60 overflow-y-auto">
        {unis.map(u => (
          <button key={u.id} onClick={() => onSelect(u)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between
              ${selected?.id === u.id ? 'bg-primary-600 text-white' : 'hover:bg-stone-50 text-stone-700'}`}>
            <span className="truncate font-medium">{u.name}</span>
            <ChevronRight size={12} className="shrink-0 opacity-50" />
          </button>
        ))}
        {unis.length === 0 && (
          <p className="text-xs text-stone-400 text-center py-4">No universities found</p>
        )}
      </div>
    </div>
  );
}

/* ── Report view ────────────────────────────────────────────────────────── */
function ReportView({ universityId, universityName }: { universityId: string; universityName: string }) {
  const qc = useQueryClient();
  const [period, setPeriod] = useState('');
  const currentYear = new Date().getFullYear();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tetfund-report-uni', universityId, period],
    queryFn:  () => tetfundApi.report({ universityId, ...(period ? { period } : {}) }),
  });

  const generateMut = useMutation({
    mutationFn: () => tetfundApi.generate({ universityId, ...(period ? { period } : {}) }),
    onSuccess: (res: any) => {
      toast.success(`Snapshot saved — score: ${res.data?.performance_score?.toFixed(1)}`);
      qc.invalidateQueries({ queryKey: ['tetfund-report-uni', universityId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const report = (data as any)?.data;
  const metrics = report?.metrics ? Object.entries(report.metrics) : [];

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={period} onChange={e => setPeriod(e.target.value)}
          className="input text-sm py-2 max-w-[180px]">
          <option value="">Current period</option>
          {[`${currentYear}-Annual`,`${currentYear}-Q4`,`${currentYear}-Q3`,`${currentYear}-Q2`,`${currentYear}-Q1`,`${currentYear-1}-Annual`]
            .map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={() => refetch()} className="btn-secondary flex items-center gap-1.5 text-sm">
          <RefreshCw size={12} /> Refresh
        </button>
        <button onClick={() => generateMut.mutate()} disabled={generateMut.isPending}
          className="btn-primary flex items-center gap-1.5 text-sm">
          {generateMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <TrendingUp size={12} />}
          Save snapshot
        </button>
        <div className="flex gap-2 ml-auto">
          <a href={tetfundApi.exportUrl('csv', { universityId })} target="_blank" rel="noopener noreferrer"
            className="btn-secondary text-sm flex items-center gap-1.5">
            <Download size={12} /> CSV
          </a>
          <a href={tetfundApi.exportUrl('json', { universityId })} target="_blank" rel="noopener noreferrer"
            className="btn-secondary text-sm flex items-center gap-1.5">
            <Download size={12} /> JSON
          </a>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 skeleton rounded-xl" />)}</div>
      ) : report ? (
        <>
          {/* Score + multiplier */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className={`card p-5 text-center ${scoreColor(report.performance_score).ring}`}>
              <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Performance score</p>
              <p className={`text-5xl font-display font-bold ${scoreColor(report.performance_score).text}`}>
                {report.performance_score.toFixed(1)}
              </p>
              <p className="text-xs text-stone-400 mt-1">{report.period_label} · {report.source}</p>
            </div>
            <div className="card p-5">
              <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-3">Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-500">Allocation multiplier</span>
                  <span className="font-bold text-stone-800">{Number(report.allocation_multiplier).toFixed(1)}×</span>
                </div>
                {report.population && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Students</span>
                      <span className="font-medium">{Number(report.population.students).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Staff</span>
                      <span className="font-medium">{Number(report.population.staff).toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Metric rows */}
          <div className="card divide-y divide-stone-100">
            {metrics.map(([key, m]: [string, any]) => {
              const Icon = METRIC_ICONS[key] ?? BarChart3;
              const c = scoreColor(m.score);
              const w = Math.min(100, Math.max(0, m.score));
              return (
                <div key={key} className="flex items-center gap-4 px-5 py-3">
                  <Icon size={14} className="text-stone-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-xs font-medium text-stone-700 truncate">{m.label}</p>
                      <span className={`text-xs font-bold ml-2 shrink-0 ${c.text}`}>{m.score.toFixed(1)}</span>
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${w}%` }} />
                    </div>
                    <p className="text-[10px] text-stone-400 mt-0.5">
                      {Number(m.raw_value).toLocaleString()} {m.unit.split('(')[0].trim()} · weight {m.weight * 100}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="card p-10 text-center">
          <AlertCircle size={28} className="mx-auto mb-2 text-stone-300" />
          <p className="text-stone-400 text-sm">No report for this university/period.</p>
        </div>
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function SuperAdminTetfundPage() {
  const [selectedUni, setSelectedUni] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl p-6 mb-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#09432c 0%,#0d6b44 100%)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 50%,#d4a017,transparent 60%)' }} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <Award size={18} className="text-primary-300" />
            <span className="text-primary-300 text-sm">Platform · TETFund</span>
          </div>
          <h2 className="font-display text-2xl font-semibold text-white mb-1">
            Cross-University Performance Reports
          </h2>
          <p className="text-white/60 text-sm">
            View and generate TETFund performance snapshots for any registered institution.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1">
          <UniPicker selected={selectedUni} onSelect={setSelectedUni} />
        </div>

        <div className="lg:col-span-2">
          {selectedUni ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-display font-semibold text-stone-900">{selectedUni.name}</h3>
              </div>
              <ReportView universityId={selectedUni.id} universityName={selectedUni.name} />
            </>
          ) : (
            <div className="card p-16 text-center">
              <Award size={36} className="mx-auto mb-3 text-stone-300" />
              <p className="text-stone-500 font-medium">Select a university</p>
              <p className="text-stone-400 text-sm mt-1">
                Choose an institution from the left to view its TETFund performance report.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
