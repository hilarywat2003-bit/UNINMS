'use client';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { researchApi, intelligenceApi, usersApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';
import {
  FlaskConical, Plus, ChevronRight, Users, CheckSquare, FileText,
  Lightbulb, Brain, X, Loader2, Target, Calendar, DollarSign,
  Search, Trash2, ExternalLink, ArrowRight, BarChart3, BookOpen,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
type Stage = 'idea' | 'proposal' | 'active' | 'review' | 'published';
type ResearchType = 'basic' | 'applied' | 'action' | 'policy' | 'development';
type OutputType = 'paper' | 'dataset' | 'patent' | 'report' | 'presentation' | 'software';
type MemberRole = 'lead' | 'co-lead' | 'collaborator' | 'advisor' | 'student';

interface Project {
  id: string; title: string; abstract?: string;
  research_type: ResearchType; stage: Stage;
  lead_id: string; lead_name: string; lead_photo?: string;
  department_name?: string;
  start_date?: string; target_end_date?: string; actual_end_date?: string;
  funding_source?: string; funding_amount?: number;
  keywords?: string[]; ethical_approval: boolean; is_public: boolean;
  member_count?: number; milestone_count?: number; done_count?: number; output_count?: number;
  members?: Member[]; milestones?: Milestone[]; outputs?: Output[];
}
interface Member {
  user_id: string; full_name: string; profile_photo_url?: string;
  department_name?: string; role: MemberRole; joined_at: string;
}
interface Milestone {
  id: string; title: string; description?: string;
  due_date?: string; is_done: boolean; completed_at?: string;
}
interface Output {
  id: string; output_type: OutputType; title?: string;
  doc_title?: string; external_url?: string; published_at?: string;
}
interface Gap { id: string; gap_description: string; research_area?: string; priority_score: number; }

// ── Constants ──────────────────────────────────────────────────────────────────
const STAGES: { key: Stage; label: string; color: string; bg: string; border: string }[] = [
  { key: 'idea',      label: 'Idea',      color: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200' },
  { key: 'proposal',  label: 'Proposal',  color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200'  },
  { key: 'active',    label: 'Active',    color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  { key: 'review',    label: 'Review',    color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200'},
  { key: 'published', label: 'Published', color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
];

const TYPE_META: Record<ResearchType, { label: string; color: string }> = {
  basic:       { label: 'Basic',       color: 'bg-indigo-100 text-indigo-700' },
  applied:     { label: 'Applied',     color: 'bg-sky-100 text-sky-700' },
  action:      { label: 'Action',      color: 'bg-teal-100 text-teal-700' },
  policy:      { label: 'Policy',      color: 'bg-rose-100 text-rose-700' },
  development: { label: 'Development', color: 'bg-amber-100 text-amber-700' },
};

const OUTPUT_ICONS: Record<OutputType, string> = {
  paper: '📄', dataset: '📊', patent: '🔬', report: '📋', presentation: '📽️', software: '💾',
};

const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  lead: 'Lead', 'co-lead': 'Co-Lead', collaborator: 'Collaborator', advisor: 'Advisor', student: 'Student',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function Avatar({ name, photo, size = 28 }: { name: string; photo?: string; size?: number }) {
  if (photo) return <img src={photo} className="rounded-full object-cover" style={{ width: size, height: size }} alt={name} />;
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </div>
  );
}

function StageBadge({ stage }: { stage: Stage }) {
  const s = STAGES.find(x => x.key === stage)!;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.color} border ${s.border}`}>{s.label}</span>;
}

function TypeBadge({ type }: { type: ResearchType }) {
  const m = TYPE_META[type];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.color}`}>{m.label}</span>;
}

function MilestoneProgress({ done, total }: { done: number; total: number }) {
  if (!total) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-stone-200 rounded-full overflow-hidden">
        <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-stone-400">{done}/{total}</span>
    </div>
  );
}

// ── Create Project Modal ───────────────────────────────────────────────────────
function CreateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, watch, formState: { isSubmitting, errors } } = useForm<{
    title: string; abstract: string; researchType: ResearchType;
    startDate: string; targetEndDate: string; fundingSource: string;
    keywords: string; isPublic: boolean;
  }>({ defaultValues: { researchType: 'applied', isPublic: true } });

  const create = useMutation({
    mutationFn: (d: any) => researchApi.create(d),
    onSuccess: () => {
      toast.success('Project created');
      qc.invalidateQueries({ queryKey: ['research'] });
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error?.message || 'Failed to create'),
  });

  const onSubmit = (data: any) => {
    const keywords = data.keywords ? data.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : [];
    create.mutate({ ...data, keywords });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <FlaskConical size={18} className="text-primary-600" />
            <h3 className="font-display font-semibold text-stone-800">New Research Project</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-stone-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Project title *</label>
            <input {...register('title', { required: true, minLength: 5 })}
              className="input w-full" placeholder="e.g. Machine learning applications in crop yield prediction" />
            {errors.title && <p className="text-xs text-red-500 mt-1">Title must be at least 5 characters</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Abstract</label>
            <textarea {...register('abstract')} rows={3}
              className="input w-full resize-none" placeholder="Brief description of the research..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Research type</label>
              <select {...register('researchType')} className="input w-full">
                <option value="basic">Basic</option>
                <option value="applied">Applied</option>
                <option value="action">Action</option>
                <option value="policy">Policy</option>
                <option value="development">Development</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Visibility</label>
              <select {...register('isPublic', { setValueAs: v => v === 'true' || v === true })} className="input w-full">
                <option value="true">Public</option>
                <option value="false">Private</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Start date</label>
              <input type="date" {...register('startDate')} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Target end date</label>
              <input type="date" {...register('targetEndDate')} className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Funding source</label>
            <input {...register('fundingSource')} className="input w-full" placeholder="e.g. TETFund, World Bank, PTDF..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Keywords (comma-separated)</label>
            <input {...register('keywords')} className="input w-full" placeholder="e.g. machine learning, agriculture, Nigeria" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={isSubmitting || create.isPending} className="btn-primary">
              {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Project Card (Kanban) ──────────────────────────────────────────────────────
function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const total = Number(project.milestone_count ?? 0);
  const done  = Number(project.done_count ?? 0);
  return (
    <div onClick={onClick}
      className="bg-white border border-stone-200 rounded-xl p-4 cursor-pointer hover:border-primary-300 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-stone-800 leading-snug line-clamp-2">{project.title}</p>
        <TypeBadge type={project.research_type} />
      </div>
      {project.abstract && (
        <p className="text-xs text-stone-400 line-clamp-2 mb-3">{project.abstract}</p>
      )}
      {total > 0 && <div className="mb-3"><MilestoneProgress done={done} total={total} /></div>}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Avatar name={project.lead_name} photo={project.lead_photo} size={20} />
          <span className="text-xs text-stone-500 truncate max-w-[100px]">{project.lead_name}</span>
        </div>
        <div className="flex items-center gap-2 text-stone-400">
          {Number(project.member_count) > 1 && (
            <span className="flex items-center gap-0.5 text-xs"><Users size={11} /> {project.member_count}</span>
          )}
          {Number(project.output_count) > 0 && (
            <span className="flex items-center gap-0.5 text-xs"><FileText size={11} /> {project.output_count}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────
function PipelineColumn({
  stage, projects, onSelect,
}: { stage: typeof STAGES[number]; projects: Project[]; onSelect: (p: Project) => void }) {
  return (
    <div className="flex-1 min-w-[220px] max-w-[280px]">
      <div className={`flex items-center justify-between mb-3 px-3 py-2 rounded-lg ${stage.bg} border ${stage.border}`}>
        <span className={`text-sm font-semibold ${stage.color}`}>{stage.label}</span>
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${stage.bg} ${stage.color} border ${stage.border}`}>
          {projects.length}
        </span>
      </div>
      <div className="space-y-3">
        {projects.map(p => <ProjectCard key={p.id} project={p} onClick={() => onSelect(p)} />)}
        {projects.length === 0 && (
          <div className="border-2 border-dashed border-stone-200 rounded-xl p-4 text-center">
            <p className="text-xs text-stone-400">No projects here</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stage Stepper ─────────────────────────────────────────────────────────────
function StageStepper({ current, onChange }: { current: Stage; onChange: (s: Stage) => void }) {
  const idx = STAGES.findIndex(s => s.key === current);
  return (
    <div className="flex items-center gap-1">
      {STAGES.map((s, i) => (
        <button key={s.key} onClick={() => onChange(s.key)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all
            ${i === idx ? `${s.bg} ${s.color} border ${s.border}` : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'}`}>
          {i < idx && <span className="w-3 h-3 rounded-full bg-green-500 flex items-center justify-center">
            <svg viewBox="0 0 8 8" className="w-2 h-2 text-white fill-current"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none"/></svg>
          </span>}
          {s.label}
          {i < STAGES.length - 1 && <ChevronRight size={10} className="opacity-40" />}
        </button>
      ))}
    </div>
  );
}

// ── Add Member Panel ───────────────────────────────────────────────────────────
function AddMemberPanel({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [role, setRole] = useState<MemberRole>('collaborator');
  const { data: results } = useQuery({
    queryKey: ['users-search', q],
    queryFn: () => usersApi.search(q),
    enabled: q.length >= 2,
  });
  const users = (results?.data as any[]) ?? [];

  const add = useMutation({
    mutationFn: (userId: string) => researchApi.addMember(projectId, { userId, role }),
    onSuccess: () => {
      toast.success('Member added'); onDone();
      qc.invalidateQueries({ queryKey: ['research', projectId] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error?.message || 'Failed'),
  });

  return (
    <div className="p-4 border-t border-stone-100 space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={q} onChange={e => setQ(e.target.value)}
            className="input w-full pl-8 text-sm" placeholder="Search users..." />
        </div>
        <select value={role} onChange={e => setRole(e.target.value as MemberRole)} className="input text-sm">
          <option value="co-lead">Co-Lead</option>
          <option value="collaborator">Collaborator</option>
          <option value="advisor">Advisor</option>
          <option value="student">Student</option>
        </select>
      </div>
      {users.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {users.map((u: any) => (
            <div key={u.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-stone-50">
              <div className="flex items-center gap-2">
                <Avatar name={u.full_name} photo={u.profile_photo_url} size={24} />
                <div>
                  <p className="text-sm font-medium text-stone-700">{u.full_name}</p>
                  {u.department_name && <p className="text-xs text-stone-400">{u.department_name}</p>}
                </div>
              </div>
              <button onClick={() => add.mutate(u.id)} disabled={add.isPending}
                className="btn-primary text-xs py-1 px-2">Add</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Project Detail Panel ───────────────────────────────────────────────────────
function ProjectDetail({ project: initial, onClose }: { project: Project; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'overview' | 'team' | 'milestones' | 'outputs' | 'intelligence'>('overview');
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMilestone, setNewMilestone] = useState('');
  const [outputForm, setOutputForm] = useState(false);
  const [outType, setOutType] = useState<OutputType>('paper');
  const [outTitle, setOutTitle] = useState('');
  const [outUrl, setOutUrl] = useState('');

  const { data } = useQuery({
    queryKey: ['research', initial.id],
    queryFn: () => researchApi.project(initial.id),
  });
  const { data: intelData } = useQuery({
    queryKey: ['research-intel', initial.id],
    queryFn: () => researchApi.intelligence(initial.id),
    enabled: tab === 'intelligence',
  });

  const project: Project = (data?.data as Project) ?? initial;
  const intel = intelData?.data as { gaps: Gap[]; collaborators: any[] } | undefined;
  const isLead = project.lead_id === user?.id;
  const members = project.members ?? [];
  const milestones = project.milestones ?? [];
  const outputs = project.outputs ?? [];

  const advanceStage = useMutation({
    mutationFn: (stage: Stage) => researchApi.update(project.id, { stage }),
    onSuccess: () => { toast.success('Stage updated'); qc.invalidateQueries({ queryKey: ['research'] }); qc.invalidateQueries({ queryKey: ['research', project.id] }); },
    onError: () => toast.error('Failed to update stage'),
  });

  const toggleMilestone = useMutation({
    mutationFn: ({ mId, isDone }: { mId: string; isDone: boolean }) =>
      researchApi.updateMilestone(project.id, mId, { isDone }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', project.id] }),
  });

  const addMilestone = useMutation({
    mutationFn: (title: string) => researchApi.addMilestone(project.id, { title }),
    onSuccess: () => { setNewMilestone(''); qc.invalidateQueries({ queryKey: ['research', project.id] }); },
    onError: () => toast.error('Failed to add milestone'),
  });

  const addOutput = useMutation({
    mutationFn: (d: any) => researchApi.addOutput(project.id, d),
    onSuccess: () => { setOutputForm(false); setOutTitle(''); setOutUrl(''); qc.invalidateQueries({ queryKey: ['research', project.id] }); toast.success('Output added'); },
    onError: () => toast.error('Failed'),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => researchApi.removeMember(project.id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research', project.id] }),
    onError: () => toast.error('Failed'),
  });

  const doneMilestones = milestones.filter(m => m.is_done).length;

  const TABS = ['overview', 'team', 'milestones', 'outputs', 'intelligence'] as const;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-stone-100 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <StageBadge stage={project.stage} />
              <TypeBadge type={project.research_type} />
              {project.ethical_approval && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Ethics ✓</span>
              )}
            </div>
            <h2 className="font-display font-semibold text-stone-800 text-lg leading-snug">{project.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Avatar name={project.lead_name} photo={project.lead_photo} size={18} />
              <span className="text-xs text-stone-500">{project.lead_name}</span>
              {project.department_name && <span className="text-stone-300">·</span>}
              {project.department_name && <span className="text-xs text-stone-400">{project.department_name}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-stone-100 text-stone-400 flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Stage stepper (lead only) */}
        {isLead && project.stage !== 'published' && (
          <div className="px-5 py-3 border-b border-stone-100 overflow-x-auto">
            <p className="text-xs text-stone-400 mb-1.5">Advance stage</p>
            <StageStepper current={project.stage}
              onChange={s => { if (s !== project.stage) advanceStage.mutate(s); }} />
          </div>
        )}

        {/* Milestone progress bar */}
        {milestones.length > 0 && (
          <div className="px-5 py-2 border-b border-stone-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-stone-500">Milestones</span>
              <span className="text-xs text-stone-500">{doneMilestones}/{milestones.length} done</span>
            </div>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 rounded-full transition-all"
                style={{ width: `${milestones.length ? Math.round(doneMilestones / milestones.length * 100) : 0}%` }} />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-stone-100 px-5 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2.5 text-sm font-medium capitalize whitespace-nowrap border-b-2 transition-colors
                ${tab === t ? 'border-primary-500 text-primary-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}>
              {t === 'intelligence' ? '🧠 Intelligence' : t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="p-5 space-y-4">
              {project.abstract && (
                <div>
                  <p className="text-xs font-medium text-stone-500 mb-1">Abstract</p>
                  <p className="text-sm text-stone-700 leading-relaxed">{project.abstract}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {project.start_date && (
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-stone-400" />
                    <div>
                      <p className="text-xs text-stone-400">Start date</p>
                      <p className="text-sm text-stone-700">{new Date(project.start_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
                {project.target_end_date && (
                  <div className="flex items-center gap-2">
                    <Target size={14} className="text-stone-400" />
                    <div>
                      <p className="text-xs text-stone-400">Target end</p>
                      <p className="text-sm text-stone-700">{new Date(project.target_end_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
                {project.funding_source && (
                  <div className="flex items-center gap-2">
                    <DollarSign size={14} className="text-stone-400" />
                    <div>
                      <p className="text-xs text-stone-400">Funding</p>
                      <p className="text-sm text-stone-700">{project.funding_source}</p>
                    </div>
                  </div>
                )}
              </div>
              {project.keywords && project.keywords.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-stone-500 mb-2">Keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {project.keywords.map(k => (
                      <span key={k} className="px-2 py-0.5 bg-stone-100 text-stone-600 text-xs rounded-full">{k}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TEAM */}
          {tab === 'team' && (
            <div className="p-5 space-y-3">
              {members.map(m => (
                <div key={m.user_id} className="flex items-center justify-between p-3 rounded-xl bg-stone-50">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.full_name} photo={m.profile_photo_url} size={36} />
                    <div>
                      <p className="text-sm font-medium text-stone-800">{m.full_name}</p>
                      <p className="text-xs text-stone-400">{m.department_name ?? '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${m.role === 'lead' ? 'bg-primary-100 text-primary-700' : 'bg-stone-200 text-stone-600'}`}>
                      {MEMBER_ROLE_LABELS[m.role]}
                    </span>
                    {isLead && m.role !== 'lead' && (
                      <button onClick={() => removeMember.mutate(m.user_id)}
                        className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {isLead && (
                <>
                  <button onClick={() => setShowAddMember(v => !v)}
                    className="w-full border-2 border-dashed border-stone-200 rounded-xl py-2.5 text-sm text-stone-400 hover:border-primary-300 hover:text-primary-600 transition-colors flex items-center justify-center gap-1">
                    <Plus size={14} /> Add member
                  </button>
                  {showAddMember && (
                    <AddMemberPanel projectId={project.id} onDone={() => setShowAddMember(false)} />
                  )}
                </>
              )}
            </div>
          )}

          {/* MILESTONES */}
          {tab === 'milestones' && (
            <div className="p-5 space-y-2">
              {milestones.map(m => (
                <div key={m.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors
                  ${m.is_done ? 'bg-green-50 border-green-200' : 'bg-white border-stone-200'}`}>
                  <button onClick={() => toggleMilestone.mutate({ mId: m.id, isDone: !m.is_done })}
                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                      ${m.is_done ? 'bg-green-500 border-green-500 text-white' : 'border-stone-300 hover:border-primary-400'}`}>
                    {m.is_done && <svg viewBox="0 0 10 10" className="w-3 h-3 fill-current"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" fill="none"/></svg>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${m.is_done ? 'line-through text-stone-400' : 'text-stone-800'}`}>
                      {m.title}
                    </p>
                    {m.description && <p className="text-xs text-stone-400 mt-0.5">{m.description}</p>}
                    {m.due_date && (
                      <p className="text-xs text-stone-400 mt-1 flex items-center gap-1">
                        <Calendar size={10} /> Due {new Date(m.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <input value={newMilestone} onChange={e => setNewMilestone(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newMilestone.trim()) addMilestone.mutate(newMilestone.trim()); }}
                  className="input flex-1 text-sm" placeholder="Add a milestone and press Enter..." />
                <button onClick={() => { if (newMilestone.trim()) addMilestone.mutate(newMilestone.trim()); }}
                  disabled={!newMilestone.trim() || addMilestone.isPending}
                  className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
                  {addMilestone.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* OUTPUTS */}
          {tab === 'outputs' && (
            <div className="p-5 space-y-3">
              {outputs.map(o => (
                <div key={o.id} className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-stone-50">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{OUTPUT_ICONS[o.output_type]}</span>
                    <div>
                      <p className="text-sm font-medium text-stone-800">{o.title || o.doc_title || '—'}</p>
                      <p className="text-xs text-stone-400 capitalize">{o.output_type}{o.published_at ? ` · ${new Date(o.published_at).getFullYear()}` : ''}</p>
                    </div>
                  </div>
                  {o.external_url && (
                    <a href={o.external_url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded hover:bg-stone-200 text-stone-400 hover:text-stone-700">
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              ))}
              {outputForm ? (
                <div className="border border-stone-200 rounded-xl p-4 space-y-3">
                  <div className="flex gap-2">
                    <select value={outType} onChange={e => setOutType(e.target.value as OutputType)} className="input text-sm">
                      <option value="paper">Paper</option>
                      <option value="dataset">Dataset</option>
                      <option value="patent">Patent</option>
                      <option value="report">Report</option>
                      <option value="presentation">Presentation</option>
                      <option value="software">Software</option>
                    </select>
                    <input value={outTitle} onChange={e => setOutTitle(e.target.value)}
                      className="input flex-1 text-sm" placeholder="Title" />
                  </div>
                  <input value={outUrl} onChange={e => setOutUrl(e.target.value)}
                    className="input w-full text-sm" placeholder="URL (optional)" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setOutputForm(false)} className="btn-ghost text-sm">Cancel</button>
                    <button onClick={() => addOutput.mutate({ outputType: outType, title: outTitle, externalUrl: outUrl || undefined })}
                      disabled={!outTitle.trim() || addOutput.isPending} className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                      {addOutput.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add output'}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setOutputForm(true)}
                  className="w-full border-2 border-dashed border-stone-200 rounded-xl py-2.5 text-sm text-stone-400 hover:border-primary-300 hover:text-primary-600 transition-colors flex items-center justify-center gap-1">
                  <Plus size={14} /> Link an output
                </button>
              )}
            </div>
          )}

          {/* INTELLIGENCE */}
          {tab === 'intelligence' && (
            <div className="p-5 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Brain size={16} className="text-primary-600" />
                  <h4 className="text-sm font-semibold text-stone-700">Knowledge gaps this project could address</h4>
                </div>
                {!intel ? (
                  <div className="flex items-center gap-2 text-stone-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Analysing...</div>
                ) : intel.gaps.length > 0 ? (
                  <div className="space-y-2">
                    {intel.gaps.map((g: Gap) => (
                      <div key={g.id} className="p-3 rounded-xl border border-amber-200 bg-amber-50">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          {g.research_area && (
                            <span className="text-xs font-medium text-amber-700 bg-amber-200 px-2 py-0.5 rounded-full">{g.research_area}</span>
                          )}
                          <span className="text-xs text-amber-600 font-medium">Priority {g.priority_score}/10</span>
                        </div>
                        <p className="text-sm text-stone-700">{g.gap_description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-stone-400">No matched gaps found. Add keywords to your project for better matching.</p>
                )}
              </div>

              {intel && intel.collaborators.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={16} className="text-primary-600" />
                    <h4 className="text-sm font-semibold text-stone-700">Suggested collaborators</h4>
                  </div>
                  <div className="space-y-2">
                    {intel.collaborators.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-stone-50">
                        <div className="flex items-center gap-2">
                          <Avatar name={c.full_name} photo={c.profile_photo_url} size={32} />
                          <div>
                            <p className="text-sm font-medium text-stone-800">{c.full_name}</p>
                            {c.department_name && <p className="text-xs text-stone-400">{c.department_name}</p>}
                          </div>
                        </div>
                        <span className="text-xs text-primary-600 font-medium">{c.match_count} shared topics</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ResearchPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Project | null>(null);
  const [filterMine, setFilterMine] = useState(false);
  const [filterType, setFilterType] = useState<ResearchType | ''>('');

  const { data, isLoading } = useQuery({
    queryKey: ['research', filterMine, filterType],
    queryFn: () => researchApi.projects({ mine: filterMine || undefined, type: filterType || undefined }),
  });
  const projects: Project[] = (data?.data as Project[]) ?? [];

  const byStage = useMemo(() => {
    const map: Record<Stage, Project[]> = { idea: [], proposal: [], active: [], review: [], published: [] };
    projects.forEach(p => { if (map[p.stage]) map[p.stage].push(p); });
    return map;
  }, [projects]);

  const stats = useMemo(() => ({
    total:     projects.length,
    active:    projects.filter(p => p.stage === 'active').length,
    published: projects.filter(p => p.stage === 'published').length,
    members:   projects.reduce((acc, p) => acc + Number(p.member_count ?? 1), 0),
  }), [projects]);

  return (
    <div className="max-w-full mx-auto">
      {/* Hero */}
      <div className="rounded-2xl p-6 mb-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#09432c 0%,#0d6b44 100%)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 50%,#d4a017,transparent 60%)' }} />
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FlaskConical size={18} className="text-primary-300" />
              <span className="text-primary-300 text-sm">Intelligent Research Pipeline</span>
            </div>
            <h2 className="font-display text-2xl font-semibold mb-1">Research Projects</h2>
            <p className="text-white/60 text-sm">Track ideas through to publication with AI-guided insights.</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="btn-primary bg-white/20 hover:bg-white/30 text-white border border-white/30 flex items-center gap-2">
            <Plus size={16} /> New project
          </button>
        </div>
        {/* Stats */}
        <div className="relative mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total projects', value: stats.total,     icon: <BookOpen size={14} /> },
            { label: 'Active',         value: stats.active,    icon: <FlaskConical size={14} /> },
            { label: 'Published',      value: stats.published, icon: <BarChart3 size={14} /> },
            { label: 'Researchers',    value: stats.members,   icon: <Users size={14} /> },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-white/60 mb-1">{s.icon}<span className="text-xs">{s.label}</span></div>
              <p className="font-display text-xl font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={() => setFilterMine(v => !v)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterMine ? 'bg-primary-100 text-primary-700 border border-primary-200' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
          {filterMine ? '✓ My projects' : 'My projects'}
        </button>
        <select value={filterType} onChange={e => setFilterType(e.target.value as ResearchType | '')}
          className="input text-sm py-1.5">
          <option value="">All types</option>
          <option value="basic">Basic</option>
          <option value="applied">Applied</option>
          <option value="action">Action</option>
          <option value="policy">Policy</option>
          <option value="development">Development</option>
        </select>
        {(filterMine || filterType) && (
          <button onClick={() => { setFilterMine(false); setFilterType(''); }}
            className="text-sm text-stone-400 hover:text-stone-600 flex items-center gap-1">
            <X size={12} /> Clear filters
          </button>
        )}
      </div>

      {/* Pipeline */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-6">
          {STAGES.map(s => (
            <PipelineColumn key={s.key} stage={s} projects={byStage[s.key]} onSelect={setSelected} />
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
      {selected && <ProjectDetail project={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
