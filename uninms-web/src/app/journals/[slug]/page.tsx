'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  BookOpen, FileText, Users, ArrowLeft, Send, ChevronDown,
  ChevronRight, Loader2, Search, X, Clock,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

// ── Issue row (collapsible, with article links) ───────────────────────────────

function IssueRow({ issue, journalSlug }: { issue: any; journalSlug: string }) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['issue-articles', issue.id],
    queryFn: () => api.get(`/journals/${journalSlug}/issues/${issue.id}/articles`).then(r => r.data.data),
    enabled: open,
  });

  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-stone-50 transition-colors text-left">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
            <FileText size={14} className="text-primary-700" />
          </div>
          <div>
            <p className="font-medium text-stone-900 text-sm">
              Issue {issue.issue_no}{issue.title ? ` — ${issue.title}` : ''}
            </p>
            <p className="text-xs text-stone-400">
              {issue.published_at
                ? new Date(issue.published_at).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })
                : 'Published'}
              {' · '}{issue.article_count || 0} articles
            </p>
          </div>
        </div>
        {open ? <ChevronDown size={16} className="text-stone-400" /> : <ChevronRight size={16} className="text-stone-400" />}
      </button>

      {open && (
        <div className="border-t border-stone-100 bg-stone-50/50 divide-y divide-stone-100">
          {isLoading
            ? <div className="p-4 text-center"><Loader2 size={16} className="animate-spin text-stone-400 mx-auto" /></div>
            : !data?.length
            ? <p className="p-4 text-sm text-stone-400 text-center">No articles published yet.</p>
            : data.map((article: any) => (
              <ArticleRow key={article.id} article={article} journalSlug={journalSlug} />
            ))}
        </div>
      )}
    </div>
  );
}

// ── Article row (shared between IssueRow and LatestTab) ───────────────────────

function ArticleRow({ article, journalSlug }: { article: any; journalSlug: string }) {
  const authorNames = article.authors
    ?.filter((a: any) => a?.name)
    .map((a: any) => a.name)
    .join(', ')
    || article.author_names?.join(', ')
    || article.author_name
    || '';

  return (
    <div className="p-4 hover:bg-white transition-colors">
      <Link href={`/journals/${journalSlug}/articles/${article.id}`}
        className="font-medium text-stone-900 text-sm mb-1 hover:text-primary-700 block transition-colors">
        {article.title}
      </Link>
      {authorNames && (
        <p className="text-xs text-stone-500 mb-2">{authorNames}</p>
      )}
      {article.abstract && (
        <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed mb-2">{article.abstract}</p>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        {article.volume_no && (
          <span className="text-xs text-stone-400">
            Vol. {article.volume_no}{article.issue_no ? `, No. ${article.issue_no}` : ''}{article.year ? ` (${article.year})` : ''}
          </span>
        )}
        {article.pages && <span className="text-xs text-stone-400">pp. {article.pages}</span>}
        {article.doi && (
          <a href={`https://doi.org/${article.doi}`} target="_blank" rel="noopener noreferrer"
            className="text-xs text-primary-700 hover:underline font-mono" onClick={e => e.stopPropagation()}>
            DOI: {article.doi}
          </a>
        )}
        {article.keywords?.slice(0, 3).map((k: string) => (
          <span key={k} className="badge badge-stone text-xs">{k}</span>
        ))}
      </div>
    </div>
  );
}

// ── Latest tab ────────────────────────────────────────────────────────────────

function LatestTab({ journalSlug }: { journalSlug: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['journal-latest', journalSlug],
    queryFn: () => api.get(`/journals/${journalSlug}/articles/latest`, { params: { limit: 20 } }).then(r => r.data.data),
    enabled: !!journalSlug,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
    </div>
  );

  if (!data?.length) return (
    <div className="card p-12 text-center">
      <Clock size={32} className="mx-auto mb-3 text-stone-300" />
      <h3 className="font-display font-semibold text-stone-700 mb-1">No articles yet</h3>
      <p className="text-stone-400 text-sm">Be the first to submit a manuscript.</p>
    </div>
  );

  return (
    <div className="card divide-y divide-stone-100 overflow-hidden">
      {data.map((article: any) => (
        <ArticleRow key={article.id} article={article} journalSlug={journalSlug} />
      ))}
    </div>
  );
}

// ── Search tab ────────────────────────────────────────────────────────────────

function SearchTab({ journalSlug }: { journalSlug: string }) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['journal-search', journalSlug, query],
    queryFn: () => api.get(`/journals/${journalSlug}/articles/search`, { params: { q: query } }).then(r => r.data.data),
    enabled: !!query,
  });

  return (
    <div>
      <form onSubmit={e => { e.preventDefault(); setQuery(input); }}
        className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={input} onChange={e => setInput(e.target.value)}
            placeholder="Search articles by title, abstract, or keyword…"
            className="w-full border border-stone-200 rounded-xl px-4 py-2.5 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          {input && (
            <button type="button" onClick={() => { setInput(''); setQuery(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
              <X size={14} />
            </button>
          )}
        </div>
        <button type="submit" className="btn-primary btn-sm px-5">Search</button>
      </form>

      {!query && (
        <div className="card p-10 text-center">
          <Search size={32} className="mx-auto mb-3 text-stone-300" />
          <p className="text-stone-500 text-sm">Enter a search term to find articles in this journal.</p>
        </div>
      )}

      {query && isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
        </div>
      )}

      {query && !isLoading && data?.length === 0 && (
        <div className="card p-10 text-center">
          <p className="text-stone-500 text-sm">No articles matched "<strong>{query}</strong>".</p>
        </div>
      )}

      {data?.length > 0 && (
        <div>
          <p className="text-xs text-stone-400 mb-3">{data.length} result{data.length !== 1 ? 's' : ''} for "{query}"</p>
          <div className="card divide-y divide-stone-100 overflow-hidden">
            {data.map((article: any) => (
              <ArticleRow key={article.id} article={article} journalSlug={journalSlug} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'latest' | 'issues' | 'search' | 'about' | 'board' | 'submit';

export default function JournalHomePage() {
  const { slug }         = useParams<{ slug: string }>();
  const searchParams     = useSearchParams();
  const router           = useRouter();
  const initialTab       = (searchParams.get('tab') as Tab) || 'latest';
  const [tab, setTab]    = useState<Tab>(initialTab);

  // Sync tab state with URL
  const changeTab = (t: Tab) => {
    setTab(t);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', t);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const t = searchParams.get('tab') as Tab;
    if (t) setTab(t);
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['journal', slug],
    queryFn: () => api.get(`/journals/${slug}`).then(r => r.data.data),
    enabled: !!slug,
  });

  const j = data as any;

  if (isLoading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
    </div>
  );
  if (!j) return (
    <div className="max-w-2xl mx-auto text-center py-20">
      <BookOpen size={48} className="mx-auto mb-4 text-stone-300" />
      <h2 className="font-display text-2xl font-semibold text-stone-700 mb-2">Journal not found</h2>
      <Link href="/journals" className="btn-primary">Browse journals</Link>
    </div>
  );

  const TABS: { key: Tab; label: string }[] = [
    { key: 'latest', label: 'Latest articles' },
    { key: 'issues', label: 'All issues' },
    { key: 'search', label: 'Search' },
    { key: 'about',  label: 'About' },
    { key: 'board',  label: 'Editorial board' },
    { key: 'submit', label: 'Submit' },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <Link href="/journals"
        className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 mb-6 transition-colors">
        <ArrowLeft size={14} /> All journals
      </Link>

      {/* Journal header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center flex-shrink-0">
            {j.cover_image_url
              ? <img src={j.cover_image_url} alt="" className="w-20 h-20 rounded-2xl object-cover" />
              : <BookOpen size={28} className="text-primary-700" />}
          </div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-semibold text-stone-900 mb-1">{j.title}</h1>
            <p className="text-stone-500 text-sm">
              {j.university_name}{j.department_name ? ` · ${j.department_name}` : ''}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {j.is_open_access && <span className="badge-green badge">Open Access</span>}
              <span className="badge-stone badge capitalize">{j.frequency}</span>
              <span className="badge-stone badge capitalize">{j.review_type?.replace('_',' ')}</span>
              {j.language && j.language !== 'English' && <span className="badge-stone badge">{j.language}</span>}
              {j.subjects?.slice(0, 3).map((s: string) => (
                <span key={s} className="badge badge-blue text-xs">{s}</span>
              ))}
            </div>
          </div>
          <button onClick={() => changeTab('submit')} className="btn-primary flex-shrink-0">
            <Send size={14} /> Submit manuscript
          </button>
        </div>

        {/* ISSN / editor row */}
        {(j.issn_print || j.issn_online || j.editor_name) && (
          <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-stone-100 text-sm text-stone-500">
            {j.issn_print  && <span><span className="font-medium text-stone-700">Print ISSN:</span> {j.issn_print}</span>}
            {j.issn_online && <span><span className="font-medium text-stone-700">Online ISSN:</span> {j.issn_online}</span>}
            {j.editor_name && <span><span className="font-medium text-stone-700">Editor-in-Chief:</span> {j.editor_name}</span>}
          </div>
        )}
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => changeTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all
              ${tab === t.key ? 'bg-primary-800 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Latest articles */}
      {tab === 'latest' && <LatestTab journalSlug={slug} />}

      {/* All issues (volume tree) */}
      {tab === 'issues' && (
        <div className="space-y-4">
          {!j.volumes?.length ? (
            <div className="card p-12 text-center">
              <FileText size={36} className="mx-auto mb-3 text-stone-300" />
              <h3 className="font-display font-semibold text-stone-700 mb-1">No issues published yet</h3>
              <p className="text-stone-400 text-sm">Submit your manuscript to be among the first.</p>
              <button onClick={() => changeTab('submit')}
                className="btn-primary mt-4 inline-flex">Submit manuscript</button>
            </div>
          ) : j.volumes.map((vol: any) => (
            <div key={vol.id}>
              <h2 className="font-display font-semibold text-stone-800 text-lg mb-3">
                Volume {vol.volume_no} ({vol.year})
              </h2>
              <div className="space-y-3">
                {vol.issues?.map((issue: any) => (
                  <IssueRow key={issue.id} issue={issue} journalSlug={slug} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search within journal */}
      {tab === 'search' && <SearchTab journalSlug={slug} />}

      {/* About */}
      {tab === 'about' && (
        <div className="space-y-5">
          {j.scope && (
            <div className="card p-5">
              <h3 className="font-display font-semibold text-stone-900 mb-3">Aims & Scope</h3>
              <p className="text-stone-600 text-sm leading-relaxed">{j.scope}</p>
            </div>
          )}
          <div className="card p-5">
            <h3 className="font-display font-semibold text-stone-900 mb-4">Journal Information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { label: 'Publisher',    value: j.university_name },
                { label: 'Department',   value: j.department_name },
                { label: 'Frequency',    value: j.frequency },
                { label: 'Review Type',  value: j.review_type?.replace('_',' ') },
                { label: 'Language',     value: j.language },
                { label: 'Access',       value: j.is_open_access ? 'Open Access (free to read)' : 'Subscription' },
              ].filter(f => f.value).map(f => (
                <div key={f.label}>
                  <p className="text-xs text-stone-400 uppercase tracking-wide font-medium">{f.label}</p>
                  <p className="text-sm text-stone-800 font-medium mt-0.5 capitalize">{f.value}</p>
                </div>
              ))}
            </div>
            {j.subjects?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-stone-100">
                <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-2">Subject areas</p>
                <div className="flex flex-wrap gap-2">
                  {j.subjects.map((s: string) => (
                    <Link key={s} href={`/journals?subject=${encodeURIComponent(s)}`}
                      className="badge badge-stone hover:bg-primary-50 hover:text-primary-800 transition-colors">
                      {s}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {j.indexing?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-stone-100">
                <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-2">Indexed in</p>
                <div className="flex flex-wrap gap-2">
                  {j.indexing.map((i: string) => (
                    <span key={i} className="badge badge-blue">{i}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="card p-5">
            <h3 className="font-display font-semibold text-stone-900 mb-3">OAI-PMH Metadata</h3>
            <p className="text-sm text-stone-600 mb-3">
              This journal exposes metadata for harvesting by Google Scholar, AJOL, and other academic indexers.
            </p>
            <code className="text-xs bg-stone-100 rounded-lg p-3 block text-stone-700 break-all">
              {typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/journals/oai?verb=ListRecords&set={slug}
            </code>
          </div>
        </div>
      )}

      {/* Editorial board */}
      {tab === 'board' && (
        <div className="card p-5">
          {!j.board?.length ? (
            <p className="text-stone-400 text-sm text-center py-8">
              Editorial board not yet configured.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {j.board.map((member: any, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-stone-50">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-700 text-xs font-semibold">
                      {member.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-stone-900 text-sm">{member.full_name}</p>
                    <p className="text-xs text-primary-700 capitalize mt-0.5">{member.role.replace('_',' ')}</p>
                    {member.affiliation && <p className="text-xs text-stone-400 mt-0.5">{member.affiliation}</p>}
                    {member.orcid_id && (
                      <a href={`https://orcid.org/${member.orcid_id}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-[#a6ce39] hover:underline mt-0.5 block">
                        ORCID: {member.orcid_id}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submit manuscript */}
      {tab === 'submit' && (
        <div className="space-y-5">
          {(j.submission_guidelines || j.author_instructions) ? (
            <>
              {j.submission_guidelines && (
                <div className="card p-6">
                  <h3 className="font-display font-semibold text-stone-900 mb-4 flex items-center gap-2">
                    <FileText size={16} className="text-primary-700" /> Submission Guidelines
                  </h3>
                  <div className="prose prose-sm prose-stone max-w-none">
                    <p className="text-stone-600 text-sm leading-relaxed whitespace-pre-wrap">{j.submission_guidelines}</p>
                  </div>
                </div>
              )}
              {j.author_instructions && (
                <div className="card p-6">
                  <h3 className="font-display font-semibold text-stone-900 mb-4 flex items-center gap-2">
                    <Users size={16} className="text-primary-700" /> Instructions for Authors
                  </h3>
                  <p className="text-stone-600 text-sm leading-relaxed whitespace-pre-wrap">{j.author_instructions}</p>
                </div>
              )}
            </>
          ) : (
            <div className="card p-6">
              <h3 className="font-display font-semibold text-stone-900 mb-3">Submission Guidelines</h3>
              <div className="space-y-3 text-sm text-stone-600">
                <p>Manuscripts submitted to <strong>{j.title}</strong> must meet the following general requirements:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Original research not published or under review elsewhere</li>
                  <li>Written in English; clear, concise academic language</li>
                  <li>Manuscript file: PDF or Microsoft Word (.docx)</li>
                  <li>Maximum file size: 50 MB</li>
                  <li>Include a structured abstract (250–300 words) and 4–6 keywords</li>
                  <li>All co-authors must be listed with their affiliations</li>
                  <li>References must follow APA 7th edition or the journal's specified style</li>
                  <li>Plagiarism check is run automatically upon submission</li>
                  <li>Review type: <span className="capitalize font-medium">{j.review_type?.replace('_',' ')}</span></li>
                  <li>Typical review turnaround: 4–8 weeks</li>
                </ul>
              </div>
            </div>
          )}
          <div className="card p-6">
            <h3 className="font-display font-semibold text-stone-900 mb-2">Ready to submit?</h3>
            <p className="text-stone-500 text-sm mb-4">
              Use the online submission form. You'll need your manuscript file and author details.
            </p>
            <Link href={`/journals/${slug}/submit`} className="btn-primary gap-2">
              <Send size={14} /> Submit your manuscript
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
