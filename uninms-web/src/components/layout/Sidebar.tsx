'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, BookOpen, Search, MessageSquare, Brain, Award,
  GraduationCap, Package, Globe, LogOut, X, FileText,
  Users, User, BookMarked, BarChart3, UserPlus, Bell, ClipboardList,
  ShieldCheck, Settings, Building2, CreditCard, Star, TrendingUp,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface NavItem {
  href:     string;
  icon:     React.ElementType;
  label:    string;
  section?: string;
}

// ── Role-specific nav definitions ─────────────────────────────────────────────

const studentNav: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/profile',   icon: User,            label: 'My profile' },
  { href: '/courses',   icon: BookMarked,      label: 'My courses', section: 'Learning' },
  { href: '/repository',icon: BookOpen,        label: 'Repository & Search' },
  { href: '/journals',  icon: BookOpen,        label: 'Journals',   section: 'Research' },
  { href: '/journals/my/submissions', icon: FileText, label: 'My submissions' },
  { href: '/forums',    icon: MessageSquare,   label: 'Forums',     section: 'Community' },
  { href: '/mentorship',icon: GraduationCap,   label: 'Mentorship' },
];

const lecturerNav: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/profile',   icon: User,            label: 'My profile' },
  { href: '/courses',   icon: BookMarked,      label: 'My courses', section: 'Teaching' },
  { href: '/repository',icon: BookOpen,        label: 'Repository' },
  { href: '/search',    icon: Search,          label: 'Search' },
  { href: '/research',  icon: FileText,        label: 'Research pipeline', section: 'Research' },
  { href: '/journals',  icon: BookOpen,        label: 'Journals' },
  { href: '/journals/my/submissions', icon: FileText, label: 'My submissions' },
  { href: '/reviewer',  icon: Star,            label: 'Review assignments' },
  { href: '/forums',    icon: MessageSquare,   label: 'Forums',     section: 'Community' },
  { href: '/mentorship',icon: GraduationCap,   label: 'Mentorship' },
];

const researcherNav: NavItem[] = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/profile',      icon: User,            label: 'My profile' },
  { href: '/repository',   icon: BookOpen,        label: 'Repository',        section: 'Research' },
  { href: '/search',       icon: Search,          label: 'Search' },
  { href: '/research',     icon: FileText,        label: 'Research pipeline' },
  { href: '/journals',     icon: BookOpen,        label: 'Journals' },
  { href: '/journals/my/submissions', icon: FileText, label: 'My submissions' },
  { href: '/reviewer',     icon: Star,            label: 'Review assignments' },
  { href: '/groups',       icon: Users,           label: 'Research groups' },
  { href: '/intelligence', icon: Brain,           label: 'AI Insights',        section: 'Intelligence' },
  { href: '/forums',       icon: MessageSquare,   label: 'Forums',             section: 'Community' },
  { href: '/mentorship',   icon: GraduationCap,   label: 'Mentorship' },
  { href: '/handover',     icon: Package,         label: 'Knowledge transfer', section: 'Knowledge' },
];

const adminNav: NavItem[] = [
  { href: '/dashboard',              icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/profile',                icon: User,            label: 'My profile' },
  // Admin
  { href: '/admin/users',            icon: UserPlus,        label: 'User management',    section: 'Administration' },
  { href: '/admin/moderation',       icon: ShieldCheck,     label: 'Moderation' },
  { href: '/admin/analytics',        icon: BarChart3,       label: 'Analytics' },
  { href: '/admin/announcements',    icon: Bell,            label: 'Announcements' },
  { href: '/admin/audit-log',        icon: ClipboardList,   label: 'Audit log' },
  { href: '/admin/settings',         icon: Settings,        label: 'Settings' },
  { href: '/admin/billing',          icon: CreditCard,      label: 'Billing & plans' },
  { href: '/admin/tetfund',          icon: TrendingUp,      label: 'TETFund report',  section: 'Reporting' },
  // Academic
  { href: '/courses',                icon: BookMarked,      label: 'Courses',            section: 'Academic' },
  { href: '/repository',             icon: BookOpen,        label: 'Repository' },
  { href: '/admin/journals',         icon: BookOpen,        label: 'Manage journals',    section: 'Journals' },
  { href: '/journals',               icon: BookOpen,        label: 'Browse journals' },
  { href: '/reviewer',               icon: Star,            label: 'Review assignments' },
  { href: '/research',               icon: FileText,        label: 'Research pipeline',  section: 'Research' },
  { href: '/groups',                 icon: Users,           label: 'Research groups' },
  { href: '/intelligence',           icon: Brain,           label: 'AI Insights',        section: 'Intelligence' },
  { href: '/forums',                 icon: MessageSquare,   label: 'Forums',             section: 'Community' },
];

const superAdminNav: NavItem[] = [
  { href: '/dashboard',                  icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/profile',                    icon: User,            label: 'My profile' },
  // Platform management
  { href: '/superadmin/universities',    icon: Building2,       label: 'Universities',         section: 'Platform' },
  { href: '/superadmin/users',           icon: Users,           label: 'Platform users' },
  { href: '/superadmin/plans',           icon: CreditCard,      label: 'Subscription plans' },
  { href: '/superadmin/analytics',       icon: BarChart3,       label: 'Global analytics' },
  { href: '/superadmin/announcements',   icon: Bell,            label: 'Announcements' },
  { href: '/superadmin/audit-log',       icon: ClipboardList,   label: 'Audit log' },
  { href: '/superadmin/settings',        icon: Settings,        label: 'Platform settings' },
  { href: '/superadmin/tetfund',         icon: TrendingUp,      label: 'TETFund reports',   section: 'Reporting' },
];

const communityNav: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/profile',   icon: User,            label: 'My profile' },
  { href: '/repository',icon: BookOpen,        label: 'Repository',          section: 'Knowledge' },
  { href: '/search',    icon: Search,          label: 'Search' },
  { href: '/claims',    icon: Award,           label: 'Implementation claims' },
  { href: '/national',  icon: Globe,           label: 'National hub' },
  { href: '/forums',    icon: MessageSquare,   label: 'Forums',               section: 'Community' },
];

const industryNav: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/profile',   icon: User,            label: 'My profile' },
  { href: '/repository',icon: BookOpen,        label: 'Repository',          section: 'Research' },
  { href: '/search',    icon: Search,          label: 'Search' },
  { href: '/research',  icon: FileText,        label: 'Research pipeline' },
  { href: '/claims',    icon: Award,           label: 'Implementation claims' },
  { href: '/national',  icon: Globe,           label: 'National hub' },
  { href: '/forums',    icon: MessageSquare,   label: 'Forums',               section: 'Community' },
  { href: '/mentorship',icon: GraduationCap,   label: 'Mentorship' },
];

function getNav(roles: string[]): NavItem[] {
  let base: NavItem[];
  if (roles.includes('super_admin'))                              base = superAdminNav;
  else if (roles.some(r => ['admin','management'].includes(r)))  base = adminNav;
  else if (roles.includes('lecturer'))                           base = lecturerNav;
  else if (roles.includes('researcher'))                         base = researcherNav;
  else if (roles.includes('community_rep'))                      base = communityNav;
  else if (roles.includes('industry_partner'))                   base = industryNav;
  else                                                           base = studentNav;

  const extra: NavItem[] = [];

  // Append reviewer link if not already present and user has reviewer role
  if (roles.includes('reviewer') && !base.some(n => n.href === '/reviewer')) {
    extra.push({ href: '/reviewer', icon: Star, label: 'Review assignments' });
  }

  // journal_editor: replace generic journal links with editor-specific ones
  if (roles.includes('journal_editor')) {
    if (!base.some(n => n.href === '/journals/editor/dashboard')) {
      extra.push({ href: '/journals/editor/dashboard', icon: BookOpen, label: 'My journals', section: 'Journals' });
    }
    if (!base.some(n => n.href === '/journals')) {
      extra.push({ href: '/journals', icon: BookOpen, label: 'Browse journals' });
    }
    if (!base.some(n => n.href === '/reviewer')) {
      extra.push({ href: '/reviewer', icon: Star, label: 'Review assignments' });
    }
  }

  return extra.length ? [...base, ...extra] : base;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Sidebar({ mobileOpen, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, clearAuth } = useAuthStore();

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    clearAuth();
    router.push('/auth/login');
    toast.success('Signed out');
  };

  const initials = user?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? 'UN';
  const nav      = getNav(user?.roles ?? []);

  let currentSection = '';

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} />}
      <aside className={clsx(
        'fixed top-0 left-0 h-full z-40 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )} style={{ width: 'var(--sidebar-w)', background: 'var(--sidebar-bg)' }}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-white font-display font-semibold text-base leading-none">UniNMS</div>
              <div className="text-white/40 text-[10px] mt-0.5 uppercase tracking-wider">Knowledge Network</div>
            </div>
          </div>
          {onClose && <button onClick={onClose} className="text-white/50 hover:text-white lg:hidden"><X size={18} /></button>}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {nav.map(item => {
            const showSection = item.section && item.section !== currentSection;
            if (showSection) currentSection = item.section!;
            const exactOnly = ['/dashboard', '/journals', '/admin/journals', '/reviewer'];
            const active = pathname === item.href || (
              !exactOnly.includes(item.href) &&
              pathname.startsWith(item.href)
            );
            return (
              <div key={item.href}>
                {showSection && (
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1 mt-3">
                    {item.section}
                  </p>
                )}
                <Link href={item.href} onClick={onClose}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm mb-0.5 transition-all duration-150',
                    active ? 'bg-white/12 text-white font-medium' : 'text-white/60 hover:text-white hover:bg-white/8'
                  )}>
                  <item.icon className={clsx('w-4 h-4 flex-shrink-0', active ? 'text-white' : 'text-white/50')} />
                  {item.label}
                </Link>
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/8 p-3">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/8 transition-colors group">
            <div className="w-8 h-8 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-gold-400 text-xs font-semibold">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">{user?.fullName ?? 'User'}</div>
              <div className="text-white/40 text-xs truncate capitalize">
                {user?.roles?.[0]?.replace(/_/g, ' ') ?? 'Member'}
              </div>
            </div>
            <button onClick={handleLogout}
              className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 transition-all" title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
