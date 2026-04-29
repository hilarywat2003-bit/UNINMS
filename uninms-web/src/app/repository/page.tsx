'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { documentsApi } from '@/lib/api';
import { BookOpen, Search, Upload, Eye, Download, ArrowUpRight, ChevronLeft, ChevronRight, X, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';

const TYPE_FILTERS = [
  { value: '', label: 'All types' },
  { value: 'thesis', label: 'Thesis' },
  { value: 'research_paper', label: 'Research paper' },
  { value: 'lecture_note', label: 'Lecture notes' },
  { value: 'dataset', label: 'Dataset' },
  { value: 'past_question', label: 'Past questions' },
];

const SORT_OPTIONS = [
  { value: 'published_at', label: 'Newest first' },
  { value: 'view_count',   label: 'Most viewed' },
  { value: 'download_count', label: 'Most downloaded' },
];

const TYPE_BADGE: Record<string, string> = {
  thesis: 'badge-green', research_paper: 'badge-blue', lecture_note: 'badge-stone',
  dataset: 'badge-purple', past_question: 'badge-gold', other: 'badge-stone',
};

export default function RepositoryPage() {
  const [searchQ, setSearchQ]       = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [docType, setDocType]       = useState('');
  const [sortBy, setSortBy]         = useState('published_at');
  const [page, setPage]             = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['documents', 'list', docType, sortBy, page, activeSearch],
    queryFn: () => documentsApi.list({
      docType: docType || undefined,
      page, limit: 12,
      search: activeSearch || undefined,
      sortBy,
      sortDir: 'DESC',
    }),
  });

  const docs       = (data?.data as any)?.documents ?? [];
  const total      = (data?.data as any)?.total ?? 0;
  const totalPages = (data?.data as any)?.totalPages ?? 1;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQ);
    setPage(1);
  };

  const clearSearch = () => {
    setSearchQ('');
    setActiveSearch('');
    setPage(1);
  };

  const setFilter = (type: string) => {
    setDocType(type);
    setPage(1);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search titles, abstracts, keywords…"
            className="input pl-11 pr-32 py-3 text-sm w-full"
            autoFocus
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQ && (
              <button type="button" onClick={clearSearch} className="p-1.5 text-stone-400 hover:text-stone-600">
                <X size={14} />
              </button>
            )}
            <button type="submit" className="btn-primary btn-sm px-4">Search</button>
          </div>
        </div>
      </form>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {/* Type pills */}
        <div className="flex flex-wrap gap-1.5 flex-1">
          {TYPE_FILTERS.map(({ value, label }) => (
            <button key={value} onClick={() => setFilter(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                ${docType === value
                  ? 'bg-primary-800 text-white border-primary-800'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Sort + upload */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setShowFilters(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
              ${showFilters ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'}`}>
            <SlidersHorizontal size={12} /> Sort
          </button>
          <Link href="/repository/upload" className="btn-primary btn-sm">
            <Upload size={13} /> Upload
          </Link>
        </div>
      </div>

      {/* Sort dropdown */}
      {showFilters && (
        <div className="card p-4 mb-5 flex items-center gap-3">
          <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">Sort by</span>
          <div className="flex gap-2 flex-wrap">
            {SORT_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => { setSortBy(opt.value); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${sortBy === opt.value ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Result count + active search tag */}
      <div className="flex items-center gap-3 mb-4">
        <p className="text-sm text-stone-500">
          {isLoading ? 'Searching…' : `${total.toLocaleString()} document${total !== 1 ? 's' : ''}${activeSearch ? ` for "${activeSearch}"` : ''}`}
        </p>
        {activeSearch && (
          <button onClick={clearSearch}
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 px-2 py-1 rounded-full border border-stone-200 bg-stone-50">
            <X size={11} /> Clear search
          </button>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 skeleton rounded-2xl" />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="card p-16 text-center">
          <BookOpen size={40} className="mx-auto mb-3 text-stone-300" />
          <h3 className="font-display font-semibold text-stone-700 mb-1">Nothing found</h3>
          <p className="text-stone-400 text-sm">Try different keywords or remove filters.</p>
          {activeSearch && (
            <button onClick={clearSearch} className="btn-secondary mt-4 text-sm">Clear search</button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {docs.map((doc: any) => (
            <Link key={doc.id} href={`/repository/${doc.id}`} className="card-hover block p-5 group">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-50 transition-colors">
                  <BookOpen size={16} className="text-stone-400 group-hover:text-primary-600 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-stone-900 text-sm line-clamp-2 group-hover:text-primary-700">{doc.title}</h3>
                  {doc.abstract && <p className="text-xs text-stone-500 mt-1 line-clamp-2">{doc.abstract}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`badge ${TYPE_BADGE[doc.doc_type] ?? 'badge-stone'} text-xs`}>{doc.doc_type?.replace('_', ' ')}</span>
                    <span className="text-xs text-stone-400 flex items-center gap-1"><Eye size={10} />{doc.view_count}</span>
                    <span className="text-xs text-stone-400 flex items-center gap-1"><Download size={10} />{doc.download_count}</span>
                  </div>
                </div>
                <ArrowUpRight size={14} className="text-stone-300 group-hover:text-primary-500 flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary btn-sm">
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm text-stone-600">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary btn-sm">
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
