'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { BookOpen, FileText, Users, ArrowLeft, Send, ChevronDown, ChevronRight, Globe, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

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
              {issue.published_at ? new Date(issue.published_at).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' }) : 'Published'}
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
              <div key={article.id} className="p-4 hover:bg-white transition-colors">
                <p className="font-medium text-stone-900 text-sm mb-1 hover:text-primary-700 cursor-pointer">
                  {article.title}
                </p>
                <p className="text-xs text-stone-500 mb-2">
                  {article.authors?.filter(Boolean).map((a: any) => a.name).join(', ') || article.author_name}
                </p>
                {article.abstract && (
                  <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed">{article.abstract}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  {article.pages && <span className="text-xs text-stone-400">pp. {article.pages}</span>}
                  {article.doi && (
                    <a href={`https://doi.org/${article.doi}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary-700 hover:underline font-mono">
                      DOI: {article.doi}
                    </a>
                  )}
                  {article.keywords?.slice(0,3).map((k: string) => (
                    <span key={k} className="badge-stone badge text-xs">{k}</span>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default function JournalHomePage() {
  const { slug } = useParams<{ slug: string }>();
  const [tab, setTab] = useState<'articles'|'about'|'board'>('articles');

  const { data, isLoading } = useQuery({
    queryKey: ['journal', slug],
    queryFn: () => api.get(`/journals/${slug}`).then(r => r.data.data),
    enabled: !!slug,
  });

  const j = data as any;

  if (isLoading) return (
    <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
  );
  if (!j) return (
    <div className="max-w-2xl mx-auto text-center py-20">
      <BookOpen size={48} className="mx-auto mb-4 text-stone-300" />
      <h2 className="font-display text-2xl font-semibold text-stone-700 mb-2">Journal not found</h2>
      <Link href="/journals" className="btn-primary">Browse journals</Link>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      <Link href="/journals" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 mb-6 transition-colors">
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
            <p className="text-stone-500 text-sm">{j.university_name}{j.department_name ? ` · ${j.department_name}` : ''}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {j.is_open_access && <span className="badge-green badge">Open Access</span>}
              <span className="badge-stone badge capitalize">{j.frequency}</span>
              <span className="badge-stone badge capitalize">{j.review_type?.replace('_',' ')}</span>
              {j.language && j.language !== 'English' && <span className="badge-stone badge">{j.language}</span>}
            </div>
          </div>
          <Link href={`/journals/${slug}/submit`} className="btn-primary flex-shrink-0">
            <Send size={14} /> Submit manuscript
          </Link>
        </div>

        {/* ISSN row */}
        {(j.issn_print || j.issn_online) && (
          <div className="flex gap-6 mt-4 pt-4 border-t border-stone-100 text-sm text-stone-500">
            {j.issn_print  && <span><span className="font-medium text-stone-700">Print ISSN:</span> {j.issn_print}</span>}
            {j.issn_online && <span><span className="font-medium text-stone-700">Online ISSN:</span> {j.issn_online}</span>}
            {j.editor_name && <span><span className="font-medium text-stone-700">Editor-in-Chief:</span> {j.editor_name}</span>}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {(['articles','about','board'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all
              ${tab===t ? 'bg-primary-800 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
            {t === 'board' ? 'Editorial Board' : t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {/* Articles tab */}
      {tab === 'articles' && (
        <div className="space-y-4">
          {!j.volumes?.length ? (
            <div className="card p-12 text-center">
              <FileText size={36} className="mx-auto mb-3 text-stone-300" />
              <h3 className="font-display font-semibold text-stone-700 mb-1">No issues published yet</h3>
              <p className="text-stone-400 text-sm">Submit your manuscript to be among the first.</p>
              <Link href={`/journals/${slug}/submit`} className="btn-primary mt-4 inline-flex">Submit manuscript</Link>
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

      {/* About tab */}
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
                { label: 'Publisher', value: j.university_name },
                { label: 'Department', value: j.department_name },
                { label: 'Frequency', value: j.frequency },
                { label: 'Review Type', value: j.review_type?.replace('_',' ') },
                { label: 'Language', value: j.language },
                { label: 'Access', value: j.is_open_access ? 'Open Access (free to read)' : 'Subscription' },
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
                  {j.subjects.map((s: string) => <span key={s} className="badge-stone badge">{s}</span>)}
                </div>
              </div>
            )}
            {j.indexing?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-stone-100">
                <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-2">Indexed in</p>
                <div className="flex flex-wrap gap-2">
                  {j.indexing.map((i: string) => <span key={i} className="badge-blue badge">{i}</span>)}
                </div>
              </div>
            )}
          </div>
          <div className="card p-5">
            <h3 className="font-display font-semibold text-stone-900 mb-3">OAI-PMH Metadata</h3>
            <p className="text-sm text-stone-600 mb-3">This journal exposes metadata for harvesting by Google Scholar, AJOL, and other academic indexers.</p>
            <code className="text-xs bg-stone-100 rounded-lg p-3 block text-stone-700 break-all">
              {typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/journals/oai?verb=ListRecords&set={slug}
            </code>
          </div>
        </div>
      )}

      {/* Board tab */}
      {tab === 'board' && (
        <div className="card p-5">
          {!j.board?.length ? (
            <p className="text-stone-400 text-sm text-center py-8">Editorial board not yet configured.</p>
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
