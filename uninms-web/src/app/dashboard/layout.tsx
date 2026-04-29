'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Bell, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { Sidebar } from '@/components/layout/Sidebar';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isHydrated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const roles = user?.roles ?? [];
  const theme = (() => {
    if (roles.some(r => ['admin', 'super_admin'].includes(r))) return 'admin';
    if (roles.includes('management'))                          return 'management';
    if (roles.includes('lecturer'))                            return 'lecturer';
    if (roles.includes('researcher'))                          return 'researcher';
    if (roles.some(r => ['community_rep', 'industry_partner'].includes(r))) return 'community';
    return 'student';
  })();

  const { data: notifData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn:  () => notificationsApi.list({ limit: 1 }),
    refetchInterval: 60000,
    enabled: !!user,
  });
  const unreadCount = (notifData?.data as any)?.unreadCount ?? 0;

  useEffect(() => {
    if (isHydrated && !user) router.push('/auth/login');
  }, [isHydrated, user, router]);

  if (!isHydrated || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
    </div>
  );

  const pageTitle = (() => {
    const seg = pathname.split('/').filter(Boolean);
    if (!seg.length || seg[0] === 'dashboard') return 'Dashboard';
    const last = seg[seg.length - 1];
    return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
  })();

  return (
    <div className="flex h-screen overflow-hidden" data-theme={theme} style={{ backgroundColor: 'var(--page-bg)' }}>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 border-b border-stone-200 bg-white/80 backdrop-blur-sm flex items-center px-4 gap-4 sticky top-0 z-20">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg text-stone-500 hover:bg-stone-100">
            <Menu size={20} />
          </button>
          <h1 className="font-display font-semibold text-stone-900 text-lg flex-1 capitalize">{pageTitle}</h1>
          <Link href="/notifications" className="relative p-2 rounded-lg text-stone-500 hover:bg-stone-100">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-800)' }}>
            <span className="text-white text-xs font-semibold">
              {user?.fullName?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
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
