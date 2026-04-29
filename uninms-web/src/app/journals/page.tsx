'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BookOpen, Search, Globe, FileText, ArrowUpRight, X } from 'lucide-react';
import Link from 'next/link';

export default function JournalsPage() {
  const [search,   setActiveSearch] = useState('');
  const [input,    setInput]        = useState('');
  const [subject,  setSubject]      = useState('');
  const [page,     setPage]         = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['journals', search, subject, page],
    queryFn: () => api.get('/journals', {
      params: { search: search || undefined, subject: subject || undefined, page, limit: 18 },
    }).then(r => r.data.data),
  });

  const { data: allSubjects } = useQuery({
    queryKey: ['journal-subjects'],
    queryFn: () => api.get('/journals/subjects/list').then(r => r.data.data as string[]),
    staleTime: 5 * 60_000,
  });

  const journals   = data?.journals ?? [];
  const totalPages = data?.totalPages ?? 1;

  const FREQ_BADGE: Record<string,string> = {
    monthly: 'badge-blue', quarterly: 'badge-green',
    biannual: 'badge-stone', annual: 'badge-stone',
  };

  const clearFilters = () => {
    setActiveSearch(''); setInput(''); setSubject(''); setPage(1);
  };
  const hasFilter = search || subject;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero */}
      <div className="rounded-2xl p-8 mb-8 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#09432c 0%,#0d6b44 100%)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 50%,#d4a017,transparent 60%)' }} />
        <div className="relative max-w-2xl">
          <h1 className="font-display text-3xl font-semibold mb-2">Nigerian University Journals</h1>
          <p className="text-white/70 mb-6">
            Peer-reviewed academic journals hosted by Nigerian universities.
            Submit manuscripts, review papers, and access published research.
          </p>
          <form onSubmit={e => { e.preventDefault(); setActiveSearch(input); setPage(1); }}
            className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50" />
              <input value={input} onChange={e => setInput(e.target.value)}
                placeholder="Search journals by title or subject…"
                className="w-full bg-white/15 border border-white/20 text-white placeholder:text-white/50 rounded-xl px-4 py-2.5 pl-10 focus:outline-none focus:bg-white/20" />
            </div>
            <button type="submit" className="px-5 py-2.5 bg-white text-primary-800 rounded-xl font-medium text-sm hover:bg-white/90">
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: BookOpen, label: 'Active journals',    value: data?.total ?? '—' },
          { icon: FileText, label: 'Published articles', value: '—' },
          { icon: Globe,    label: 'Open access',        value: '100%' },
        ].map(s => (
          <div key={s.label} className="stat-card flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <s.icon size={18} className="text-primary-700" />
            </div>
            <div>
              <p className="text-2xl font-display font-semibold text-stone-900">{s.value}</p>
              <p className="text-xs text-stone-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Subject filters */}
      {(allSubjects?.length ?? 0) > 0 && (
        <div className="mb-6">
          <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-2">Browse by subject</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setSubject(''); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border
                ${!subject
                  ? 'bg-primary-800 text-white border-primary-800'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-primary-300 hover:text-primary-700'}`}>
              All subjects
            </button>
            {allSubjects!.map(s => (
              <button key={s}
                onClick={() => { setSubject(s === subject ? '' : s); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border
                  ${subject === s
                    ? 'bg-primary-800 text-white border-primary-800'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-primary-300 hover:text-primary-700'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active filters bar */}
      {hasFilter && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-stone-400">Filtering by:</span>
          {search && (
            <span className="badge badge-stone text-xs flex items-center gap-1">
              "{search}"
              <button onClick={() => { setActiveSearch(''); setInput(''); setPage(1); }}>
                <X size={10} />
              </button>
            </span>
          )}
          {subject && (
            <span className="badge badge-stone text-xs flex items-center gap-1">
              {subject}
              <button onClick={() => { setSubject(''); setPage(1); }}>
                <X size={10} />
              </button>
            </span>
          )}
          <button onClick={clearFilters} className="text-xs text-primary-700 hover:underline">
            Clear all
          </button>
        </div>
      )}

      {/* Journal grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_,i) => <div key={i} className="h-52 skeleton rounded-2xl" />)}
        </div>
      ) : journals.length === 0 ? (
        <div className="card p-16 text-center">
          <BookOpen size={40} className="mx-auto mb-3 text-stone-300" />
          <h3 className="font-display font-semibold text-stone-700 mb-1">No journals found</h3>
          <p className="text-stone-400 text-sm mb-4">Try adjusting your search or filters.</p>
          {hasFilter && (
            <button onClick={clearFilters} className="btn-secondary btn-sm">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {journals.map((j: any) => (
            <Link key={j.id} href={`/journals/${j.slug}`} className="card-hover block p-5 group">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 transition-colors">
                  {j.cover_image_url
                    ? <img src={j.cover_image_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
                    : <BookOpen size={20} className="text-primary-700" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-stone-900 text-sm leading-tight group-hover:text-primary-700 line-clamp-2">
                    {j.title}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5 truncate">{j.university_name}</p>
                </div>
                <ArrowUpRight size={14} className="text-stone-300 group-hover:text-primary-500 flex-shrink-0" />
              </div>

              {j.description && (
                <p className="text-xs text-stone-500 line-clamp-2 mb-3 leading-relaxed">{j.description}</p>
              )}

              {/* Subject tags */}
              {j.subjects?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {j.subjects.slice(0, 2).map((s: string) => (
                    <span key={s} className="text-[10px] px-2 py-0.5 bg-stone-100 text-stone-500 rounded-full">
                      {s}
                    </span>
                  ))}
                  {j.subjects.length > 2 && (
                    <span className="text-[10px] px-2 py-0.5 bg-stone-100 text-stone-400 rounded-full">
                      +{j.subjects.length - 2}
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-3">
                {j.frequency && (
                  <span className={`badge text-xs ${FREQ_BADGE[j.frequency] ?? 'badge-stone'}`}>
                    {j.frequency}
                  </span>
                )}
                <span className="badge badge-stone text-xs">{j.review_type?.replace('_',' ')}</span>
                {j.is_open_access && <span className="badge-green badge text-xs">Open Access</span>}
              </div>

              <div className="flex items-center justify-between text-xs text-stone-400 pt-3 border-t border-stone-100">
                <span className="flex items-center gap-1">
                  <FileText size={11} /> {j.article_count || 0} articles
                </span>
                {j.issn_online && <span className="font-mono">ISSN {j.issn_online}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page<=1} className="btn-secondary btn-sm">Prev</button>
          <span className="text-sm text-stone-500 self-center">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page>=totalPages} className="btn-secondary btn-sm">Next</button>
        </div>
      )}
    </div>
  );
}
