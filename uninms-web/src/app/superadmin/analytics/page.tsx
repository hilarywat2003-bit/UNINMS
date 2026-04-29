'use client';
import { useMutation } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { platformApi } from '@/lib/api';
import {
  Building2, Users, BookOpen, Eye, Download, Award,
  FileText, AlertTriangle, Play, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const PLAN_BADGE: Record<string, string> = {
  free: 'badge-stone', basic: 'badge-blue', standard: 'badge-green',
  premium: 'badge-purple', enterprise: 'badge-gold',
};

export default function SuperAdminAnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-analytics'],
    queryFn:  () => platformApi.analytics(),
  });

  const batchMut = useMutation({
    mutationFn: () => platformApi.batchPlagiarismCheck(),
    onSuccess: (res: any) => toast.success(res?.message ?? 'Batch check started'),
    onError:   (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed'),
  });

  const d = (data as any)?.data;

  const totalUnis   = d?.universities?.reduce((s: number, r: any) => s + parseInt(r.count), 0) ?? 0;
  const totalUsers  = d?.users?.reduce((s: number, r: any) => s + parseInt(r.count), 0) ?? 0;
  const totalDocs   = d?.documents?.reduce((s: number, r: any) => s + parseInt(r.count), 0) ?? 0;
  const totalViews  = d?.documents?.reduce((s: number, r: any) => s + parseInt(r.total_views ?? 0), 0) ?? 0;
  const totalCitations = d?.documents?.reduce((s: number, r: any) => s + parseInt(r.total_citations ?? 0), 0) ?? 0;

  if (isLoading) return (
    <div className="max-w-7xl mx-auto space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-24 skeleton rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Platform KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Universities', value: totalUnis,      icon: Building2, color: 'bg-primary-50 text-primary-700' },
          { label: 'Total users',  value: totalUsers,     icon: Users,     color: 'bg-blue-50 text-blue-700' },
          { label: 'Documents',    value: totalDocs,      icon: BookOpen,  color: 'bg-purple-50 text-purple-700' },
          { label: 'Total views',  value: totalViews,     icon: Eye,       color: 'bg-stone-100 text-stone-600' },
          { label: 'Citations',    value: totalCitations, icon: Award,     color: 'bg-gold-50 text-gold-600' },
        ].map(k => (
          <div key={k.label} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wide font-medium">{k.label}</p>
                <p className="text-2xl font-display font-semibold text-stone-900 mt-1">{k.value.toLocaleString()}</p>
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${k.color}`}>
                <k.icon size={16} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        {/* Universities by plan */}
        <div className="card p-5">
          <h3 className="font-display font-semibold text-stone-900 mb-4">Institutions by plan</h3>
          {d?.universities?.length > 0 ? (
            <div className="space-y-2.5">
              {d.universities.map((r: any) => {
                const pct = totalUnis ? Math.round((parseInt(r.count) / totalUnis) * 100) : 0;
                return (
                  <div key={`${r.plan}-${r.status}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`badge text-xs ${PLAN_BADGE[r.plan] ?? 'badge-stone'}`}>{r.plan}</span>
                        <span className="text-xs text-stone-400 capitalize">{r.status}</span>
                      </div>
                      <span className="text-xs text-stone-400">{parseInt(r.count)}</span>
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

        {/* Users by role */}
        <div className="card p-5">
          <h3 className="font-display font-semibold text-stone-900 mb-4">Users by role (platform)</h3>
          {d?.users?.filter((r: any) => r.role)?.length > 0 ? (
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
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm text-stone-400 text-center py-6">No data</p>}
        </div>

        {/* Plagiarism + quick actions */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-display font-semibold text-stone-900 mb-3">Plagiarism status</h3>
            {d?.plagiarism?.length > 0 ? (
              <div className="space-y-2">
                {d.plagiarism.map((r: any) => (
                  <div key={r.plagiarism_status} className="flex items-center justify-between">
                    <span className="text-sm text-stone-600 capitalize">{r.plagiarism_status ?? 'unchecked'}</span>
                    <span className="text-sm font-medium text-stone-700">{parseInt(r.count).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-stone-400 text-center py-3">No data</p>}
            <button onClick={() => batchMut.mutate()} disabled={batchMut.isPending}
              className="btn-secondary w-full mt-3 text-xs">
              {batchMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play size={12} />}
              Run platform-wide check
            </button>
          </div>
          <div className="card p-5">
            <h3 className="font-display font-semibold text-stone-900 mb-2 text-sm">Quick links</h3>
            <div className="space-y-1">
              {[
                { label: 'Manage universities', href: '/superadmin/universities' },
                { label: 'Global audit log',    href: '/superadmin/audit-log' },
                { label: 'Platform announcements', href: '/superadmin/announcements' },
                { label: 'Platform settings',  href: '/superadmin/settings' },
              ].map(a => (
                <Link key={a.href} href={a.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-50 transition-colors">
                  <AlertTriangle size={12} className="text-stone-300" /> {a.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top universities table */}
      {d?.topUniversities?.length > 0 && (
        <div className="card p-5 mb-5">
          <h3 className="font-display font-semibold text-stone-900 mb-4">Top institutions by output</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide py-2">#</th>
                  <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide py-2">Institution</th>
                  <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide py-2 hidden sm:table-cell">Plan</th>
                  <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wide py-2">Users</th>
                  <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wide py-2">Documents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {d.topUniversities.map((u: any, i: number) => (
                  <tr key={u.id} className="hover:bg-stone-50 transition-colors">
                    <td className="py-2.5 text-xs font-bold text-stone-300 w-8">{i + 1}</td>
                    <td className="py-2.5">
                      <p className="text-sm font-medium text-stone-800">{u.name}</p>
                      {u.short_name && <p className="text-xs text-stone-400">{u.short_name}</p>}
                    </td>
                    <td className="py-2.5 hidden sm:table-cell">
                      <span className={`badge text-xs ${PLAN_BADGE[u.plan] ?? 'badge-stone'}`}>{u.plan ?? '—'}</span>
                    </td>
                    <td className="py-2.5 text-right text-sm text-stone-600">{parseInt(u.users ?? 0).toLocaleString()}</td>
                    <td className="py-2.5 text-right text-sm text-stone-600">{parseInt(u.documents ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Docs by type */}
      {d?.documents?.length > 0 && (
        <div className="card p-5">
          <h3 className="font-display font-semibold text-stone-900 mb-4">Documents by type (platform)</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide py-2">Type</th>
                  <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wide py-2">Count</th>
                  <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wide py-2 hidden sm:table-cell">Views</th>
                  <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wide py-2 hidden sm:table-cell">Downloads</th>
                  <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wide py-2 hidden md:table-cell">Citations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {d.documents.map((r: any) => (
                  <tr key={r.doc_type} className="hover:bg-stone-50">
                    <td className="py-2.5 text-sm text-stone-700 capitalize">{(r.doc_type ?? 'unknown').replace(/_/g, ' ')}</td>
                    <td className="py-2.5 text-right text-sm text-stone-600">{parseInt(r.count).toLocaleString()}</td>
                    <td className="py-2.5 text-right text-sm text-stone-600 hidden sm:table-cell">{parseInt(r.total_views ?? 0).toLocaleString()}</td>
                    <td className="py-2.5 text-right text-sm text-stone-600 hidden sm:table-cell">{parseInt(r.total_downloads ?? 0).toLocaleString()}</td>
                    <td className="py-2.5 text-right text-sm text-stone-600 hidden md:table-cell">{parseInt(r.total_citations ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
