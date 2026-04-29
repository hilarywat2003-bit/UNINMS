'use client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { documentsApi } from '@/lib/api';
import { useParams } from 'next/navigation';
import { Download, Eye, Quote, BookOpen, ArrowLeft, Share2, Tag, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth.store';

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['document', id],
    queryFn:  () => documentsApi.get(id),
    enabled:  !!id,
  });

  const doc = data?.data as any;
  const canCheckPlagiarism = user && (
    doc?.uploader_id === user.id ||
    user.roles?.some((r: string) => ['admin', 'super_admin', 'staff', 'lecturer', 'supervisor'].includes(r))
  );

  const downloadMutation = useMutation({
    mutationFn: () => documentsApi.download(id),
    onSuccess: (res: any) => { const url = res?.data?.downloadUrl; if (url) window.open(url, '_blank'); },
    onError: () => toast.error('Download failed or requires login'),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
  );
  if (!doc) return (
    <div className="max-w-3xl mx-auto py-20 text-center">
      <BookOpen size={48} className="mx-auto mb-4 text-stone-300" />
      <h2 className="font-display text-2xl font-semibold text-stone-700 mb-2">Not found</h2>
      <Link href="/repository" className="btn-primary">Back to repository</Link>
    </div>
  );

  const TYPE_BADGE: Record<string, string> = {
    thesis: 'badge-green', research_paper: 'badge-blue',
    lecture_note: 'badge-stone', dataset: 'badge-purple', past_question: 'badge-gold',
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/repository" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 mb-6 transition-colors">
        <ArrowLeft size={14} /> Back to repository
      </Link>

      <div className="grid lg:grid-cols-[1fr_260px] gap-6">
        <div className="space-y-5">
          <div className="card p-6">
            <div className="flex flex-wrap gap-2 mb-3">
              <span className={`badge ${TYPE_BADGE[doc.doc_type] ?? 'badge-stone'}`}>{doc.doc_type?.replace('_',' ')}</span>
              {doc.department_name && <span className="badge-stone badge">{doc.department_name}</span>}
            </div>
            <h1 className="font-display text-2xl font-semibold text-stone-900 leading-tight mb-3">{doc.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-stone-500 mb-4">
              {doc.uploader_name && <span>{doc.uploader_name}</span>}
              {doc.doi && <span className="font-mono text-xs text-primary-700">DOI: {doc.doi}</span>}
            </div>
            <div className="flex items-center gap-5 pt-4 border-t border-stone-100">
              {[{ icon: Eye, value: doc.view_count, label: 'views' },
                { icon: Download, value: doc.download_count, label: 'downloads' },
                { icon: Quote, value: doc.citation_count, label: 'citations' }].map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-sm text-stone-500">
                  <Icon size={14} className="text-stone-400" />
                  <span className="font-medium text-stone-700">{value}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {doc.abstract && (
            <div className="card p-5">
              <h2 className="font-display font-semibold text-stone-900 mb-3">Abstract</h2>
              <p className="text-stone-600 text-sm leading-relaxed">{doc.abstract}</p>
            </div>
          )}

          {doc.tags?.length > 0 && (
            <div className="card p-5">
              <h2 className="font-display font-semibold text-stone-900 mb-3 flex items-center gap-2">
                <Tag size={15} className="text-stone-400" /> Keywords
              </h2>
              <div className="flex flex-wrap gap-2">
                {doc.tags.map((tag: any) => (
                  <Link key={tag.id} href={`/search?q=${encodeURIComponent(tag.name)}`}
                    className="badge-stone badge hover:bg-primary-50 hover:text-primary-700 transition-colors cursor-pointer">
                    {tag.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-4 space-y-2">
            <button onClick={() => downloadMutation.mutate()} disabled={downloadMutation.isPending}
              className="btn-primary w-full">
              {downloadMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Getting link…</> : <><Download size={15} />Download</>}
            </button>
            <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied'); }}
              className="btn-secondary w-full">
              <Share2 size={14} />Share
            </button>
          </div>

          {/* Plagiarism / similarity status */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-3">Similarity check</h3>
            {doc.plagiarism_status && doc.plagiarism_status !== 'unchecked' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {doc.plagiarism_status === 'flagged'
                    ? <ShieldAlert size={16} className="text-red-500 shrink-0" />
                    : doc.plagiarism_status === 'pending'
                      ? <Loader2 size={16} className="animate-spin text-stone-400 shrink-0" />
                      : <ShieldCheck size={16} className="text-green-600 shrink-0" />
                  }
                  <span className="text-sm font-medium text-stone-700 capitalize">
                    {doc.plagiarism_status === 'flagged' ? 'Flagged'
                     : doc.plagiarism_status === 'clear'  ? 'Clear'
                     : doc.plagiarism_status === 'pending' ? 'Checking…'
                     : doc.plagiarism_status}
                  </span>
                  {doc.plagiarism_score != null && doc.plagiarism_status !== 'pending' && (
                    <span className="ml-auto text-xs font-semibold text-stone-600">
                      {Math.round(parseFloat(doc.plagiarism_score) * 100)}%
                    </span>
                  )}
                </div>
                <Link href={`/repository/${id}/plagiarism`}
                  className="block text-center text-xs text-primary-600 hover:text-primary-800 hover:underline py-1">
                  View full report →
                </Link>
              </div>
            ) : canCheckPlagiarism ? (
              <Link href={`/repository/${id}/plagiarism`}
                className="block text-center text-xs text-stone-500 hover:text-stone-800 hover:underline py-1">
                Run similarity check →
              </Link>
            ) : null}
          </div>
          {doc.doi && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">Citation</h3>
              <p className="text-xs text-stone-600 leading-relaxed font-mono break-all">
                {doc.uploader_name} ({doc.published_at ? new Date(doc.published_at).getFullYear() : 'n.d.'}). <em>{doc.title}</em>. doi:{doc.doi}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
