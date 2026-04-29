'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, BookOpen, CheckCircle2, Search, Building2, User, GraduationCap, ChevronRight, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

const schema = z.object({
  fullName:     z.string().min(2, 'Full name required'),
  email:        z.string().email('Valid institutional email required'),
  password:     z.string().min(8,'Min 8 chars').regex(/[A-Z]/,'Needs uppercase').regex(/[0-9]/,'Needs number'),
  role:         z.enum(['student','lecturer','researcher']),
  universityId: z.string().uuid('Select your university').optional(),
  departmentId: z.string().uuid().optional(),
  matricNumber: z.string().max(50).optional(),
  staffId:      z.string().max(50).optional(),
  agreeTerms:   z.literal(true,{ errorMap:()=>({ message:'You must accept terms' }) }),
});
type Form = z.infer<typeof schema>;

type University = { id: string; name: string; short_name: string; state: string; subscription_status: string; plan: string };
type Department = { id: string; name: string; code: string; faculty_name: string };

const ROLES = [
  { value: 'student',    label: 'Student',    icon: GraduationCap, desc: 'Undergraduate or postgraduate student' },
  { value: 'lecturer',   label: 'Lecturer',   icon: User,          desc: 'Academic staff member' },
  { value: 'researcher', label: 'Researcher', icon: Search,        desc: 'Research staff or postdoc' },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const [step,  setStep]  = useState(1); // 1=role, 2=details, 3=institution, 4=done
  const [universities, setUniversities] = useState<University[]>([]);
  const [departments,  setDepartments]  = useState<Department[]>([]);
  const [detected,     setDetected]     = useState<University | null>(null);
  const [uniSearch,    setUniSearch]    = useState('');

  const { register, handleSubmit, watch, setValue, trigger, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'student' },
  });

  const selectedRole = watch('role');
  const selectedUni  = watch('universityId');
  const emailValue   = watch('email');

  // Load universities on mount
  useEffect(() => {
    api.get('/auth/universities').then(r => setUniversities(r.data.data || [])).catch(() => {});
  }, []);

  // Load departments when university selected
  useEffect(() => {
    if (!selectedUni) { setDepartments([]); return; }
    api.get(`/auth/departments/${selectedUni}`).then(r => setDepartments(r.data.data || [])).catch(() => {});
  }, [selectedUni]);

  // Auto-detect institution from email
  useEffect(() => {
    if (!emailValue || !emailValue.includes('@')) return;
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/auth/detect-institution?email=${encodeURIComponent(emailValue)}`);
        if (res.data.detected && res.data.data) {
          setDetected(res.data.data);
          setValue('universityId', res.data.data.id);
        }
      } catch {}
    }, 800);
    return () => clearTimeout(timer);
  }, [emailValue, setValue]);

  const filteredUnis = universities.filter(u =>
    uniSearch === '' ||
    u.name.toLowerCase().includes(uniSearch.toLowerCase()) ||
    u.short_name.toLowerCase().includes(uniSearch.toLowerCase())
  );

  const onSubmit = async (values: Form) => {
    try {
      await api.post('/auth/register', values);
      setStep(4);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Registration failed. Please try again.');
    }
  };

  const nextStep = async () => {
    let fields: (keyof Form)[] = [];
    if (step === 1) fields = ['role'];
    if (step === 2) fields = ['fullName','email','password'];
    if (step === 3) fields = ['universityId','agreeTerms'];
    const ok = await trigger(fields);
    if (ok) setStep(s => s + 1);
  };

  // ── Step 4: Done ─────────────────────────────────────────────────────────
  if (step === 4) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-primary-50 border-2 border-primary-200 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-primary-700" />
        </div>
        <h2 className="font-display text-3xl font-semibold text-stone-900 mb-3">You're in!</h2>
        <p className="text-stone-500 mb-8">Your account has been created. Sign in to access your institution's knowledge network.</p>
        <button onClick={() => router.push('/auth/login')} className="btn-primary w-full py-3">
          Sign in now
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-xl bg-primary-800 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-semibold text-xl text-primary-800">UniNMS</span>
          </div>
          <h2 className="font-display text-3xl font-semibold text-stone-900 mb-2">Create your account</h2>
          <p className="text-stone-500 text-sm">Join Nigeria's national academic knowledge network</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[1,2,3].map(n => (
            <div key={n} className={`h-1.5 flex-1 rounded-full transition-all duration-300
              ${step > n ? 'bg-primary-700' : step === n ? 'bg-primary-400' : 'bg-stone-200'}`} />
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>

          {/* ── STEP 1: Role ──────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="card p-6">
              <h3 className="font-display text-xl font-semibold text-stone-900 mb-1">I am a...</h3>
              <p className="text-stone-500 text-sm mb-5">Your role determines what you can do on the platform.</p>
              <div className="space-y-3">
                {ROLES.map(({ value, label, icon: Icon, desc }) => (
                  <label key={value}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                      ${selectedRole === value
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-stone-200 bg-white hover:border-stone-300'}`}>
                    <input {...register('role')} type="radio" value={value} className="sr-only" />
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                      ${selectedRole === value ? 'bg-primary-700 text-white' : 'bg-stone-100 text-stone-500'}`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className={`font-medium ${selectedRole === value ? 'text-primary-900' : 'text-stone-800'}`}>{label}</p>
                      <p className="text-xs text-stone-500 mt-0.5">{desc}</p>
                    </div>
                    {selectedRole === value && <CheckCircle2 size={18} className="text-primary-700 ml-auto" />}
                  </label>
                ))}
              </div>
              <button type="button" onClick={nextStep} className="btn-primary w-full mt-6">
                Continue <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* ── STEP 2: Personal details ──────────────────────────────────── */}
          {step === 2 && (
            <div className="card p-6 space-y-4">
              <div>
                <h3 className="font-display text-xl font-semibold text-stone-900 mb-1">Personal details</h3>
                <p className="text-stone-500 text-sm mb-4">Use your institutional email for automatic university detection.</p>
              </div>
              <div>
                <label className="label">Full name</label>
                <input {...register('fullName')} placeholder="e.g. Dr. Amina Okonkwo"
                  className={`input ${errors.fullName ? 'input-error' : ''}`} />
                {errors.fullName && <p className="field-error">{errors.fullName.message}</p>}
              </div>
              <div>
                <label className="label">Institutional email</label>
                <input {...register('email')} type="email" placeholder="you@university.edu.ng"
                  className={`input ${errors.email ? 'input-error' : ''}`} />
                {errors.email && <p className="field-error">{errors.email.message}</p>}
                {detected && (
                  <div className="flex items-center gap-2 mt-2 p-2 bg-primary-50 rounded-lg border border-primary-200">
                    <CheckCircle2 size={14} className="text-primary-700 flex-shrink-0" />
                    <p className="text-xs text-primary-800">
                      Detected: <strong>{detected.name}</strong> — {detected.plan} plan
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label className="label">Password</label>
                <input {...register('password')} type="password" placeholder="Min 8 chars, 1 uppercase, 1 number"
                  className={`input ${errors.password ? 'input-error' : ''}`} />
                {errors.password && <p className="field-error">{errors.password.message}</p>}
              </div>

              {/* Role-specific fields */}
              {selectedRole === 'student' && (
                <div>
                  <label className="label">Matric number <span className="text-stone-400 font-normal">(optional)</span></label>
                  <input {...register('matricNumber')} placeholder="e.g. 2021/243456"
                    className="input" />
                </div>
              )}
              {(selectedRole === 'lecturer' || selectedRole === 'researcher') && (
                <div>
                  <label className="label">Staff ID <span className="text-stone-400 font-normal">(optional)</span></label>
                  <input {...register('staffId')} placeholder="e.g. STAFF/2019/001"
                    className="input" />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">
                  <ChevronLeft size={16} /> Back
                </button>
                <button type="button" onClick={nextStep} className="btn-primary flex-1">
                  Continue <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Institution ───────────────────────────────────────── */}
          {step === 3 && (
            <div className="card p-6 space-y-4">
              <div>
                <h3 className="font-display text-xl font-semibold text-stone-900 mb-1">Your institution</h3>
                <p className="text-stone-500 text-sm mb-1">
                  {detected
                    ? 'We detected your institution from your email. Confirm or change below.'
                    : 'Select your university to access your institution\'s knowledge base.'}
                </p>
              </div>

              {/* University selector */}
              <div>
                <label className="label">University</label>
                {detected ? (
                  <div className="p-3 bg-primary-50 rounded-xl border border-primary-200 flex items-center gap-3">
                    <Building2 size={16} className="text-primary-700 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-primary-900 text-sm">{detected.name}</p>
                      <p className="text-xs text-primary-600">{detected.state} · {detected.plan} plan</p>
                    </div>
                    <button type="button" onClick={() => { setDetected(null); setValue('universityId', undefined as any); }}
                      className="text-xs text-stone-500 hover:text-stone-700 underline">Change</button>
                  </div>
                ) : (
                  <>
                    <div className="relative mb-2">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input value={uniSearch} onChange={e => setUniSearch(e.target.value)}
                        placeholder="Search university..." className="input pl-9 py-2 text-sm" />
                    </div>
                    <div className="max-h-52 overflow-y-auto rounded-xl border border-stone-200 bg-white">
                      {filteredUnis.length === 0
                        ? <p className="text-sm text-stone-400 text-center py-6">No universities found</p>
                        : filteredUnis.map(u => (
                          <label key={u.id}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors
                              ${selectedUni === u.id ? 'bg-primary-50' : ''}`}>
                            <input {...register('universityId')} type="radio" value={u.id} className="sr-only" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-stone-900">{u.name}</p>
                              <p className="text-xs text-stone-500">{u.state} · {u.plan || 'free'} plan</p>
                            </div>
                            {selectedUni === u.id && <CheckCircle2 size={14} className="text-primary-700" />}
                            {u.subscription_status === 'suspended' && (
                              <span className="text-xs text-red-500 badge">Suspended</span>
                            )}
                          </label>
                        ))}
                    </div>
                    {errors.universityId && <p className="field-error">{errors.universityId.message}</p>}
                  </>
                )}
              </div>

              {/* Department selector */}
              {departments.length > 0 && (
                <div>
                  <label className="label">Department <span className="text-stone-400 font-normal">(optional)</span></label>
                  <select {...register('departmentId')} className="input">
                    <option value="">Select your department</option>
                    {departments.reduce((acc: any[], dep) => {
                      const lastFac = acc[acc.length-1];
                      if (!lastFac || lastFac.faculty !== dep.faculty_name) {
                        acc.push({ type:'group', faculty: dep.faculty_name });
                      }
                      acc.push({ type:'dept', ...dep });
                      return acc;
                    }, []).map((item: any, i: number) =>
                      item.type === 'group'
                        ? <optgroup key={i} label={item.faculty} />
                        : <option key={item.id} value={item.id}>{item.name}</option>
                    )}
                  </select>
                </div>
              )}

              {/* Terms */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input {...register('agreeTerms')} type="checkbox"
                  className="mt-0.5 w-4 h-4 rounded accent-primary-700 flex-shrink-0" />
                <span className="text-sm text-stone-600 leading-relaxed">
                  I agree to the Terms of Service and Privacy Policy. My data will be processed
                  in accordance with the Nigeria Data Protection Regulation (NDPR) and my
                  institution's data governance policy.
                </span>
              </label>
              {errors.agreeTerms && <p className="field-error">{errors.agreeTerms.message}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(2)} className="btn-secondary flex-1">
                  <ChevronLeft size={16} /> Back
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
                  {isSubmitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Creating...</>
                    : 'Create account'}
                </button>
              </div>
            </div>
          )}
        </form>

        <p className="text-center text-sm text-stone-500 mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-primary-700 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
