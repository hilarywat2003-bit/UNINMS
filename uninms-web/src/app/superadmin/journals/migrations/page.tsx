'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Globe, CheckCircle2, XCircle, Loader2, Search, Download,
  Clock, AlertTriangle, ArrowUpRight, ChevronRight, X,
  BookOpen, Rss, RefreshCw, Ban, FileText,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const STATUS_META: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  pending:    { label: 'Pending',     cls: 'badge-stone',  icon: Clock },
  probing:    { label: 'Probing…',    cls: 'badge-blue',   icon: Search },
  probe_done: { label: 'Ready',       cls: 'badge-green',  icon: CheckCircle2 },
  importing:  { label: 'Importing…',  cls: 'badge-blue',   icon: Download },
  imported:   { label: 'Imported',    cls: 'badge-green',  icon: CheckCircle2 },
  failed:     { label: 'Failed',      cls: 'badge-red',    icon: AlertTriangle },
  rejected:   { label: 'Rejected',    cls: 'badge-red',    icon: XCircle },
};

function ArticleDrawer({ requestId, title, onClose }: { requestId: string; title: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['migration-articles', requestId],
    queryFn:  () => api.get(`/journal-migration/${requestId}/articles?limit=100`).then(r => r.data),
  });
  const articles = data?.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div>
            <h3 className="font-display font-semibold text-stone-900">Imported articles</h3>
            <p className="text-xs text-stone-500 truncate max-w-xs">{title}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100 text-stone-400">
            <X size={16} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
          </div>
        ) : articles.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <FileText size={40} className="text-stone-300 mb-3" />
            <p className="text-stone-500 text-sm">No articles imported yet.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
            <div className="px-6 py-3 bg-stone-50 border-b border-stone-100">
              <p className="text-xs text-stone-500">{data?.total ?? articles.length} article{articles.length !== 1 ? 's' : ''} imported</p>
            </div>
            {articles.map((a: any) => (
              <div key={a.id} className="px-6 py-4">
                <p className="text-sm font-medium text-stone-900 leading-snug mb-1">{a.title}</p>
                {a.author_names && (
                  <p className="text-xs text-stone-500 mb-1">{a.author_names}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-stone-400">
                  {a.published_at && (
                    <span>{new Date(a.published_at).getFullYear()}</span>
                  )}
                  {a.doi && (
                    <a href={a.doi.startsWith('http') ? a.doi : `https://doi.org/${a.doi}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-primary-600 hover:underline flex items-center gap-0.5">
                      DOI <ArrowUpRight size={10} />
                    </a>
                  )}
                  {a.source_url && (
                    <a href={a.source_url} target="_blank" rel="noopener noreferrer"
                      className="text-primary-600 hover:underline flex items-center gap-0.5">
                      Source <ArrowUpRight size={10} />
                    </a>
                  )}
                </div>
                {a.subjects?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {a.subjects.slice(0, 4).map((s: string) => (
                      <span key={s} className="badge badge-stone text-xs">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RejectModal({ request, onClose }: { request: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const reject = useMutation({
    mutationFn: () => api.post(`/journal-migration/${request.id}/reject`, { note }).then(r => r.data),
    onSuccess: () => { toast.success('Request rejected'); qc.invalidateQueries({ queryKey: ['migration-requests'] }); onClose(); },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-card-md">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <h3 className="font-display font-semibold text-stone-900">Reject migration request</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100 text-stone-400"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-stone-600">Rejecting: <strong>{request.journal_title}</strong></p>
          <div>
            <label className="label">Reason (optional)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              placeholder="Explain why this request cannot be processed…"
              className="input resize-none" />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => reject.mutate()} disabled={reject.isPending}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {reject.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban size={14} />}
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JournalMigrationsPage() {
  const qc = useQueryClient();
  const [filter, setFilter]     = useState<string>('all');
  const [drawerReq, setDrawer]  = useState<any>(null);
  const [rejectReq, setReject]  = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['migration-requests'],
    queryFn:  () => api.get('/journal-migration').then(r => r.data.data),
    refetchInterval: 15000,
  });

  const probe = useMutation({
    mutationFn: (id: string) => api.post(`/journal-migration/${id}/probe`).then(r => r.data),
    onSuccess: (_, id) => {
      toast.success('Probe complete');
      qc.invalidateQueries({ queryKey: ['migration-requests'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Probe failed'),
  });

  const importArticles = useMutation({
    mutationFn: (id: string) => api.post(`/journal-migration/${id}/import`).then(r => r.data),
    onSuccess: () => { toast.success('Import started'); qc.invalidateQueries({ queryKey: ['migration-requests'] }); },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Import failed'),
  });

  const all: any[] = data ?? [];
  const counts = {
    all:        all.length,
    pending:    all.filter(r => r.status === 'pending').length,
    probe_done: all.filter(r => r.status === 'probe_done').length,
    importing:  all.filter(r => ['importing','probing'].includes(r.status)).length,
    imported:   all.filter(r => r.status === 'imported').length,
  };
  const filtered = filter === 'all' ? all : all.filter(r => r.status === filter);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-semibold text-stone-900">Journal migrations</h1>
          <p className="text-stone-500 text-sm mt-0.5">Review and process external journal migration requests</p>
        </div>
        {counts.probe_done > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 border border-primary-200 rounded-xl">
            <CheckCircle2 size={13} className="text-primary-700" />
            <span className="text-sm font-medium text-primary-800">
              {counts.probe_done} ready to import
            </span>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total requests', value: counts.all,        icon: Globe,        cls: 'text-stone-600 bg-stone-100' },
          { label: 'Pending review', value: counts.pending,    icon: Clock,        cls: 'text-gold-700 bg-gold-50' },
          { label: 'Ready to import', value: counts.probe_done, icon: Rss,          cls: 'text-primary-700 bg-primary-50' },
          { label: 'Imported',       value: counts.imported,   icon: CheckCircle2, cls: 'text-primary-700 bg-primary-50' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wide">{s.label}</p>
                <p className="text-2xl font-display font-semibold text-stone-900 mt-1">{s.value}</p>
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.cls}`}>
                <s.icon size={16} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          { key: 'all',        label: `All (${counts.all})` },
          { key: 'pending',    label: `Pending (${counts.pending})` },
          { key: 'probe_done', label: `Ready (${counts.probe_done})` },
          { key: 'importing',  label: 'In progress' },
          { key: 'imported',   label: `Done (${counts.imported})` },
          { key: 'failed',     label: 'Failed' },
        ].map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={clsx('px-4 py-2 rounded-xl text-sm font-medium transition-all',
              filter === t.key ? 'bg-primary-800 text-white' : 'text-stone-600 hover:bg-stone-100')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <Globe size={40} className="mx-auto mb-3 text-stone-300" />
          <h3 className="font-display font-semibold text-stone-700 mb-1">No requests</h3>
          <p className="text-stone-400 text-sm">
            {filter === 'all' ? 'No migration requests submitted yet.' : `No requests with status "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((r: any) => {
            const sm = STATUS_META[r.status] ?? STATUS_META.pending;
            const Icon = sm.icon;
            const probe_res = r.probe_result || {};
            const canProbe  = ['pending', 'failed'].includes(r.status);
            const canImport = r.status === 'probe_done' && r.oai_pmh_url;
            const isActive  = ['probing', 'importing'].includes(r.status);

            return (
              <div key={r.id} className={clsx('card p-5', r.status === 'probe_done' && 'border-l-4 border-l-primary-500')}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                      <BookOpen size={18} className="text-primary-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-stone-900 truncate">{r.journal_title}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className={`badge text-xs flex items-center gap-1 ${sm.cls}`}>
                          {isActive
                            ? <Loader2 size={10} className="animate-spin" />
                            : <Icon size={10} />}
                          {sm.label}
                        </span>
                        {r.platform && r.platform !== 'unknown' && (
                          <span className="badge badge-stone text-xs">{r.platform}</span>
                        )}
                        {r.university_name && (
                          <span className="text-xs text-stone-400">{r.university_name}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    {r.status === 'imported' && (
                      <button onClick={() => setDrawer(r)} className="btn-secondary btn-sm">
                        <FileText size={13} /> Articles
                      </button>
                    )}
                    {canProbe && (
                      <button onClick={() => probe.mutate(r.id)}
                        disabled={probe.isPending && probe.variables === r.id}
                        className="btn-primary btn-sm">
                        {probe.isPending && probe.variables === r.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Search size={13} />}
                        Probe URL
                      </button>
                    )}
                    {canImport && (
                      <button onClick={() => importArticles.mutate(r.id)}
                        disabled={importArticles.isPending && importArticles.variables === r.id}
                        className="btn-primary btn-sm">
                        {importArticles.isPending && importArticles.variables === r.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Download size={13} />}
                        Import
                      </button>
                    )}
                    {['pending', 'probe_done', 'failed'].includes(r.status) && (
                      <button onClick={() => setReject(r)} className="btn-ghost btn-sm text-red-600">
                        <Ban size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* URL row */}
                <div className="mt-3 flex items-center gap-4 text-xs text-stone-400 pl-15">
                  <a href={r.existing_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary-600 hover:underline truncate max-w-[240px]">
                    <Globe size={11} /> {r.existing_url}
                  </a>
                  {r.oai_pmh_url && (
                    <span className="flex items-center gap-1 text-primary-600">
                      <Rss size={11} /> OAI-PMH detected
                    </span>
                  )}
                </div>

                {/* Probe result */}
                {probe_res.success && (
                  <div className="mt-3 ml-15 p-3 bg-primary-50 rounded-xl border border-primary-100">
                    <p className="text-xs font-semibold text-primary-700 mb-2 flex items-center gap-1.5">
                      <Rss size={11} /> OAI-PMH endpoint found
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      {probe_res.repository_name && (
                        <div><span className="text-stone-400">Repository</span><p className="font-medium text-stone-800 truncate">{probe_res.repository_name}</p></div>
                      )}
                      <div><span className="text-stone-400">Articles found</span><p className="font-semibold text-primary-700">{r.article_count_found?.toLocaleString() || 0}</p></div>
                      {probe_res.earliest_datestamp && (
                        <div><span className="text-stone-400">Earliest record</span><p className="font-medium text-stone-800">{probe_res.earliest_datestamp}</p></div>
                      )}
                      {probe_res.admin_email && (
                        <div className="col-span-2"><span className="text-stone-400">Admin email</span><p className="font-medium text-stone-800">{probe_res.admin_email}</p></div>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 mt-2 font-mono break-all">{r.oai_pmh_url}</p>
                  </div>
                )}

                {probe_res.success === false && probe_res.message && (
                  <div className="mt-3 ml-15 p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
                      <AlertTriangle size={11} /> {probe_res.message}
                    </p>
                    <p className="text-xs text-amber-600 mt-1">Manual migration coordination will be needed. Contact the submitter directly.</p>
                  </div>
                )}

                {r.status === 'failed' && r.error_message && (
                  <div className="mt-3 ml-15 p-3 bg-red-50 rounded-xl border border-red-200">
                    <p className="text-xs text-red-600">{r.error_message}</p>
                  </div>
                )}

                {/* Import progress */}
                {(r.status === 'importing' || r.status === 'imported') && (
                  <div className="mt-3 ml-15 flex items-center gap-3">
                    <div className="flex-1 bg-stone-100 rounded-full h-1.5">
                      <div className="bg-primary-600 h-1.5 rounded-full transition-all"
                        style={{ width: r.article_count_found > 0
                          ? `${Math.min(100, (r.article_count_imported / r.article_count_found) * 100)}%`
                          : (r.status === 'imported' ? '100%' : '10%') }} />
                    </div>
                    <span className="text-xs text-stone-500 flex-shrink-0">
                      {r.article_count_imported?.toLocaleString() || 0}
                      {r.article_count_found > 0 ? ` / ${r.article_count_found.toLocaleString()}` : ''} articles
                    </span>
                  </div>
                )}

                {/* Footer */}
                <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-400">
                  <div className="flex items-center gap-3">
                    <span>Submitted {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                    {r.submitted_by_name && <span>by {r.submitted_by_name}</span>}
                    {r.contact_email && (
                      <a href={`mailto:${r.contact_email}`} className="text-primary-600 hover:underline">
                        {r.contact_email}
                      </a>
                    )}
                  </div>
                  {r.issn_online && <span className="font-mono">ISSN {r.issn_online}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {drawerReq && <ArticleDrawer requestId={drawerReq.id} title={drawerReq.journal_title} onClose={() => setDrawer(null)} />}
      {rejectReq  && <RejectModal request={rejectReq} onClose={() => setReject(null)} />}
    </div>
  );
}
