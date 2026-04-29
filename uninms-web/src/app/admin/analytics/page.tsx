'use client';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import {
  BookOpen, Eye, Download, Award, Users, TrendingUp,
  FileText, ArrowUpRight, BarChart3,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminAnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn:  () => adminApi.analytics(),
  });

  const d = (data as any)?.data;

  const totalUsers    = d?.users?.reduce((s: number, r: any) => s + parseInt(r.count), 0) ?? 0;
  const totalDocs     = d?.documents?.reduce((s: number, r: any) => s + parseInt(r.count), 0) ?? 0;
  const totalViews    = d?.documents?.reduce((s: number, r: any) => s + parseInt(r.total_views ?? 0), 0) ?? 0;
  const totalDownloads= d?.documents?.reduce((s: number, r: any) => s + parseInt(r.total_downloads ?? 0), 0) ?? 0;
  const totalCitations= d?.documents?.reduce((s: number, r: any) => s + parseInt(r.total_citations ?? 0), 0) ?? 0;
  const pending       = d?.moderation?.find((m: any) => m.moderation_status === 'pending')?.count ?? 0;

  const exportUrl = adminApi.exportCsv();

  if (isLoading) return (
    <div className="max-w-6xl mx-auto space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-24 skeleton rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div />
        <a href={exportUrl} target="_blank" rel="noopener noreferrer"
          className="btn-secondary">
          <FileText size={14} /> Export CSV
        </a>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total users',   value: totalUsers,     icon: Users,      color: 'bg-primary-50 text-primary-700' },
          { label: 'Documents',     value: totalDocs,      icon: BookOpen,   color: 'bg-blue-50 text-blue-700' },
          { label: 'Total views',   value: totalViews,     icon: Eye,        color: 'bg-purple-50 text-purple-700' },
          { label: 'Citations',     value: totalCitations, icon: Award,      color: 'bg-gold-50 text-gold-600' },
        ].map(k => (
          <div key={k.label} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wide font-medium">{k.label}</p>
                <p className="text-3xl font-display font-semibold text-stone-900 mt-1">{k.value.toLocaleString()}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${k.color}`}>
                <k.icon size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        {/* Users by role */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={15} className="text-stone-500" />
            <h3 className="font-display font-semibold text-stone-900">Users by role</h3>
          </div>
          {d?.users?.length > 0 ? (
            <div className="space-y-2.5">
              {d.users.filter((r: any) => r.role).map((r: any) => {
                const pct = totalUsers ? Math.round((parseInt(r.count) / totalUsers) * 100) : 0;
                return (
                  <div key={r.role}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-stone-600 capitalize">{r.role.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-stone-400">{parseInt(r.count).toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm text-stone-400 text-center py-6">No data</p>}
        </div>

        {/* Documents by type */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={15} className="text-stone-500" />
            <h3 className="font-display font-semibold text-stone-900">Documents by type</h3>
          </div>
          {d?.documents?.length > 0 ? (
            <div className="space-y-2.5">
              {d.documents.map((r: any) => {
                const pct = totalDocs ? Math.round((parseInt(r.count) / totalDocs) * 100) : 0;
                return (
                  <div key={r.doc_type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-stone-600 capitalize">{(r.doc_type ?? 'unknown').replace(/_/g, ' ')}</span>
                      <span className="text-xs text-stone-400">{parseInt(r.count).toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm text-stone-400 text-center py-6">No data</p>}
        </div>

        {/* Moderation queue + quick links */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={15} className="text-stone-500" />
              <h3 className="font-display font-semibold text-stone-900">Moderation queue</h3>
            </div>
            <div className="space-y-2">
              {(d?.moderation ?? []).map((m: any) => (
                <div key={m.moderation_status} className="flex items-center justify-between">
                  <span className="text-sm text-stone-600 capitalize">{m.moderation_status}</span>
                  <span className={`badge text-xs ${
                    m.moderation_status === 'pending'  ? 'badge-gold' :
                    m.moderation_status === 'approved' ? 'badge-green' : 'badge bg-red-50 text-red-600'
                  }`}>{parseInt(m.count)}</span>
                </div>
              ))}
              {parseInt(pending) > 0 && (
                <Link href="/admin/moderation" className="btn-primary w-full mt-2 text-xs">
                  Review {pending} pending →
                </Link>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-display font-semibold text-stone-900 mb-3 text-sm">Quick links</h3>
            <div className="space-y-1">
              {[
                { label: 'User management', href: '/admin/users' },
                { label: 'Document moderation', href: '/admin/moderation' },
                { label: 'Announcements', href: '/admin/announcements' },
                { label: 'Audit log', href: '/admin/audit-log' },
              ].map(a => (
                <Link key={a.href} href={a.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors">
                  <ArrowUpRight size={13} className="text-stone-400" /> {a.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Department output table */}
      {d?.byDepartment?.length > 0 && (
        <div className="card p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-stone-500" />
            <h3 className="font-display font-semibold text-stone-900">Output by department</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide py-2">Department</th>
                  <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wide py-2">Documents</th>
                  <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wide py-2 hidden sm:table-cell">Downloads</th>
                  <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wide py-2 hidden sm:table-cell">Citations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {d.byDepartment.map((dep: any) => (
                  <tr key={dep.department} className="hover:bg-stone-50 transition-colors">
                    <td className="py-2.5 text-sm text-stone-800">{dep.department ?? 'No department'}</td>
                    <td className="py-2.5 text-sm text-right text-stone-600">{parseInt(dep.documents).toLocaleString()}</td>
                    <td className="py-2.5 text-sm text-right text-stone-600 hidden sm:table-cell">{parseInt(dep.downloads).toLocaleString()}</td>
                    <td className="py-2.5 text-sm text-right text-stone-600 hidden sm:table-cell">{parseInt(dep.citations).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top documents */}
      {d?.topDocuments?.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award size={15} className="text-stone-500" />
            <h3 className="font-display font-semibold text-stone-900">Top documents by citation</h3>
          </div>
          <div className="space-y-2">
            {d.topDocuments.map((doc: any, i: number) => (
              <Link key={doc.id} href={`/repository/${doc.id}`}
                className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-stone-50 transition-colors group">
                <span className="text-xs font-bold text-stone-300 w-5 text-right flex-shrink-0">{i + 1}</span>
                <FileText size={14} className="text-stone-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-700 truncate group-hover:text-primary-700">{doc.title}</p>
                  <p className="text-xs text-stone-400">{doc.uploader_name} · {doc.department ?? '—'}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-stone-400 flex-shrink-0">
                  <span className="flex items-center gap-1"><Award size={10} />{parseInt(doc.citation_count)}</span>
                  <span className="flex items-center gap-1"><Eye size={10} />{parseInt(doc.view_count)}</span>
                  <span className="flex items-center gap-1"><Download size={10} />{parseInt(doc.download_count)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
