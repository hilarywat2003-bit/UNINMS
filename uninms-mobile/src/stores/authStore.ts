import { create } from 'zustand';
import { authApi, usersApi, tokenStorage } from '../lib/api';

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  university?: string;
  department?: string;
  points?: number;
  level?: string;
};

type AuthState = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
};

function mapUser(u: any): User {
  return {
    id: u.id,
    name: u.full_name ?? u.fullName ?? u.name ?? 'Student',
    email: u.email,
    role: Array.isArray(u.roles) ? u.roles[0] : (u.role ?? 'student'),
    university: u.university_name ?? u.universityId ?? u.university,
    department: u.department_name ?? u.department,
    points: u.total_points ?? u.points ?? 0,
    level: u.current_level ?? u.level,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  loadUser: async () => {
    set({ isLoading: true });
    try {
      const token = await tokenStorage.get();
      if (!token) return set({ isLoading: false, isAuthenticated: false });
      const res = await usersApi.me();
      const u = res?.data ?? res;
      set({ user: mapUser(u), isAuthenticated: true });
    } catch {
      await tokenStorage.clear();
      set({ isAuthenticated: false, user: null });
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    const res = await authApi.login({ email, password });
    const payload = res?.data ?? res;
    const token = payload.accessToken ?? payload.access_token ?? payload.token;
    if (!token) throw new Error('No token returned');
    await tokenStorage.set(token);
    set({ user: mapUser(payload.user), isAuthenticated: true });
  },

  logout: async () => {
    try { await authApi.logout(); } catch {}
    await tokenStorage.clear();
    set({ user: null, isAuthenticated: false });
  },
}));
