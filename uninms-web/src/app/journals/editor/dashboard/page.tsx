'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useState } from 'react';
import {
  BookOpen, FileText, Clock, CheckCircle2, Users,
  Loader2, AlertCircle, ChevronRight, Globe, Settings, X, Save,
} from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_COLOR: Record<string, string> = {
  active:    'badge-green',
  pending:   'badge-stone',
  suspended: 'badge-red',
};

// ── Journal settings modal ────────────────────────────────────────────────────

function SettingsModal({ journal, onClose }: { journal: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [guidelines,    setGuidelines]    = useState(journal.submission_guidelines ?? '');
  const [instructions,  setInstructions]  = useState(journal.author_instructions   ?? '');

  const { mutate, isPending } = useMutation({
    mutationFn: () => api.patch(`/journals/${journal.slug}/editor/settings`, {
      submissionGuidelines: guidelines || null,
      authorInstructions:   instructions || null,
    }),
    onSuccess: () => {
      toast.success('Journal settings saved');
      queryClient.invalidateQueries({ queryKey: ['my-journals'] });
      onClose();
    },
    onError: () => toast.error('Failed to save settings'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="font-display font-semibold text-stone-900">Journal Settings</h3>
            <p className="text-xs text-stone-400 mt-0.5 truncate max-w-sm">{journal.title}</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Submission Guidelines
            </label>
            <p className="text-xs text-stone-400 mb-2">
              Displayed on the journal's Submit tab. Cover file formats, word limits, review policy, etc.
            </p>
            <textarea
              value={guidelines}
              onChange={e => setGuidelines(e.target.value)}
              rows={8}
              placeholder="e.g. Manuscripts must be original research not published elsewhere. Accepted file formats: PDF, DOCX. Maximum 10,000 words…"
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-y"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Instructions for Authors
            </label>
            <p className="text-xs text-stone-400 mb-2">
              Detailed formatting requirements: referencing style, section headings, figures, tables, ethical statements, etc.
            </p>
            <textarea
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              rows={8}
              placeholder="e.g. Structure: Title, Abstract (250 words), Introduction, Methods, Results, Discussion, Conclusion, References (APA 7th edition)…"
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-y"
            />
          </div>
        </div>

        <div className="p-5 border-t border-stone-100 flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          <button onClick={() => mutate()} disabled={isPending}
            className="btn-primary btn-sm gap-1.5">
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Journal card ──────────────────────────────────────────────────────────────

function JournalCard({ j }: { j: any }) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      {showSettings && <SettingsModal journal={j} onClose={() => setShowSettings(false)} />}

      <div className="card p-5 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
              <BookOpen size={18} className="text-primary-700" />
            </div>
            <div className="min-w-0">
              <p className="font-display font-semibold text-stone-900 text-sm line-clamp-2">{j.title}</p>
              {j.issn_online && (
                <p className="text-xs font-mono text-stone-400 mt-0.5">ISSN {j.issn_online}</p>
              )}
            </div>
          </div>
          <span className={`badge text-xs shrink-0 ${STATUS_COLOR[j.status] ?? 'badge-stone'}`}>
            {j.status}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-lg font-display font-bold text-blue-700">{j.new_count ?? 0}</p>
            <p className="text-xs text-blue-500">New</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 text-center">
            <p className="text-lg font-display font-bold text-amber-700">{j.active_count ?? 0}</p>
            <p className="text-xs text-amber-500">Active</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-lg font-display font-bold text-green-700">{j.published_count ?? 0}</p>
            <p className="text-xs text-green-500">Published</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/editor/${j.slug}`}
            className="btn-primary btn-sm text-xs flex-1 justify-center">
            <FileText size={12} /> Manage manuscripts
          </Link>
          <button onClick={() => setShowSettings(true)}
            className="btn-secondary btn-sm text-xs" title="Journal settings">
            <Settings size={12} />
          </button>
          <Link href={`/journals/${j.slug}`} target="_blank"
            className="btn-secondary btn-sm text-xs" title="View public journal page">
            <Globe size={12} />
          </Link>
        </div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EditorDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-journals'],
    queryFn: () => api.get('/journals/editor/my-journals').then(r => r.data.data),
  });

  const journals: any[] = data ?? [];

  const totalNew       = journals.reduce((s: number, j: any) => s + (j.new_count       ?? 0), 0);
  const totalActive    = journals.reduce((s: number, j: any) => s + (j.active_count    ?? 0), 0);
  const totalPublished = journals.reduce((s: number, j: any) => s + (j.published_count ?? 0), 0);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl p-6 mb-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#09432c 0%,#0d6b44 100%)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 50%,#d4a017,transparent 60%)' }} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={16} className="text-primary-300" />
            <span className="text-primary-300 text-sm">Journals · Editor Dashboard</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-white mb-1">My Journals</h1>
          <p className="text-white/60 text-sm">
            Manage manuscripts, assign reviewers, and publish articles for your assigned journals.
          </p>
        </div>
      </div>

      {/* Summary stats */}
      {journals.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'New submissions',  value: totalNew,       icon: Clock,        color: 'text-blue-700 bg-blue-50' },
            { label: 'Under management', value: totalActive,    icon: Users,        color: 'text-amber-700 bg-amber-50' },
            { label: 'Published',        value: totalPublished, icon: CheckCircle2, color: 'text-green-700 bg-green-50' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-stone-500 uppercase tracking-wide">{s.label}</p>
                  <p className="text-2xl font-display font-semibold text-stone-900 mt-0.5">{s.value}</p>
                </div>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}>
                  <s.icon size={16} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Journals grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
        </div>
      ) : journals.length === 0 ? (
        <div className="card p-16 text-center">
          <AlertCircle size={36} className="mx-auto mb-3 text-stone-300" />
          <h3 className="font-display font-semibold text-stone-700 mb-1">No journals assigned</h3>
          <p className="text-stone-400 text-sm">
            You have not been assigned as editor for any journal yet.
            Contact your IT Administrator to get assigned.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {journals.map((j: any) => <JournalCard key={j.id} j={j} />)}
        </div>
      )}

      {/* Quick links */}
      {journals.length > 0 && (
        <div className="mt-6 card p-5">
          <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-3">Quick access</p>
          <div className="space-y-1">
            {journals.filter((j: any) => j.new_count > 0).map((j: any) => (
              <Link key={j.id} href={`/editor/${j.slug}?status=submitted`}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-stone-50 transition-colors group">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="text-sm text-stone-700 truncate">{j.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="badge badge-blue text-xs">{j.new_count} new</span>
                  <ChevronRight size={13} className="text-stone-300 group-hover:text-stone-500 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
