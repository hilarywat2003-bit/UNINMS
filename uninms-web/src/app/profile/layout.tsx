'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Bell, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { Sidebar } from '@/components/layout/Sidebar';
import Link from 'next/link';

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const { user, isHydrated } = useAuthStore();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (isHydrated && !user) router.push('/auth/login');
  }, [isHydrated, user, router]);

  if (!isHydrated || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-stone-50">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b border-stone-200 bg-white/80 backdrop-blur-sm flex items-center px-4 gap-4 sticky top-0 z-20">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg text-stone-500 hover:bg-stone-100">
            <Menu size={20} />
          </button>
          <h1 className="font-display font-semibold text-stone-900 text-lg flex-1">My Profile</h1>
          <Link href="/notifications" className="relative p-2 rounded-lg text-stone-500 hover:bg-stone-100">
            <Bell size={18} />
          </Link>
          <div className="w-8 h-8 rounded-full bg-primary-800 flex items-center justify-center">
            <span className="text-white text-xs font-semibold">
              {user?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
