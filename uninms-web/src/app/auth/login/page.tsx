'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, BookOpen, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const router  = useRouter();
  const setAuth = useAuthStore(s => s.setAuth);
  const [showPwd, setShowPwd] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: Form) => {
    try {
      const res = await authApi.login(values) as any;
      setAuth(res.data.user, res.data.accessToken);
      toast.success(`Welcome back, ${res.data.user.fullName.split(' ')[0]}!`);
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Login failed. Check your credentials.');
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_480px]">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg,#09432c 0%,#0a5235 50%,#0d6b44 100%)' }}>
        <div className="absolute top-[-80px] right-[-80px] w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle,#d4a017,transparent)' }} />
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,.3) 39px,rgba(255,255,255,.3) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,.3) 39px,rgba(255,255,255,.3) 40px)' }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-display font-semibold text-xl">UniNMS</span>
          </div>
          <h1 className="text-white font-display font-semibold text-5xl leading-tight mb-6">
            Nigeria's living<br />academic<br />intelligence<br />network.
          </h1>
          <p className="text-white/60 text-lg leading-relaxed max-w-md">
            Connecting research, knowledge, and innovation across every university in Nigeria.
          </p>
        </div>
        <div className="relative grid grid-cols-3 gap-4">
          {[{ value: '274+', label: 'Universities' }, { value: '2M+', label: 'Students' }, { value: '18k+', label: 'Papers/year' }].map(s => (
            <div key={s.label} className="bg-white/8 rounded-2xl p-4 border border-white/10">
              <div className="text-2xl font-display text-white font-semibold">{s.value}</div>
              <div className="text-white/50 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-col justify-center px-8 py-12 sm:px-12 bg-stone-50">
        <div className="max-w-sm mx-auto w-full">
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-primary-800 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-semibold text-lg text-primary-800">UniNMS</span>
          </div>

          <h2 className="font-display text-3xl font-semibold text-stone-900 mb-2">Sign in</h2>
          <p className="text-stone-500 mb-8">Welcome back. Enter your details below.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="label" htmlFor="email">Email address</label>
              <input {...register('email')} id="email" type="email" autoComplete="email"
                placeholder="you@university.edu.ng"
                className={`input ${errors.email ? 'input-error' : ''}`} />
              {errors.email && <p className="field-error">{errors.email.message}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label !mb-0" htmlFor="password">Password</label>
              </div>
              <div className="relative">
                <input {...register('password')} id="password"
                  type={showPwd ? 'text' : 'password'} autoComplete="current-password"
                  placeholder="••••••••"
                  className={`input pr-11 ${errors.password ? 'input-error' : ''}`} />
                <button type="button" onClick={() => setShowPwd(!showPwd)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="field-error">{errors.password.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting}
              className="btn-primary w-full py-3 text-base mt-2">
              {isSubmitting
                ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in...</>
                : <>Sign in <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-sm text-stone-500 mt-6">
            Don't have an account?{' '}
            <Link href="/auth/register" className="text-primary-700 font-medium hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
