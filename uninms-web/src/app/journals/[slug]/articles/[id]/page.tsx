'use client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowLeft, Download, BookOpen, FileText, Calendar,
  Hash, ExternalLink, Copy, Check, Users, Link2,
  Eye, TrendingDown,
} from 'lucide-react';
import { Loader2 } from 'lucide-react';

// ── Citation helpers ──────────────────────────────────────────────────────────

function toAPA(a: any): string {
  const authors = authorList(a);
  const year = a.published_at ? new Date(a.published_at).getFullYear() : 'n.d.';
  const doi = a.doi ? ` https://doi.org/${a.doi}` : '';
  return `${authors} (${year}). ${a.title}. *${a.journal_title}*${a.volume_no ? `, *${a.volume_no}*` : ''}${a.issue_no ? `(${a.issue_no})` : ''}${a.pages ? `, ${a.pages}` : ''}.${doi}`;
}

function toMLA(a: any): string {
  const first = (a.authors?.[0]?.name || a.author_name || '').split(' ');
  const lead = first.length > 1
    ? `${first[first.length - 1]}, ${first.slice(0, -1).join(' ')}`
    : first[0] ?? '';
  const rest = (a.authors || []).slice(1).map((au: any) => au.name).join(', et al.');
  const authorStr = rest ? `${lead}, ${rest}` : lead;
  const year = a.published_at ? new Date(a.published_at).getFullYear() : '';
  return `${authorStr}. "${a.title}." *${a.journal_title}*${a.volume_no ? `, vol. ${a.volume_no}` : ''}${a.issue_no ? `, no. ${a.issue_no}` : ''}, ${year}${a.pages ? `, pp. ${a.pages}` : ''}.`;
}

function toBibTeX(a: any): string {
  const key = `${(a.author_name || 'unknown').split(' ').pop()?.toLowerCase()}${a.published_at ? new Date(a.published_at).getFullYear() : ''}`;
  const authorsStr = (a.authors?.map((au: any) => au.name) || [a.author_name]).filter(Boolean).join(' and ');
  const year = a.published_at ? new Date(a.published_at).getFullYear() : '';
  return `@article{${key},
  author  = {${authorsStr}},
  title   = {${a.title}},
  journal = {${a.journal_title}},${a.volume_no ? `\n  volume  = {${a.volume_no}},` : ''}${a.issue_no ? `\n  number  = {${a.issue_no}},` : ''}${a.pages ? `\n  pages   = {${a.pages}},` : ''}
  year    = {${year}},${a.doi ? `\n  doi     = {${a.doi}},` : ''}
}`;
}

function toRIS(a: any): string {
  const year = a.published_at ? new Date(a.published_at).getFullYear() : '';
  const lines = [
    'TY  - JOUR',
    `TI  - ${a.title}`,
    `JO  - ${a.journal_title}`,
    ...(a.authors || [{ name: a.author_name }]).filter((au: any) => au?.name).map((au: any) => `AU  - ${au.name}`),
    ...(a.keywords || []).map((k: string) => `KW  - ${k}`),
    a.volume_no ? `VL  - ${a.volume_no}` : '',
    a.issue_no  ? `IS  - ${a.issue_no}`  : '',
    a.pages     ? `SP  - ${a.pages}`     : '',
    year        ? `PY  - ${year}`        : '',
    a.doi       ? `DO  - ${a.doi}`       : '',
    a.abstract  ? `AB  - ${a.abstract.slice(0, 500)}` : '',
    'ER  -',
  ].filter(Boolean);
  return lines.join('\n');
}

function authorList(a: any): string {
  const all = a.authors?.filter((au: any) => au?.name) ?? [];
  if (!all.length) return a.author_name || 'Unknown';
  if (all.length === 1) return all[0].name;
  if (all.length === 2) return `${all[0].name} & ${all[1].name}`;
  return `${all[0].name}, ${all.slice(1, -1).map((au: any) => au.name).join(', ')}, & ${all[all.length - 1].name}`;
}

// ── Cite modal ────────────────────────────────────────────────────────────────

function CiteModal({ article, onClose }: { article: any; onClose: () => void }) {
  const [format, setFormat] = useState<'apa'|'mla'|'bibtex'|'ris'>('apa');
  const [copied, setCopied] = useState(false);

  const text = format === 'apa' ? toAPA(article)
    : format === 'mla'    ? toMLA(article)
    : format === 'bibtex' ? toBibTeX(article)
    : toRIS(article);

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const ext = format === 'bibtex' ? 'bib' : format === 'ris' ? 'ris' : 'txt';
    const blob = new Blob([text], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `citation.${ext}`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-stone-100">
          <h3 className="font-display font-semibold text-stone-900">Cite this article</h3>
          <p className="text-xs text-stone-400 mt-0.5">Choose a citation format to copy or download</p>
        </div>
        <div className="p-5">
          <div className="flex gap-2 mb-4">
            {(['apa','mla','bibtex','ris'] as const).map(f => (
              <button key={f} onClick={() => setFormat(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase tracking-wide transition-all
                  ${format === f ? 'bg-primary-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                {f === 'bibtex' ? 'BibTeX' : f.toUpperCase()}
              </button>
            ))}
          </div>
          <pre className="bg-stone-50 rounded-xl p-4 text-xs text-stone-700 whitespace-pre-wrap leading-relaxed font-mono max-h-52 overflow-y-auto">
            {text}
          </pre>
        </div>
        <div className="p-5 border-t border-stone-100 flex gap-2">
          <button onClick={copy}
            className="btn-primary btn-sm flex-1 justify-center gap-1.5">
            {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
          </button>
          <button onClick={download} className="btn-secondary btn-sm flex-1 justify-center gap-1.5">
            <Download size={13} /> Download
          </button>
          <button onClick={onClose} className="btn-secondary btn-sm">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ArticleDetailPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const [showCite, setShowCite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['article', slug, id],
    queryFn: () => api.get(`/journals/${slug}/articles/${id}`).then(r => r.data.data),
    enabled: !!(slug && id),
  });

  const downloadMutation = useMutation({
    mutationFn: () => api.post(`/journals/${slug}/articles/${id}/download`),
  });

  const a = data as any;

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
    </div>
  );

  if (!a) return (
    <div className="max-w-2xl mx-auto text-center py-20">
      <FileText size={48} className="mx-auto mb-4 text-stone-300" />
      <h2 className="font-display text-2xl font-semibold text-stone-700 mb-2">Article not found</h2>
      <Link href={`/journals/${slug}`} className="btn-primary">Back to journal</Link>
    </div>
  );

  const authors: any[] = a.authors?.filter((au: any) => au?.name) ?? [];
  const pubYear = a.published_at ? new Date(a.published_at).getFullYear() : null;

  return (
    <div className="max-w-4xl mx-auto">
      {showCite && <CiteModal article={a} onClose={() => setShowCite(false)} />}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-stone-400 mb-6 flex-wrap">
        <Link href="/journals" className="hover:text-stone-700 transition-colors">Journals</Link>
        <span>/</span>
        <Link href={`/journals/${slug}`} className="hover:text-stone-700 transition-colors">{a.journal_title}</Link>
        {a.volume_no && (
          <>
            <span>/</span>
            <Link href={`/journals/${slug}?volume=${a.volume_no}`}
              className="hover:text-stone-700 transition-colors">
              Vol. {a.volume_no}{a.issue_no ? `, No. ${a.issue_no}` : ''} ({a.year})
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-stone-500 truncate max-w-xs">{a.title}</span>
      </nav>

      <div className="grid lg:grid-cols-[1fr_260px] gap-6">
        {/* Main content */}
        <div className="space-y-5">
          {/* Title + metadata */}
          <div className="card p-6">
            {/* Journal banner */}
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={13} className="text-primary-700" />
              <Link href={`/journals/${slug}`}
                className="text-xs text-primary-700 hover:underline font-medium">
                {a.journal_title}
              </Link>
              {a.issn_online && (
                <span className="text-xs text-stone-400 font-mono">ISSN {a.issn_online}</span>
              )}
            </div>

            <h1 className="font-display text-2xl font-semibold text-stone-900 mb-4 leading-snug">
              {a.title}
            </h1>

            {/* Authors */}
            {authors.length > 0 && (
              <div className="mb-4">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {authors.map((au: any, i: number) => (
                    <div key={i} className="text-sm">
                      <span className={`font-medium ${au.corresponding ? 'text-primary-800' : 'text-stone-800'}`}>
                        {au.name}
                        {au.corresponding && <sup className="text-primary-600 ml-0.5">*</sup>}
                      </span>
                      {au.orcid && (
                        <a href={`https://orcid.org/${au.orcid}`} target="_blank" rel="noopener noreferrer"
                          className="ml-1 text-[#a6ce39] hover:opacity-80" title="ORCID profile">
                          <span className="text-xs font-mono">[ORCID]</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                {authors.some(au => au.affiliation) && (
                  <div className="mt-2 space-y-0.5">
                    {authors.filter(au => au.affiliation).map((au: any, i: number) => (
                      <p key={i} className="text-xs text-stone-500 italic">{au.affiliation}</p>
                    ))}
                  </div>
                )}
                {authors.some(au => au.corresponding) && (
                  <p className="text-xs text-stone-400 mt-1">
                    <sup>*</sup> Corresponding author
                  </p>
                )}
              </div>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone-500 pb-4 border-b border-stone-100 mb-4">
              {a.published_at && (
                <span className="flex items-center gap-1">
                  <Calendar size={11} />
                  Published {new Date(a.published_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              )}
              {a.volume_no && (
                <span className="flex items-center gap-1">
                  <BookOpen size={11} />
                  Vol. {a.volume_no}{a.issue_no ? `, No. ${a.issue_no}` : ''}{pubYear ? ` (${pubYear})` : ''}
                </span>
              )}
              {a.pages && (
                <span className="flex items-center gap-1">
                  <FileText size={11} /> pp. {a.pages}
                </span>
              )}
              {a.article_no && (
                <span className="flex items-center gap-1">
                  <Hash size={11} /> Article {a.article_no}
                </span>
              )}
            </div>

            {/* DOI */}
            {a.doi && (
              <div className="mb-4">
                <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-1">DOI</p>
                <a href={`https://doi.org/${a.doi}`} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-mono text-primary-700 hover:underline flex items-center gap-1">
                  https://doi.org/{a.doi} <ExternalLink size={11} />
                </a>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {a.manuscript_file_url && (
                <a href={a.manuscript_file_url} target="_blank" rel="noopener noreferrer"
                  onClick={() => downloadMutation.mutate()}
                  className="btn-primary btn-sm gap-1.5">
                  <Download size={13} /> Download PDF
                </a>
              )}
              <button onClick={() => setShowCite(true)}
                className="btn-secondary btn-sm gap-1.5">
                <FileText size={13} /> Cite this article
              </button>
              <button onClick={copyLink}
                className="btn-secondary btn-sm gap-1.5">
                {copiedLink ? <><Check size={13} /> Copied!</> : <><Link2 size={13} /> Copy link</>}
              </button>
            </div>
          </div>

          {/* Abstract */}
          {a.abstract && (
            <div className="card p-6">
              <h2 className="font-display font-semibold text-stone-900 mb-3">Abstract</h2>
              <p className="text-stone-700 text-sm leading-relaxed">{a.abstract}</p>
            </div>
          )}

          {/* Keywords */}
          {a.keywords?.length > 0 && (
            <div className="card p-5">
              <h3 className="font-display font-semibold text-stone-900 mb-3 text-sm">Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {a.keywords.map((k: string) => (
                  <Link key={k}
                    href={`/journals/${slug}?search=${encodeURIComponent(k)}`}
                    className="badge badge-stone text-xs hover:bg-primary-50 hover:text-primary-800 hover:border-primary-200 transition-colors">
                    {k}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Related articles */}
          {a.related?.length > 0 && (
            <div className="card p-5">
              <h3 className="font-display font-semibold text-stone-900 mb-3">Related articles</h3>
              <div className="space-y-3">
                {a.related.map((r: any) => (
                  <Link key={r.id} href={`/journals/${slug}/articles/${r.id}`}
                    className="block p-3 rounded-xl hover:bg-stone-50 transition-colors group">
                    <p className="text-sm font-medium text-stone-900 group-hover:text-primary-700 line-clamp-2 mb-1">
                      {r.title}
                    </p>
                    <p className="text-xs text-stone-400">
                      {(r.author_names || [r.author_name]).filter(Boolean).join(', ')}
                      {r.published_at && ` · ${new Date(r.published_at).getFullYear()}`}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Article metrics */}
          <div className="card p-4">
            <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-3">Article metrics</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-stone-600">
                  <Eye size={14} className="text-stone-400" /> Views
                </span>
                <span className="font-semibold text-stone-900 text-sm">{(a.view_count ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-stone-600">
                  <Download size={14} className="text-stone-400" /> Downloads
                </span>
                <span className="font-semibold text-stone-900 text-sm">{(a.download_count ?? 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Journal info */}
          <div className="card p-4">
            <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-3">Published in</p>
            <Link href={`/journals/${slug}`}
              className="flex items-start gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                <BookOpen size={14} className="text-primary-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-stone-900 group-hover:text-primary-700 transition-colors leading-snug">
                  {a.journal_title}
                </p>
                {(a.issn_print || a.issn_online) && (
                  <p className="text-xs text-stone-400 font-mono mt-0.5">
                    ISSN {a.issn_online || a.issn_print}
                  </p>
                )}
              </div>
            </Link>
            {a.volume_no && (
              <div className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-500 space-y-1">
                <div><span className="text-stone-400">Volume:</span> {a.volume_no} ({a.year})</div>
                {a.issue_no && <div><span className="text-stone-400">Issue:</span> {a.issue_no}</div>}
                {a.pages && <div><span className="text-stone-400">Pages:</span> {a.pages}</div>}
              </div>
            )}
            <Link href={`/journals/${slug}`}
              className="mt-3 btn-secondary btn-sm w-full justify-center text-xs">
              View all issues
            </Link>
          </div>

          {/* Share / actions */}
          <div className="card p-4">
            <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-3">Share</p>
            <div className="space-y-2">
              <button onClick={copyLink}
                className="flex items-center gap-2 w-full text-sm text-stone-600 hover:text-stone-900 transition-colors">
                <Link2 size={14} className="text-stone-400" />
                {copiedLink ? 'Link copied!' : 'Copy article link'}
              </button>
              {a.doi && (
                <a href={`https://doi.org/${a.doi}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full text-sm text-stone-600 hover:text-stone-900 transition-colors">
                  <ExternalLink size={14} className="text-stone-400" /> View via DOI
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
