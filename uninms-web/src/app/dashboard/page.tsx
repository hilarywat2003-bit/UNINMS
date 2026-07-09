'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { analyticsApi, documentsApi, coursesApi, forumsApi, researchApi, groupsApi, intelligenceApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { BookOpen, Eye, Download, Award, ArrowUpRight, X, FileText, BookMarked, Star, Plus, Users, Loader2, Copy, Check, BarChart3, TrendingUp, Globe, Brain, Lightbulb, FlaskConical, UserCheck } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

// â”€â”€ Shared helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const greeting = (() => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
})();

function DocRow({ doc }: { doc: any }) {
  return (
    <Link href={`/repository/${doc.id}`}
      className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-stone-50 transition-colors group">
      <FileText size={14} className="text-stone-400 flex-shrink-0" />
      <span className="flex-1 text-sm text-stone-700 truncate group-hover:text-primary-700">{doc.title}</span>
      <span className="text-xs text-stone-400 flex-shrink-0 flex items-center gap-3">
        <span className="flex items-center gap-1"><Eye size={10} />{doc.view_count ?? 0}</span>
        <span className="flex items-center gap-1"><Download size={10} />{doc.download_count ?? 0}</span>
      </span>
    </Link>
  );
}

// â”€â”€ Student dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StudentDashboard({ firstName }: { firstName: string }) {
  const { data: meData }     = useQuery({ queryKey: ['analytics','me'],  queryFn: () => analyticsApi.me() });
  const { data: coursesData }= useQuery({ queryKey: ['courses'],         queryFn: () => coursesApi.list() });
  const { data: docsData }   = useQuery({
    queryKey: ['documents','recent-student'],
    queryFn:  () => documentsApi.list({ limit: 5, sortBy: 'published_at' }),
  });

  const me      = meData?.data as any;
  const courses = (coursesData?.data as any)?.courses ?? [];
  const docs    = (docsData?.data as any)?.documents ?? [];
  const level   = me?.level;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Greeting */}
      <div className="mb-6">
        <h2 className="font-display text-2xl font-semibold text-stone-900">{greeting}, {firstName} ðŸ‘‹</h2>
        <p className="text-stone-500 mt-1 text-sm">
          {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Courses */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-stone-900">My courses</h3>
              <Link href="/courses" className="text-xs text-primary-700 hover:underline flex items-center gap-1">
                View all <ArrowUpRight size={12} />
              </Link>
            </div>
            {courses.length === 0 ? (
              <div className="py-8 text-center">
                <BookMarked size={28} className="mx-auto mb-2 text-stone-300" />
                <p className="text-sm text-stone-400">No courses yet</p>
                <Link href="/courses" className="btn-primary mt-3 inline-flex text-sm">Join a course</Link>
              </div>
            ) : (
              <div className="space-y-1">
                {courses.slice(0, 4).map((c: any) => (
                  <Link key={c.id} href={`/courses/${c.id}`}
                    className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-stone-50 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                      <BookMarked size={13} className="text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate group-hover:text-primary-700">{c.title}</p>
                      {c.course_code && <p className="text-xs text-stone-400">{c.course_code}</p>}
                    </div>
                    <ArrowUpRight size={13} className="text-stone-300 group-hover:text-primary-500 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent documents */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-stone-900">New in repository</h3>
              <Link href="/repository" className="text-xs text-primary-700 hover:underline flex items-center gap-1">
                Browse all <ArrowUpRight size={12} />
              </Link>
            </div>
            {docs.length === 0 ? (
              <div className="py-8 text-center text-stone-400">
                <BookOpen size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No documents yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {docs.map((doc: any) => <DocRow key={doc.id} doc={doc} />)}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Knowledge points */}
          {level && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Star size={15} className="text-gold-500" />
                <h3 className="font-display font-semibold text-stone-900">Knowledge points</h3>
              </div>
              <p className="text-3xl font-display font-semibold text-stone-900">
                {(level.total_points ?? 0).toLocaleString()}
              </p>
              <div className="flex items-center justify-between mt-1 mb-2">
                <span className="badge badge-gold text-xs">{level.current_level}</span>
                {level.points_to_next && (
                  <span className="text-xs text-stone-400">{level.points_to_next} to {level.next_level}</span>
                )}
              </div>
              <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full bg-gold-400 rounded-full" style={{ width: '35%' }} />
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="card p-5">
            <h3 className="font-display font-semibold text-stone-900 mb-3">Quick links</h3>
            <div className="space-y-1">
              {[
                { label: 'Search repository', href: '/repository' },
                { label: 'My courses', href: '/courses' },
                { label: 'Browse forums', href: '/forums' },
                { label: 'Find a mentor', href: '/mentorship' },
              ].map(a => (
                <Link key={a.href} href={a.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-50 hover:text-primary-700 transition-colors">
                  <ArrowUpRight size={13} className="text-stone-400" /> {a.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Researcher dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ActiveStat = 'publications' | 'views' | 'downloads' | null;

function StatCard({ label, value, icon: Icon, color = 'green', active, onClick }: {
  label: string; value: number | string; icon: React.ElementType;
  color?: string; active?: boolean; onClick?: () => void;
}) {
  const cls = { green: 'bg-primary-50 text-primary-700', gold: 'bg-gold-50 text-gold-600', blue: 'bg-blue-50 text-blue-700', purple: 'bg-purple-50 text-purple-700' }[color] ?? 'bg-stone-100 text-stone-600';
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`stat-card text-left w-full transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''} ${active ? 'ring-2 ring-primary-500 ring-offset-1' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-stone-500 uppercase tracking-wide font-medium">{label}</p>
          <p className="text-3xl font-display font-semibold text-stone-900 mt-1">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cls}`}>
          <Icon size={18} />
        </div>
      </div>
      {onClick && <p className="text-xs text-primary-600 mt-2 flex items-center gap-1">View details <ArrowUpRight size={10} /></p>}
    </button>
  );
}

function QuickCreateCourseModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', courseCode: '', semester: '', level: '', description: '' });
  const mutation = useMutation({
    mutationFn: () => coursesApi.create(form),
    onSuccess: () => {
      toast.success('Course created!');
      qc.invalidateQueries({ queryKey: ['courses'] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed to create course'),
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card-md w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-xl font-semibold text-stone-900">Create course</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input value={form.title} onChange={set('title')} placeholder="Course title *" className="input" autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.courseCode} onChange={set('courseCode')} placeholder="Course code (e.g. CSC301)" className="input" />
            <select value={form.level} onChange={set('level')} className="input">
              <option value="">Level</option>
              {['100','200','300','400','500','600'].map(l => <option key={l} value={l}>{l} level</option>)}
            </select>
          </div>
          <select value={form.semester} onChange={set('semester')} className="input">
            <option value="">Semester</option>
            <option value="First">First semester</option>
            <option value="Second">Second semester</option>
          </select>
          <textarea value={form.description} onChange={set('description')} placeholder="Description (optional)" className="input" rows={3} />
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!form.title.trim() || mutation.isPending} className="btn-primary flex-1">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={14} />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function LecturerDashboard({ firstName }: { firstName: string }) {
  const [showCreate, setShowCreate] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesApi.list(),
  });
  const { data: docsData, isLoading: docsLoading } = useQuery({
    queryKey: ['documents', 'recent-lecturer'],
    queryFn: () => documentsApi.list({ limit: 5, sortBy: 'published_at' }),
  });
  const { data: meData } = useQuery({ queryKey: ['analytics', 'me'], queryFn: () => analyticsApi.me() });
  const { data: gapsData, isLoading: gapsLoading } = useQuery({
    queryKey: ['intelligence', 'gaps', 'recommended', 'dashboard'],
    queryFn:  () => intelligenceApi.recommendedGaps(5),
  });
  const { data: collabData, isLoading: collabLoading } = useQuery({
    queryKey: ['intelligence', 'collaborators', 'dashboard'],
    queryFn:  () => intelligenceApi.collaborators(5),
  });

  const courses = (coursesData?.data as any)?.courses ?? [];
  const docs    = (docsData?.data as any)?.documents ?? [];
  const me      = meData?.data as any;
  const totalDocs  = me?.documents?.reduce((a: number, d: any) => a + parseInt(d.count ?? 0), 0) ?? 0;
  const totalViews = me?.documents?.reduce((a: number, d: any) => a + parseInt(d.total_views ?? 0), 0) ?? 0;
  const recommendedGaps = (gapsData?.data as any) ?? [];
  const gapsTotal    = recommendedGaps.length;
  const topGap       = recommendedGaps[0];
  const collabCount  = ((collabData?.data as any) ?? []).length;
  const insightsLoading = gapsLoading || collabLoading;

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success('Course ID copied â€” share with students');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Greeting */}
      <div className="mb-6">
        <h2 className="font-display text-2xl font-semibold text-stone-900">{greeting}, {firstName} ðŸ‘‹</h2>
        <p className="text-stone-500 mt-1 text-sm">
          {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Courses', value: courses.length, color: 'bg-primary-50 text-primary-700' },
          { label: 'Publications', value: totalDocs, color: 'bg-blue-50 text-blue-700' },
          { label: 'Total views', value: totalViews, color: 'bg-purple-50 text-purple-700' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <p className="text-xs text-stone-500 uppercase tracking-wide font-medium">{s.label}</p>
            <p className="text-3xl font-display font-semibold text-stone-900 mt-1">{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* My courses */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-stone-900">My courses</h3>
            <div className="flex items-center gap-2">
              <Link href="/courses" className="text-xs text-primary-700 hover:underline flex items-center gap-1">
                View all <ArrowUpRight size={12} />
              </Link>
              <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
                <Plus size={13} /> New course
              </button>
            </div>
          </div>

          {coursesLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 skeleton" />)}</div>
          ) : courses.length === 0 ? (
            <div className="py-10 text-center">
              <BookMarked size={28} className="mx-auto mb-2 text-stone-300" />
              <p className="text-sm text-stone-400 mb-3">No courses yet</p>
              <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
                <Plus size={14} /> Create your first course
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {courses.slice(0, 5).map((c: any) => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-stone-100 hover:border-stone-200 hover:bg-stone-50 transition-all group">
                  <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <BookMarked size={15} className="text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800 truncate">{c.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.course_code && <span className="text-xs text-stone-400 font-mono">{c.course_code}</span>}
                      {c.level && <span className="text-xs text-stone-400">{c.level} level</span>}
                      <span className="flex items-center gap-1 text-xs text-stone-400">
                        <Users size={10} />{c.enrolled_count ?? 0} student{c.enrolled_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => copyId(c.id)} title="Copy course ID to share with students"
                      className="p-1.5 rounded-lg text-stone-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                      {copiedId === c.id ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                    </button>
                    <Link href={`/courses/${c.id}`}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                      <ArrowUpRight size={13} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* AI Insights summary */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Brain size={15} className="text-primary-600" />
                <h3 className="font-display font-semibold text-stone-900 text-sm">AI Insights</h3>
              </div>
              <Link href="/intelligence" className="text-xs text-primary-700 hover:underline flex items-center gap-1">
                Explore <ArrowUpRight size={12} />
              </Link>
            </div>
            {insightsLoading ? (
              <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-10 skeleton" />)}</div>
            ) : (
              <div className="space-y-3">
                <Link href="/intelligence?tab=gaps" className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                    <Lightbulb size={13} className="text-red-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-800 group-hover:text-primary-700">
                      {gapsTotal} gap{gapsTotal !== 1 ? 's' : ''} match your interests
                    </p>
                    <p className="text-xs text-stone-400 truncate">
                      {topGap?.research_area ?? 'Based on your published research areas'}
                    </p>
                  </div>
                </Link>
                <Link href="/intelligence?tab=researchers" className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <Users size={13} className="text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-800 group-hover:text-primary-700">
                      {collabCount} potential collaborator{collabCount !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-stone-400">Matched by shared research tags</p>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="card p-5">
            <h3 className="font-display font-semibold text-stone-900 mb-3">Quick actions</h3>
            <div className="space-y-1">
              {[
                { label: 'Create a course', action: () => setShowCreate(true) },
                { label: 'Upload material', href: '/repository/upload' },
                { label: 'My repository', href: '/repository' },
                { label: 'Research pipeline', href: '/research' },
                { label: 'Browse forums', href: '/forums' },
              ].map(a => (
                a.href
                  ? <Link key={a.label} href={a.href}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-50 hover:text-primary-700 transition-colors">
                      <ArrowUpRight size={13} className="text-stone-400" /> {a.label}
                    </Link>
                  : <button key={a.label} onClick={a.action}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-50 hover:text-primary-700 transition-colors">
                      <ArrowUpRight size={13} className="text-stone-400" /> {a.label}
                    </button>
              ))}
            </div>
          </div>

          {/* Recent uploads */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-stone-900 text-sm">Recent uploads</h3>
              <Link href="/repository" className="text-xs text-primary-700 hover:underline">View all</Link>
            </div>
            {docsLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 skeleton" />)}</div>
            ) : docs.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-4">No uploads yet</p>
            ) : (
              <div className="space-y-1">
                {docs.map((doc: any) => (
                  <Link key={doc.id} href={`/repository/${doc.id}`}
                    className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-stone-50 group transition-colors">
                    <FileText size={12} className="text-stone-400 flex-shrink-0" />
                    <span className="text-xs text-stone-600 truncate group-hover:text-primary-700">{doc.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreate && <QuickCreateCourseModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

// â”€â”€ Management dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ManagementDashboard({ firstName }: { firstName: string }) {
  const { data: uniData }  = useQuery({ queryKey: ['analytics','university'], queryFn: () => analyticsApi.university() });
  const { data: docsData } = useQuery({
    queryKey: ['documents','recent-mgmt'],
    queryFn:  () => documentsApi.list({ limit: 5, sortBy: 'published_at' }),
  });

  const uni  = uniData?.data as any;
  const docs = (docsData?.data as any)?.documents ?? [];

  const kpis = [
    { label: 'Total users',   value: uni?.users?.total_users      ?? 'â€”', icon: Users,      color: 'bg-primary-50 text-primary-700' },
    { label: 'Documents',     value: uni?.documents?.total_documents ?? 'â€”', icon: BookOpen,   color: 'bg-blue-50 text-blue-700' },
    { label: 'Citations',     value: uni?.documents?.total_citations  ?? 'â€”', icon: TrendingUp, color: 'bg-purple-50 text-purple-700' },
    { label: 'Submissions',   value: uni?.submissions?.total_submissions ?? 'â€”', icon: FileText,   color: 'bg-gold-50 text-gold-600' },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Greeting */}
      <div className="mb-6">
        <h2 className="font-display text-2xl font-semibold text-stone-900">{greeting}, {firstName} ðŸ‘‹</h2>
        <p className="text-stone-500 mt-1 text-sm">
          {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map(k => (
          <div key={k.label} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wide font-medium">{k.label}</p>
                <p className="text-3xl font-display font-semibold text-stone-900 mt-1">
                  {typeof k.value === 'number' ? k.value.toLocaleString() : k.value}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${k.color}`}>
                <k.icon size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Users by role */}
        <div className="card p-5">
          <h3 className="font-display font-semibold text-stone-900 mb-4">Users by role</h3>
          {uni?.users?.by_role?.length > 0 ? (
            <div className="space-y-2">
              {(uni.users.by_role as any[]).map((r: any) => {
                const total = uni.users.total_users || 1;
                const pct   = Math.round((r.count / total) * 100);
                return (
                  <div key={r.role}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-stone-600 capitalize">{r.role.replace('_', ' ')}</span>
                      <span className="text-xs text-stone-400">{parseInt(r.count).toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-stone-400 text-center py-6">No data yet</p>
          )}
        </div>

        {/* Recent documents */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-stone-900">Recent in repository</h3>
            <Link href="/repository" className="text-xs text-primary-700 hover:underline flex items-center gap-1">
              View all <ArrowUpRight size={12} />
            </Link>
          </div>
          {docs.length === 0 ? (
            <div className="py-8 text-center text-stone-400">
              <BookOpen size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No documents yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {docs.map((doc: any) => <DocRow key={doc.id} doc={doc} />)}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card p-5 mt-5">
        <h3 className="font-display font-semibold text-stone-900 mb-3">Quick actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Full analytics',    href: '/dashboard/analytics', icon: BarChart3 },
            { label: 'Repository',        href: '/repository',          icon: BookOpen },
            { label: 'Implementation claims', href: '/claims',          icon: Award },
            { label: 'National hub',      href: '/national',            icon: Globe },
          ].map(a => (
            <Link key={a.href} href={a.href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-stone-50 hover:bg-primary-50 hover:text-primary-700 text-stone-600 transition-colors text-center">
              <a.icon size={20} className="text-stone-400 group-hover:text-primary-600" />
              <span className="text-xs font-medium leading-tight">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Community / Industry dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CommunityDashboard({ firstName }: { firstName: string }) {
  const { data: docsData } = useQuery({
    queryKey: ['documents', 'recent-community'],
    queryFn:  () => documentsApi.list({ limit: 5, sortBy: 'published_at' }),
  });
  const { data: threadsData } = useQuery({
    queryKey: ['forums', 'threads', 'recent'],
    queryFn:  () => forumsApi.threads({ limit: 5 } as any),
  });

  const docs    = (docsData?.data as any)?.documents ?? [];
  const threads = (threadsData?.data as any)?.threads ?? [];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="font-display text-2xl font-semibold text-stone-900">{greeting}, {firstName} ðŸ‘‹</h2>
        <p className="text-stone-500 mt-1 text-sm">
          {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Recent research */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-stone-900">Latest research</h3>
              <Link href="/repository" className="text-xs text-primary-700 hover:underline flex items-center gap-1">
                Browse all <ArrowUpRight size={12} />
              </Link>
            </div>
            {docs.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-6">No documents yet</p>
            ) : (
              <div className="space-y-1">
                {docs.map((doc: any) => <DocRow key={doc.id} doc={doc} />)}
              </div>
            )}
          </div>

          {/* Recent forum threads */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-stone-900">Forum discussions</h3>
              <Link href="/forums" className="text-xs text-primary-700 hover:underline flex items-center gap-1">
                View all <ArrowUpRight size={12} />
              </Link>
            </div>
            {threads.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-6">No threads yet</p>
            ) : (
              <div className="space-y-1">
                {threads.map((t: any) => (
                  <Link key={t.id} href={`/forums/${t.id}`}
                    className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-stone-50 transition-colors group">
                    <FileText size={14} className="text-stone-400 flex-shrink-0" />
                    <span className="flex-1 text-sm text-stone-700 truncate group-hover:text-primary-700">{t.title}</span>
                    <span className="text-xs text-stone-400 flex-shrink-0">{t.reply_count} replies</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div className="card p-5">
          <h3 className="font-display font-semibold text-stone-900 mb-3">Quick links</h3>
          <div className="space-y-1">
            {[
              { label: 'Browse research', href: '/repository' },
              { label: 'Implementation claims', href: '/claims' },
              { label: 'National hub', href: '/national' },
              { label: 'Join a discussion', href: '/forums' },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-50 hover:text-primary-700 transition-colors">
                <ArrowUpRight size={13} className="text-stone-400" /> {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Root export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function DashboardPage() {
  const { user } = useAuthStore();
  const firstName  = user?.fullName?.split(' ')[0] ?? 'there';
  const roles      = user?.roles ?? [];
  const isStudent    = !roles.some(r => ['lecturer','admin','management','super_admin','community_rep','industry_partner'].includes(r));
  const isLecturer   = roles.includes('lecturer') && !roles.some(r => ['admin','management','super_admin'].includes(r));
  const isManagement = roles.includes('management') && !roles.includes('super_admin');
  const isCommunity  = roles.some(r => ['community_rep','industry_partner'].includes(r)) && !roles.some(r => ['admin','management','super_admin','lecturer'].includes(r));

  if (isStudent)    return <StudentDashboard firstName={firstName} />;
  if (isLecturer)   return <LecturerDashboard firstName={firstName} />;
  if (isManagement) return <ManagementDashboard firstName={firstName} />;
  if (isCommunity)  return <CommunityDashboard firstName={firstName} />;
  return <LecturerDashboard firstName={firstName} />;
}
