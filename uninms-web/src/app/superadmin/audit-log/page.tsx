'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { platformApi } from '@/lib/api';
import { ClipboardList, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function SuperAdminAuditLogPage() {
  const [page, setPage]         = useState(1);
  const [action, setAction]     = useState('');
  const [activeAction, setActiveAction] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['platform-audit-log', activeAction, page],
    queryFn:  () => platformApi.auditLog({ page, limit: 50, action: activeAction || undefined }),
  });

  const entries    = (data as any)?.data?.entries ?? [];
  const total      = (data as any)?.data?.total ?? 0;
  const totalPages = (data as any)?.data?.totalPages ?? 1;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <p className="text-stone-500 text-sm">{total.toLocaleString()} entries across all institutions</p>
      </div>

      <form onSubmit={e => { e.preventDefault(); setActiveAction(action); setPage(1); }} className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={action} onChange={e => setAction(e.target.value)} placeholder="Filter by action (e.g. user.register)…" className="input pl-10" />
        </div>
        <button type="submit" className="btn-secondary px-5">Filter</button>
        {activeAction && (
          <button type="button" onClick={() => { setAction(''); setActiveAction(''); setPage(1); }} className="btn-secondary">Clear</button>
        )}
      </form>

      {isLoading ? (
        <div className="space-y-2">{[...Array(10)].map((_, i) => <div key={i} className="h-14 skeleton rounded-xl" />)}</div>
      ) : entries.length === 0 ? (
        <div className="card p-16 text-center">
          <ClipboardList size={40} className="mx-auto mb-3 text-stone-300" />
          <p className="text-stone-400 text-sm">No audit entries found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3">Action</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Actor</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Institution</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3 hidden xl:table-cell">Details</th>
                <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {entries.map((e: any) => (
                <tr key={e.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="badge badge-stone text-xs font-mono">{e.action}</span>
                    {e.target_type && <p className="text-xs text-stone-400 mt-0.5">{e.target_type}{e.target_id ? ` #${e.target_id.slice(0, 8)}` : ''}</p>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p className="text-sm text-stone-700">{e.actor_name ?? '—'}</p>
                    <p className="text-xs text-stone-400">{e.actor_email}</p>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-sm text-stone-500">{e.actor_university ?? '—'}</td>
                  <td className="px-4 py-3 hidden xl:table-cell text-xs text-stone-500 max-w-xs">
                    {e.details ? (
                      <span className="font-mono truncate block">{JSON.stringify(e.details).slice(0, 80)}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-400">
                    {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary btn-sm"><ChevronLeft size={14} /></button>
          <span className="text-sm text-stone-600">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary btn-sm"><ChevronRight size={14} /></button>
        </div>
      )}
    </div>
  );
}
