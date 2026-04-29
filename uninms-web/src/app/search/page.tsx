'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from '@/lib/api';
import { Search, Sparkles, BookOpen, Eye, ArrowUpRight, X } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

type Mode = 'fulltext' | 'semantic';

export default function SearchPage() {
  const [input, setInput]       = useState('');
  const [query, setQuery]       = useState('');
  const [mode,  setMode]        = useState<Mode>('fulltext');

  const { data: ftData, isLoading: ftLoading } = useQuery({
    queryKey: ['search','fulltext', query],
    queryFn:  () => searchApi.fullText(query),
    enabled:  mode === 'fulltext' && query.length >= 2,
    staleTime: 0,
  });

  const { data: semData, isLoading: semLoading } = useQuery({
    queryKey: ['search','semantic', query],
    queryFn:  () => searchApi.semantic(query),
    enabled:  mode === 'semantic' && query.length >= 3,
    staleTime: 0,
  });

  const isLoading = mode === 'fulltext' ? ftLoading : semLoading;
  const results   = mode === 'fulltext'
    ? ((ftData?.data as any)?.results ?? [])
    : ((semData?.data as any)?.results ?? []);
  const total     = mode === 'fulltext'
    ? ((ftData?.data as any)?.total ?? 0)
    : results.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(input);
  };

  const TYPE_BADGE: Record<string, string> = {
    thesis: 'badge-green', research_paper: 'badge-blue',
    lecture_note: 'badge-stone', dataset: 'badge-purple',
    past_question: 'badge-gold',
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Search box */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={input} onChange={e => setInput(e.target.value)} autoFocus
            placeholder="Search the repository…"
            className="input pl-11 pr-28 py-3.5 text-base" />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {input && (
              <button type="button" onClick={() => { setInput(''); setQuery(''); }}
                className="p-1 text-stone-400 hover:text-stone-600"><X size={14} /></button>
            )}
            <button type="submit" className="btn-primary btn-sm">Search</button>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center bg-stone-100 rounded-lg p-1 gap-1">
            {([['fulltext','Keyword',Search],['semantic','Semantic AI',Sparkles]] as const).map(([v, label, Icon]) => (
              <button key={v} type="button" onClick={() => setMode(v as Mode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                  ${mode === v ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
                <Icon size={12} />{label}
              </button>
            ))}
          </div>
          {mode === 'semantic' && (
            <p className="text-xs text-stone-400">Describe what you need in plain language</p>
          )}
        </div>
      </form>

      {/* Results */}
      {query && (
        <p className="text-sm text-stone-500 mb-4">
          {isLoading ? 'Searching…' : `${total.toLocaleString()} result${total !== 1 ? 's' : ''} for "${query}"`}
        </p>
      )}

      {!query ? (
        <div className="card p-16 text-center">
          <Search size={40} className="mx-auto mb-3 text-stone-300" />
          <h3 className="font-display font-semibold text-stone-700 mb-1">Search the repository</h3>
          <p className="text-stone-400 text-sm">Use Keyword for exact terms, or Semantic AI to describe what you need.</p>
        </div>
      ) : isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[...Array(6)].map((_,i) => <div key={i} className="h-32 skeleton rounded-2xl" />)}
        </div>
      ) : results.length === 0 ? (
        <div className="card p-16 text-center">
          <BookOpen size={40} className="mx-auto mb-3 text-stone-300" />
          <h3 className="font-display font-semibold text-stone-700 mb-1">No results</h3>
          <p className="text-stone-400 text-sm">Try different keywords or switch to Semantic AI.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {results.map((doc: any) => (
            <Link key={doc.id} href={`/repository/${doc.id}`}
              className="card-hover block p-5 group">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-stone-100 group-hover:bg-primary-50 flex items-center justify-center flex-shrink-0 transition-colors">
                  <BookOpen size={14} className="text-stone-400 group-hover:text-primary-600 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-stone-900 text-sm line-clamp-2 group-hover:text-primary-700">{doc.title}</h3>
                  {doc.abstract && <p className="text-xs text-stone-500 mt-1 line-clamp-2">{doc.abstract}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`badge ${TYPE_BADGE[doc.doc_type] ?? 'badge-stone'} text-xs`}>{doc.doc_type?.replace('_',' ')}</span>
                    {doc.relevance_score && (
                      <span className="badge-blue badge text-xs">Score: {parseFloat(doc.relevance_score).toFixed(2)}</span>
                    )}
                    {doc.similarity && (
                      <span className="badge-purple badge text-xs">{(doc.similarity * 100).toFixed(0)}% match</span>
                    )}
                  </div>
                </div>
                <ArrowUpRight size={14} className="text-stone-300 group-hover:text-primary-500 flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
