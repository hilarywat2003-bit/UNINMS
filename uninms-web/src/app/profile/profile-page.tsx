'use client';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, authApi, api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  User, Mail, Building2, BookOpen, Award, Edit3, Save,
  Loader2, CheckCircle2, ExternalLink, Lock, Shield, BarChart3,
  GraduationCap, Phone, Globe, Camera,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

type Tab = 'profile' | 'security' | 'institution' | 'activity';

function TabBtn({ label, icon: Icon, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
      ${active ? 'bg-primary-800 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
      <Icon size={15} />{label}
    </button>
  );
}

function ProfileTab({ user, refetch }: any) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, reset, formState: { isSubmitting, isDirty } } = useForm({
    defaultValues: {
      fullName:  user?.full_name || '',
      bio:       user?.bio || '',
      orcidId:   user?.orcid_id || '',
      phone:     user?.phone || '',
    },
  });

  useEffect(() => { if (user) reset({ fullName: user.full_name, bio: user.bio || '', orcidId: user.orcid_id || '', phone: user.phone || '' }); }, [user, reset]);

  const onSave = async (data: any) => {
    try {
      await usersApi.updateMe({ fullName: data.fullName, bio: data.bio, orcidId: data.orcidId, phone: data.phone });
      toast.success('Profile updated');
      qc.invalidateQueries({ queryKey: ['auth','me'] });
      setEditing(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Update failed');
    }
  };

  const initials = user?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase();

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error('Image must be under 3 MB'); return; }
    const fd = new FormData();
    fd.append('photo', file);
    setPhotoLoading(true);
    try {
      await api.post('/users/me/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Profile photo updated');
      qc.invalidateQueries({ queryKey: ['profile-me'] });
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Upload failed');
    } finally {
      setPhotoLoading(false);
      e.target.value = '';
    }
  };

  const levelColors: Record<string, string> = {
    'Research Pioneer': 'text-gold-700 bg-gold-50 border-gold-200',
    'Innovator':        'text-purple-700 bg-purple-50 border-purple-200',
    'Scholar':          'text-blue-700 bg-blue-50 border-blue-200',
    'Contributor':      'text-stone-600 bg-stone-50 border-stone-200',
  };

  return (
    <div className="space-y-5">
      {/* Avatar + level */}
      <div className="card p-6 flex items-start gap-5">
        <button onClick={() => photoInputRef.current?.click()} disabled={photoLoading}
          className="relative w-20 h-20 rounded-full flex-shrink-0 group focus:outline-none">
          {user?.profile_photo_url
            ? <img src={user.profile_photo_url} alt="Profile" className="w-20 h-20 rounded-full object-cover border-4 border-primary-200" />
            : <div className="w-20 h-20 rounded-full bg-primary-100 border-4 border-primary-200 flex items-center justify-center">
                <span className="text-primary-700 text-2xl font-bold">{initials}</span>
              </div>
          }
          <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {photoLoading
              ? <Loader2 size={18} className="text-white animate-spin" />
              : <Camera size={18} className="text-white" />}
          </div>
        </button>
        <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold text-stone-900">{user?.full_name}</h2>
              <p className="text-stone-500 text-sm mt-0.5">{user?.email}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {user?.roles?.map((r: string) => (
                  <span key={r} className="badge-stone badge capitalize text-xs">{r}</span>
                ))}
                {user?.current_level && (
                  <span className={`badge border text-xs font-medium ${levelColors[user.current_level] ?? 'text-stone-600 bg-stone-50 border-stone-200'}`}>
                    {user.current_level}
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => setEditing(!editing)}
              className={editing ? 'btn-secondary btn-sm' : 'btn-ghost btn-sm'}>
              <Edit3 size={13} />{editing ? 'Cancel' : 'Edit'}
            </button>
          </div>
          {user?.total_points != null && (
            <div className="mt-3 flex items-center gap-3">
              <Award size={14} className="text-gold-500" />
              <span className="text-sm font-medium text-stone-700">{user.total_points.toLocaleString()} points</span>
              {user.points_to_next && (
                <span className="text-xs text-stone-400">· {user.points_to_next} to {user.next_level}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <form onSubmit={handleSubmit(onSave)} className="card p-6 space-y-4">
          <h3 className="font-display font-semibold text-stone-900">Edit profile</h3>
          <div>
            <label className="label">Full name</label>
            <input {...register('fullName', { required: true })} className="input" />
          </div>
          <div>
            <label className="label">Bio <span className="text-stone-400 font-normal">(optional)</span></label>
            <textarea {...register('bio')} rows={3} placeholder="Tell the community about your research interests..."
              className="input resize-none" />
          </div>
          <div>
            <label className="label">ORCID iD <span className="text-stone-400 font-normal">(optional)</span></label>
            <div className="relative">
              <input {...register('orcidId')} placeholder="0000-0000-0000-0000" className="input pl-10" />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-green-600">ID</span>
            </div>
          </div>
          <div>
            <label className="label">Phone <span className="text-stone-400 font-normal">(optional)</span></label>
            <input {...register('phone')} placeholder="+234 800 000 0000" className="input" type="tel" />
          </div>
          <button type="submit" disabled={isSubmitting || !isDirty} className="btn-primary">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={14} />}
            Save changes
          </button>
        </form>
      )}

      {/* Info cards */}
      {!editing && (
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: Building2, label: 'University', value: user?.university_name },
            { icon: GraduationCap, label: 'Department', value: user?.department_name },
            { icon: Globe, label: 'ORCID iD', value: user?.orcid_id, link: user?.orcid_id ? `https://orcid.org/${user.orcid_id}` : null },
            { icon: BookOpen, label: 'Member since', value: user?.created_at ? formatDistanceToNow(new Date(user.created_at), { addSuffix: true }) : null },
          ].filter(f => f.value).map(({ icon: Icon, label, value, link }: any) => (
            <div key={label} className="card p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                <Icon size={15} className="text-stone-500" />
              </div>
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wide font-medium">{label}</p>
                {link
                  ? <a href={link} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-medium text-primary-700 hover:underline flex items-center gap-1 mt-0.5">
                      {value} <ExternalLink size={11} />
                    </a>
                  : <p className="text-sm font-medium text-stone-800 mt-0.5">{value}</p>}
              </div>
            </div>
          ))}
          {user?.bio && (
            <div className="card p-4 sm:col-span-2">
              <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-2">About</p>
              <p className="text-sm text-stone-700 leading-relaxed">{user.bio}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SecurityTab() {
  const [form, setForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPwd !== form.confirm) { toast.error('Passwords do not match'); return; }
    if (form.newPwd.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      await api.patch('/users/me/password', { currentPassword: form.current, newPassword: form.newPwd });
      toast.success('Password changed successfully');
      setForm({ current: '', newPwd: '', confirm: '' });
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to change password');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Lock size={18} className="text-stone-500" />
          <h3 className="font-display font-semibold text-stone-900">Change password</h3>
        </div>
        <form onSubmit={handleChange} className="space-y-4 max-w-sm">
          <div>
            <label className="label">Current password</label>
            <input type="password" value={form.current} onChange={e => setForm(f=>({...f,current:e.target.value}))}
              className="input" autoComplete="current-password" />
          </div>
          <div>
            <label className="label">New password</label>
            <input type="password" value={form.newPwd} onChange={e => setForm(f=>({...f,newPwd:e.target.value}))}
              placeholder="Min 8 chars, 1 uppercase, 1 number" className="input" autoComplete="new-password" />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input type="password" value={form.confirm} onChange={e => setForm(f=>({...f,confirm:e.target.value}))}
              className="input" autoComplete="new-password" />
          </div>
          <button type="submit" disabled={saving || !form.current || !form.newPwd} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={14} />} Change password
          </button>
        </form>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={18} className="text-stone-500" />
          <h3 className="font-display font-semibold text-stone-900">Session info</h3>
        </div>
        <p className="text-sm text-stone-500">You are currently logged in. Sessions expire after 7 days of inactivity.</p>
        <button onClick={async () => {
          try { await authApi.logout(); window.location.href='/auth/login'; } catch { window.location.href='/auth/login'; }
        }} className="btn-secondary btn-sm mt-4 text-red-600 hover:bg-red-50">
          Sign out of all devices
        </button>
      </div>
    </div>
  );
}

function InstitutionTab({ user }: any) {
  const subStatus = user?.subscription_status;
  const plan      = user?.plan || 'free';
  const features  = user?.features || {};

  const statusColor = subStatus === 'active' ? 'text-primary-700 bg-primary-50 border-primary-200'
    : subStatus === 'trial' ? 'text-blue-700 bg-blue-50 border-blue-200'
    : 'text-red-700 bg-red-50 border-red-200';

  const planFeatures = [
    { key: 'semantic_search',   label: 'Semantic AI search' },
    { key: 'plagiarism',        label: 'Plagiarism detection' },
    { key: 'vc_dashboard',      label: 'VC strategic dashboard' },
    { key: 'tetfund_reports',   label: 'TETFund automated reports' },
  ];

  return (
    <div className="space-y-5">
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-1">Institution</p>
            <h3 className="font-display text-xl font-semibold text-stone-900">{user?.university_name || '—'}</h3>
            {user?.department_name && <p className="text-stone-500 text-sm mt-0.5">{user.department_name}</p>}
          </div>
          {subStatus && (
            <span className={`badge border font-medium capitalize ${statusColor}`}>{subStatus}</span>
          )}
        </div>

        <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
          <div className="flex items-center justify-between mb-3">
            <p className="font-medium text-stone-900 capitalize">{plan} plan</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {planFeatures.map(({ key, label }) => (
              <div key={key} className={`flex items-center gap-2 text-sm
                ${features[key] ? 'text-stone-800' : 'text-stone-400'}`}>
                <CheckCircle2 size={14} className={features[key] ? 'text-primary-600' : 'text-stone-300'} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {!subStatus || subStatus === 'expired' ? (
        <div className="card p-6 border-2 border-dashed border-stone-300 text-center">
          <Building2 size={32} className="mx-auto mb-3 text-stone-300" />
          <h3 className="font-display font-semibold text-stone-700 mb-1">Upgrade your institution</h3>
          <p className="text-stone-400 text-sm mb-4">Contact your library administrator to upgrade to Standard or Premium for full AI features.</p>
          <a href="mailto:contact@uninms.edu.ng?subject=UniNMS Subscription Enquiry"
            className="btn-primary inline-flex">Contact UniNMS</a>
        </div>
      ) : null}
    </div>
  );
}

function ActivityTab({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ['user-points', userId],
    queryFn:  () => usersApi.points(userId),
  });
  const points   = (data?.data as any)?.recentActivity ?? [];
  const summary  = (data?.data as any)?.summary;

  const ACTION_LABELS: Record<string,string> = {
    upload_document:                'Uploaded a document',
    citation_received:              'Received a citation',
    peer_review_written:            'Wrote a peer review',
    forum_post_upvoted:             'Forum post upvoted',
    mentorship_session_complete:    'Completed mentorship session',
    handover_package_complete:      'Completed handover package',
    seminar_recording_published:    'Published seminar recording',
    implementation_claim_verified:  'Verified implementation claim',
  };

  return (
    <div className="space-y-5">
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total points',   value: (summary.total_points||0).toLocaleString() },
            { label: 'Current level',  value: summary.current_level||'Contributor' },
            { label: 'Next level',     value: summary.next_level||'Scholar' },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <p className="text-2xl font-display font-semibold text-stone-900">{s.value}</p>
              <p className="text-xs text-stone-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card p-5">
        <h3 className="font-display font-semibold text-stone-900 mb-4">Recent activity</h3>
        {points.length === 0 ? (
          <div className="text-center py-10">
            <BarChart3 size={32} className="mx-auto mb-2 text-stone-300" />
            <p className="text-stone-400 text-sm">No activity yet. Start contributing to earn points!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {points.map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-stone-100 last:border-0">
                <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <Award size={14} className="text-primary-700" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-stone-800">{ACTION_LABELS[p.action_type] || p.action_type.replace(/_/g,' ')}</p>
                  <p className="text-xs text-stone-400">{formatDistanceToNow(new Date(p.earned_at), { addSuffix: true })}</p>
                </div>
                <span className="text-sm font-semibold text-primary-700">+{p.points}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user: authUser } = useAuthStore();
  const [tab, setTab] = useState<Tab>('profile');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['profile-me'],
    queryFn:  () => authApi.me(),
  });

  const profile = (data as any)?.data;

  if (isLoading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <TabBtn label="Profile"     icon={User}      active={tab==='profile'}     onClick={()=>setTab('profile')} />
        <TabBtn label="Security"    icon={Lock}      active={tab==='security'}    onClick={()=>setTab('security')} />
        <TabBtn label="Institution" icon={Building2} active={tab==='institution'} onClick={()=>setTab('institution')} />
        <TabBtn label="Activity"    icon={Award}     active={tab==='activity'}    onClick={()=>setTab('activity')} />
      </div>

      {tab==='profile'     && <ProfileTab     user={profile} refetch={refetch} />}
      {tab==='security'    && <SecurityTab />}
      {tab==='institution' && <InstitutionTab user={profile} />}
      {tab==='activity'    && <ActivityTab    userId={authUser?.id||''} />}
    </div>
  );
}
