'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mentorshipApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  GraduationCap, Users, User, Search, X, Check, ChevronRight,
  BookOpen, Award, Heart, Star, Clock, CheckCircle2,
  ArrowRight, Briefcase, Handshake,
} from 'lucide-react';

/* ── constants ──────────────────────────────────────────────────────────── */
const STAGES = [
  { key: 'initiating',  label: 'Initiating',  desc: 'Engaging & building rapport' },
  { key: 'challenging', label: 'Challenging',  desc: 'Testing & building trust' },
  { key: 'growing',     label: 'Growing',      desc: 'Developing skills & confidence' },
  { key: 'closing',     label: 'Closing',      desc: 'Redefining the relationship' },
];

const MENTOR_ROLES = [
  { key: 'teacher',    label: 'Teacher',    icon: BookOpen },
  { key: 'advisor',    label: 'Advisor',    icon: Briefcase },
  { key: 'role_model', label: 'Role Model', icon: Star },
  { key: 'sponsor',    label: 'Sponsor',    icon: Award },
  { key: 'counselor',  label: 'Counselor',  icon: Heart },
];

const SUPPORT_TYPES = [
  { key: 'career',       label: 'Career',       desc: 'Guidance, networking, skill-building' },
  { key: 'psychosocial', label: 'Psychosocial', desc: 'Encouragement, emotional support' },
];

const STATUS_COLORS: Record<string, string> = {
  pending:   'badge-gold',
  active:    'badge-green',
  completed: 'badge-stone',
  declined:  'text-red-500 bg-red-50',
};

/* ── types ──────────────────────────────────────────────────────────────── */
interface MentorProfile {
  user_id: string; full_name: string; profile_photo_url: string | null;
  department_name: string | null; faculty_name: string | null; university_short: string | null;
  role: string; support_types: string[]; mentor_roles: string[]; areas: string[];
  bio: string | null; availability: string | null; current_level: string | null;
  active_mentees: number; requested: boolean;
}
interface Mentorship {
  id: string; mentor_id: string; mentee_id: string;
  mentor_name: string; mentor_photo: string | null; mentor_department: string | null;
  mentee_name: string; mentee_photo: string | null; mentee_department: string | null;
  type: string; stage: string; status: string; support_type: string;
  goals_summary: string | null; started_at: string | null; ended_at: string | null; created_at: string;
}
interface Session {
  id: string; title: string; notes: string | null; session_date: string;
  duration_mins: number | null; logged_by_name: string;
}
interface Goal {
  id: string; title: string; description: string | null; status: string; achieved_at: string | null;
}
interface MyProfile {
  role: string; support_types: string[]; mentor_roles: string[]; areas: string[];
  bio: string | null; availability: string | null; is_active: boolean;
}

/* ── Avatar ─────────────────────────────────────────────────────────────── */
function Avatar({ name, url, size = 9 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (url) return <img src={url} alt={name} className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div className={`w-${size} h-${size} rounded-full bg-primary-100 text-primary-700 text-xs font-semibold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  );
}

/* ── Stage progress bar ─────────────────────────────────────────────────── */
function StageBar({ stage, isMentor, onAdvance }: { stage: string; isMentor: boolean; onAdvance?: (s: string) => void }) {
  const idx = STAGES.findIndex(s => s.key === stage);
  return (
    <div className="mb-4">
      <div className="flex gap-1 mb-2">
        {STAGES.map((s, i) => (
          <div key={s.key} className="flex-1 flex flex-col items-center">
            <div className={`w-full h-1.5 rounded-full ${i <= idx ? 'bg-primary-500' : 'bg-stone-200'}`} />
            <span className={`text-[10px] mt-1 font-medium ${i === idx ? 'text-primary-700' : 'text-stone-400'}`}>{s.label}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-stone-500 text-center">{STAGES[idx]?.desc}</p>
      {isMentor && idx < STAGES.length - 1 && (
        <button onClick={() => onAdvance?.(STAGES[idx + 1].key)}
          className="mt-2 w-full text-xs flex items-center justify-center gap-1 py-1.5 rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50 transition-colors">
          <ArrowRight size={11} /> Advance to {STAGES[idx + 1].label}
        </button>
      )}
    </div>
  );
}

/* ── Request modal ──────────────────────────────────────────────────────── */
function RequestModal({ mentor, onClose }: { mentor: MentorProfile; onClose: () => void }) {
  const qc = useQueryClient();
  const [supportType, setSupportType] = useState('career');
  const [goals, setGoals] = useState('');

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => mentorshipApi.request(mentor.user_id, { supportType, goalsSummary: goals }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mentorship-profiles'] });
      qc.invalidateQueries({ queryKey: ['mentorships'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-stone-900">Request Mentorship</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={16} /></button>
        </div>

        <div className="flex items-center gap-3 mb-5 p-3 bg-stone-50 rounded-xl">
          <Avatar name={mentor.full_name} url={mentor.profile_photo_url} size={10} />
          <div>
            <p className="font-medium text-stone-900 text-sm">{mentor.full_name}</p>
            <p className="text-xs text-stone-400">{mentor.department_name}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Support type</label>
            <div className="flex rounded-lg border border-stone-200 overflow-hidden">
              {SUPPORT_TYPES.map((t, i) => (
                <button key={t.key} type="button" onClick={() => setSupportType(t.key)}
                  className={`flex-1 py-2 text-sm transition-colors ${supportType === t.key ? 'bg-primary-600 text-white font-medium' : 'bg-white text-stone-500 hover:bg-stone-50'} ${i > 0 ? 'border-l border-stone-200' : ''}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-stone-400 mt-1">{SUPPORT_TYPES.find(t => t.key === supportType)?.desc}</p>
          </div>
          <div>
            <label className="label">What do you hope to achieve? <span className="text-stone-400 font-normal">(optional)</span></label>
            <textarea className="input resize-none" rows={3} placeholder="Describe your goals for this mentorship…"
              value={goals} onChange={e => setGoals(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{(error as any)?.response?.data?.error?.message ?? 'Something went wrong'}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => mutate()} disabled={isPending} className="btn-primary disabled:opacity-40">
            {isPending ? 'Sending…' : 'Send request'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Mentorship detail modal ────────────────────────────────────────────── */
function MentorshipDetail({ rel, onClose }: { rel: Mentorship; onClose: () => void }) {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isMentor = rel.mentor_id === user?.id;
  const [detailTab, setDetailTab] = useState<'goals' | 'sessions'>('goals');
  const [newGoal, setNewGoal] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionDuration, setSessionDuration] = useState('');

  const { data: goalsData, refetch: refetchGoals } = useQuery<{ data: Goal[] }>({
    queryKey: ['mentorship-goals', rel.id],
    queryFn: () => mentorshipApi.goals(rel.id),
    enabled: rel.status === 'active',
  });
  const { data: sessionsData, refetch: refetchSessions } = useQuery<{ data: Session[] }>({
    queryKey: ['mentorship-sessions', rel.id],
    queryFn: () => mentorshipApi.sessions(rel.id),
    enabled: rel.status === 'active',
  });

  const acceptMut  = useMutation({ mutationFn: () => mentorshipApi.accept(rel.id),  onSuccess: () => qc.invalidateQueries({ queryKey: ['mentorships'] }) });
  const declineMut = useMutation({ mutationFn: () => mentorshipApi.decline(rel.id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['mentorships'] }); onClose(); } });
  const stageMut   = useMutation({ mutationFn: (s: string) => mentorshipApi.stage(rel.id, s), onSuccess: () => qc.invalidateQueries({ queryKey: ['mentorships'] }) });
  const closeMut   = useMutation({ mutationFn: () => mentorshipApi.close(rel.id),   onSuccess: () => { qc.invalidateQueries({ queryKey: ['mentorships'] }); onClose(); } });
  const addGoalMut = useMutation({ mutationFn: () => mentorshipApi.addGoal(rel.id, { title: newGoal }), onSuccess: () => { refetchGoals(); setNewGoal(''); } });
  const goalMut    = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => mentorshipApi.updateGoal(rel.id, id, { status }), onSuccess: () => refetchGoals() });
  const sessionMut = useMutation({
    mutationFn: () => mentorshipApi.logSession(rel.id, { title: sessionTitle, notes: sessionNotes, durationMins: sessionDuration ? parseInt(sessionDuration) : null }),
    onSuccess: () => { refetchSessions(); setSessionTitle(''); setSessionNotes(''); setSessionDuration(''); },
  });

  const goals    = goalsData?.data    ?? [];
  const sessions = sessionsData?.data ?? [];
  const other    = isMentor
    ? { name: rel.mentee_name, photo: rel.mentee_photo, dept: rel.mentee_department }
    : { name: rel.mentor_name, photo: rel.mentor_photo, dept: rel.mentor_department };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* header */}
        <div className="flex items-start justify-between p-5 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <Avatar name={other.name} url={other.photo} size={10} />
            <div>
              <p className="font-display font-semibold text-stone-900">{other.name}</p>
              <p className="text-xs text-stone-400">{other.dept} · {isMentor ? 'Your mentee' : 'Your mentor'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`badge text-xs ${STATUS_COLORS[rel.status] ?? 'badge-stone'}`}>{rel.status}</span>
                <span className="badge badge-stone text-xs capitalize">{rel.support_type}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"><X size={16} /></button>
        </div>

        {/* pending actions */}
        {rel.status === 'pending' && isMentor && (
          <div className="px-5 py-3 border-b border-stone-100 flex gap-2 items-center">
            <button onClick={() => acceptMut.mutate()} disabled={acceptMut.isPending}
              className="btn-primary text-sm flex items-center gap-1.5"><Check size={13} /> Accept</button>
            <button onClick={() => declineMut.mutate()} disabled={declineMut.isPending}
              className="btn-secondary text-sm text-red-600">Decline</button>
            {rel.goals_summary && (
              <p className="ml-auto text-xs text-stone-400 max-w-[160px] truncate" title={rel.goals_summary}>
                Goal: {rel.goals_summary}
              </p>
            )}
          </div>
        )}
        {rel.status === 'pending' && !isMentor && (
          <div className="px-5 py-3 border-b border-stone-100 bg-amber-50 flex items-center justify-between">
            <p className="text-xs text-amber-700">Waiting for {rel.mentor_name} to accept.</p>
            <button onClick={() => declineMut.mutate()} className="text-xs text-red-500 hover:underline">Withdraw</button>
          </div>
        )}

        {/* scrollable body */}
        <div className="flex-1 overflow-y-auto p-5">
          {rel.status === 'active' && (
            <>
              <StageBar stage={rel.stage} isMentor={isMentor} onAdvance={s => stageMut.mutate(s)} />
              <button onClick={() => { if (confirm('Mark this mentorship as completed?')) closeMut.mutate(); }}
                className="w-full mb-4 text-xs py-1.5 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 transition-colors">
                Mark as completed
              </button>

              {/* goals / sessions tabs */}
              <div className="flex gap-1 mb-4 bg-stone-100 rounded-xl p-1">
                {(['goals', 'sessions'] as const).map(t => (
                  <button key={t} onClick={() => setDetailTab(t)}
                    className={`flex-1 py-1.5 text-sm rounded-lg transition-colors capitalize font-medium ${detailTab === t ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
                    {t}
                  </button>
                ))}
              </div>

              {detailTab === 'goals' && (
                <div className="space-y-2">
                  {goals.length === 0 && <p className="text-sm text-stone-400 text-center py-4">No goals yet</p>}
                  {goals.map(g => (
                    <div key={g.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-stone-50">
                      <button onClick={() => goalMut.mutate({ id: g.id, status: g.status === 'achieved' ? 'active' : 'achieved' })}
                        className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${g.status === 'achieved' ? 'bg-primary-500 border-primary-500' : 'border-stone-300'}`}>
                        {g.status === 'achieved' && <Check size={9} className="text-white" />}
                      </button>
                      <p className={`text-sm flex-1 ${g.status === 'achieved' ? 'line-through text-stone-400' : 'text-stone-700'}`}>{g.title}</p>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-3">
                    <input className="input flex-1 py-1.5 text-sm" placeholder="Add a goal…"
                      value={newGoal} onChange={e => setNewGoal(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && newGoal.trim() && addGoalMut.mutate()} />
                    <button onClick={() => addGoalMut.mutate()} disabled={!newGoal.trim() || addGoalMut.isPending}
                      className="btn-primary text-sm px-3 disabled:opacity-40">Add</button>
                  </div>
                </div>
              )}

              {detailTab === 'sessions' && (
                <div className="space-y-3">
                  {sessions.length === 0 && <p className="text-sm text-stone-400 text-center py-4">No sessions logged yet</p>}
                  {sessions.map(s => (
                    <div key={s.id} className="p-3 rounded-xl border border-stone-100">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-stone-800">{s.title}</p>
                        {s.duration_mins && <span className="text-xs text-stone-400 flex-shrink-0 flex items-center gap-1"><Clock size={10} />{s.duration_mins}m</span>}
                      </div>
                      {s.notes && <p className="text-xs text-stone-500 mt-1">{s.notes}</p>}
                      <p className="text-xs text-stone-400 mt-1">{new Date(s.session_date).toLocaleDateString()} · {s.logged_by_name}</p>
                    </div>
                  ))}
                  <div className="mt-3 p-3 rounded-xl border border-dashed border-stone-200 space-y-2">
                    <p className="text-xs font-medium text-stone-600">Log a session</p>
                    <input className="input py-1.5 text-sm" placeholder="Session title *"
                      value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} />
                    <textarea className="input resize-none text-sm py-1.5" rows={2} placeholder="Notes…"
                      value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} />
                    <div className="flex gap-2">
                      <input className="input py-1.5 text-sm w-28" type="number" placeholder="Minutes"
                        value={sessionDuration} onChange={e => setSessionDuration(e.target.value)} />
                      <button onClick={() => sessionMut.mutate()} disabled={!sessionTitle.trim() || sessionMut.isPending}
                        className="btn-primary text-sm flex-1 disabled:opacity-40">
                        {sessionMut.isPending ? 'Saving…' : 'Log session'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {rel.status === 'completed' && (
            <div className="text-center py-8">
              <CheckCircle2 size={36} className="mx-auto text-primary-400 mb-2" />
              <p className="text-stone-600 font-medium">Mentorship completed</p>
              {rel.started_at && (
                <p className="text-xs text-stone-400 mt-1">
                  {new Date(rel.started_at).toLocaleDateString()} — {rel.ended_at ? new Date(rel.ended_at).toLocaleDateString() : ''}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Mentor card ────────────────────────────────────────────────────────── */
function MentorCard({ mentor, onClick }: { mentor: MentorProfile; onClick: () => void }) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Avatar name={mentor.full_name} url={mentor.profile_photo_url} size={10} />
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-stone-900 text-sm truncate">{mentor.full_name}</p>
          <p className="text-xs text-stone-400 truncate">{[mentor.department_name, mentor.university_short].filter(Boolean).join(' · ')}</p>
          {mentor.current_level && <span className="badge badge-gold text-xs mt-1">{mentor.current_level}</span>}
        </div>
      </div>

      {mentor.bio && <p className="text-xs text-stone-500 line-clamp-2">{mentor.bio}</p>}

      {mentor.areas.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {mentor.areas.slice(0, 4).map(a => (
            <span key={a} className="px-2 py-0.5 bg-stone-100 text-stone-600 text-xs rounded-full">{a}</span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-xs text-stone-400">
        {mentor.mentor_roles.slice(0, 3).map(r => {
          const role = MENTOR_ROLES.find(mr => mr.key === r);
          if (!role) return null;
          return <span key={r} className="flex items-center gap-0.5"><role.icon size={10} />{role.label}</span>;
        })}
        {mentor.availability && <span className="ml-auto flex items-center gap-0.5"><Clock size={10} />{mentor.availability}</span>}
      </div>

      <button onClick={onClick} disabled={mentor.requested}
        className={`w-full text-sm py-2 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-default ${mentor.requested ? 'bg-stone-100 text-stone-400' : 'bg-primary-600 text-white hover:bg-primary-700'}`}>
        {mentor.requested ? 'Request sent' : 'Request mentorship'}
      </button>
    </div>
  );
}

/* ── Relationship card ──────────────────────────────────────────────────── */
function RelCard({ rel, userId, onClick }: { rel: Mentorship; userId: string; onClick: () => void }) {
  const isMentor = rel.mentor_id === userId;
  const other    = isMentor ? { name: rel.mentee_name, photo: rel.mentee_photo } : { name: rel.mentor_name, photo: rel.mentor_photo };
  const stageIdx = STAGES.findIndex(s => s.key === rel.stage);

  return (
    <button onClick={onClick} className="card p-4 text-left w-full hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div className="flex items-start gap-3">
        <Avatar name={other.name} url={other.photo} size={9} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-stone-900 truncate">{other.name}</p>
            <span className={`badge text-xs flex-shrink-0 ${STATUS_COLORS[rel.status] ?? 'badge-stone'}`}>{rel.status}</span>
          </div>
          <p className="text-xs text-stone-400">{isMentor ? 'Mentee' : 'Mentor'} · <span className="capitalize">{rel.support_type}</span></p>
          {rel.status === 'active' && (
            <div className="flex gap-1 mt-2">
              {STAGES.map((s, i) => (
                <div key={s.key} className={`flex-1 h-1 rounded-full ${i <= stageIdx ? 'bg-primary-500' : 'bg-stone-200'}`} />
              ))}
            </div>
          )}
        </div>
        <ChevronRight size={14} className="text-stone-300 flex-shrink-0 mt-1" />
      </div>
    </button>
  );
}

/* ── My profile tab ─────────────────────────────────────────────────────── */
function ProfileTab() {
  const qc = useQueryClient();
  const { data } = useQuery<{ data: MyProfile | null }>({
    queryKey: ['my-mentorship-profile'],
    queryFn:  () => mentorshipApi.myProfile(),
  });
  const existing = data?.data;

  const [role, setRole]               = useState('mentee');
  const [supportTypes, setSupportTypes] = useState<string[]>([]);
  const [mentorRoles, setMentorRoles]   = useState<string[]>([]);
  const [areas, setAreas]               = useState<string[]>([]);
  const [areaInput, setAreaInput]       = useState('');
  const [bio, setBio]                   = useState('');
  const [availability, setAvailability] = useState('');
  const [loaded, setLoaded]             = useState(false);

  useEffect(() => {
    if (existing && !loaded) {
      setRole(existing.role);
      setSupportTypes(existing.support_types ?? []);
      setMentorRoles(existing.mentor_roles ?? []);
      setAreas(existing.areas ?? []);
      setBio(existing.bio ?? '');
      setAvailability(existing.availability ?? '');
      setLoaded(true);
    }
  }, [existing, loaded]);

  const toggle = (arr: string[], setArr: (v: string[]) => void, val: string) =>
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  const addArea = () => {
    const v = areaInput.trim();
    if (v && !areas.includes(v)) { setAreas([...areas, v]); setAreaInput(''); }
  };

  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: () => mentorshipApi.saveProfile({ role, supportTypes, mentorRoles, areas, bio, availability }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['my-mentorship-profile'] }),
  });

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <label className="label">I want to participate as</label>
        <div className="flex rounded-lg border border-stone-200 overflow-hidden">
          {[{ key: 'mentee', label: 'Mentee' }, { key: 'mentor', label: 'Mentor' }, { key: 'both', label: 'Both' }].map((r, i) => (
            <button key={r.key} type="button" onClick={() => setRole(r.key)}
              className={`flex-1 py-2 text-sm transition-colors ${role === r.key ? 'bg-primary-600 text-white font-medium' : 'bg-white text-stone-500 hover:bg-stone-50'} ${i > 0 ? 'border-l border-stone-200' : ''}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Support type(s)</label>
        <div className="flex gap-3">
          {SUPPORT_TYPES.map(t => (
            <button key={t.key} type="button" onClick={() => toggle(supportTypes, setSupportTypes, t.key)}
              className={`flex-1 py-2.5 px-3 rounded-xl border text-sm transition-colors text-left ${supportTypes.includes(t.key) ? 'border-primary-400 bg-primary-50 text-primary-800' : 'border-stone-200 text-stone-500'}`}>
              <p className="font-medium">{t.label}</p>
              <p className="text-xs opacity-70 mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {(role === 'mentor' || role === 'both') && (
        <div>
          <label className="label">Mentor roles you fulfil</label>
          <div className="flex flex-wrap gap-2">
            {MENTOR_ROLES.map(r => (
              <button key={r.key} type="button" onClick={() => toggle(mentorRoles, setMentorRoles, r.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm transition-colors ${mentorRoles.includes(r.key) ? 'border-primary-400 bg-primary-50 text-primary-800' : 'border-stone-200 text-stone-500'}`}>
                <r.icon size={13} /> {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="label">Areas of expertise / interest</label>
        <div className="flex gap-2 mb-2">
          <input className="input flex-1 py-1.5 text-sm" placeholder="e.g. Machine Learning, Public Health…"
            value={areaInput} onChange={e => setAreaInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addArea()} />
          <button onClick={addArea} className="btn-secondary text-sm px-3">Add</button>
        </div>
        {areas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {areas.map(a => (
              <span key={a} className="flex items-center gap-1 px-2.5 py-1 bg-stone-100 text-stone-700 text-xs rounded-full">
                {a}
                <button onClick={() => setAreas(areas.filter(x => x !== a))} className="text-stone-400 hover:text-red-500"><X size={10} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="label">Short bio</label>
        <textarea className="input resize-none" rows={3} placeholder="Tell potential mentors/mentees about yourself…"
          value={bio} onChange={e => setBio(e.target.value)} />
      </div>

      {(role === 'mentor' || role === 'both') && (
        <div>
          <label className="label">Availability</label>
          <input className="input" placeholder="e.g. 2 hours/month, weekends only…"
            value={availability} onChange={e => setAvailability(e.target.value)} />
        </div>
      )}

      <button onClick={() => mutate()} disabled={isPending} className="btn-primary disabled:opacity-40">
        {isPending ? 'Saving…' : isSuccess ? 'Saved!' : existing ? 'Update profile' : 'Save profile'}
      </button>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function MentorshipPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'browse' | 'mine' | 'profile'>('browse');
  const [supportFilter, setSupportFilter] = useState('');
  const [selectedMentor, setSelectedMentor] = useState<MentorProfile | null>(null);
  const [selectedRel, setSelectedRel] = useState<Mentorship | null>(null);

  const { data: profilesData, isLoading: profilesLoading } = useQuery<{ data: MentorProfile[] }>({
    queryKey: ['mentorship-profiles', supportFilter],
    queryFn:  () => mentorshipApi.profiles(supportFilter ? { support: supportFilter } : undefined),
    enabled:  tab === 'browse',
  });

  const { data: relsData, isLoading: relsLoading } = useQuery<{ data: Mentorship[] }>({
    queryKey: ['mentorships'],
    queryFn:  () => mentorshipApi.myRelations(),
    enabled:  tab === 'mine',
  });

  const profiles = profilesData?.data ?? [];
  const rels     = relsData?.data ?? [];
  const pending  = rels.filter(r => r.status === 'pending');
  const active   = rels.filter(r => r.status === 'active');
  const done     = rels.filter(r => r.status === 'completed' || r.status === 'declined');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="font-display text-2xl font-semibold text-stone-900">Mentorship</h2>
        <p className="text-stone-500 text-sm mt-1">Career guidance, skills development, and psychosocial support</p>
      </div>

      {/* tabs */}
      <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-6 w-fit">
        {([
          { key: 'browse',  label: 'Find a Mentor',  icon: Search },
          { key: 'mine',    label: 'My Mentorships', icon: Users },
          { key: 'profile', label: 'My Profile',     icon: User },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Browse */}
      {tab === 'browse' && (
        <>
          <div className="flex gap-2 mb-5 flex-wrap">
            {[{ key: '', label: 'All mentors' }, { key: 'career', label: 'Career support' }, { key: 'psychosocial', label: 'Psychosocial support' }].map(f => (
              <button key={f.key} onClick={() => setSupportFilter(f.key)}
                className={`px-3 py-1.5 rounded-xl border text-sm transition-colors ${supportFilter === f.key ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-stone-200 text-stone-500 hover:border-stone-300'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {profilesLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <div key={i} className="h-52 skeleton rounded-xl" />)}
            </div>
          ) : profiles.length === 0 ? (
            <div className="card p-16 text-center">
              <GraduationCap size={36} className="mx-auto mb-3 text-stone-300" />
              <p className="text-stone-500 font-medium">No mentors available yet</p>
              <p className="text-stone-400 text-sm mt-1">Be the first — set up your mentor profile.</p>
              <button onClick={() => setTab('profile')} className="btn-primary mt-4 text-sm">Set up profile</button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {profiles.map(m => <MentorCard key={m.user_id} mentor={m} onClick={() => setSelectedMentor(m)} />)}
            </div>
          )}
        </>
      )}

      {/* My Mentorships */}
      {tab === 'mine' && (
        relsLoading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 skeleton rounded-xl" />)}</div>
        ) : rels.length === 0 ? (
          <div className="card p-16 text-center">
            <Handshake size={36} className="mx-auto mb-3 text-stone-300" />
            <p className="text-stone-500 font-medium">No mentorships yet</p>
            <p className="text-stone-400 text-sm mt-1">Find a mentor and send a request to get started.</p>
            <button onClick={() => setTab('browse')} className="btn-primary mt-4 text-sm">Find a mentor</button>
          </div>
        ) : (
          <div className="space-y-6">
            {pending.length > 0 && (
              <section>
                <h3 className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-3">Pending</h3>
                <div className="grid sm:grid-cols-2 gap-3">{pending.map(r => <RelCard key={r.id} rel={r} userId={user!.id} onClick={() => setSelectedRel(r)} />)}</div>
              </section>
            )}
            {active.length > 0 && (
              <section>
                <h3 className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-3">Active</h3>
                <div className="grid sm:grid-cols-2 gap-3">{active.map(r => <RelCard key={r.id} rel={r} userId={user!.id} onClick={() => setSelectedRel(r)} />)}</div>
              </section>
            )}
            {done.length > 0 && (
              <section>
                <h3 className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-3">Past</h3>
                <div className="grid sm:grid-cols-2 gap-3">{done.map(r => <RelCard key={r.id} rel={r} userId={user!.id} onClick={() => setSelectedRel(r)} />)}</div>
              </section>
            )}
          </div>
        )
      )}

      {/* My Profile */}
      {tab === 'profile' && <ProfileTab />}

      {selectedMentor && <RequestModal mentor={selectedMentor} onClose={() => setSelectedMentor(null)} />}
      {selectedRel    && <MentorshipDetail rel={selectedRel} onClose={() => setSelectedRel(null)} />}
    </div>
  );
}
