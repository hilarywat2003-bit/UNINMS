'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string; fullName: string; email: string;
  roles: string[]; status: string;
}

interface AuthStore {
  user:        User | null;
  accessToken: string | null;
  isHydrated:  boolean;
  setAuth:     (user: User, token: string) => void;
  clearAuth:   () => void;
  setHydrated: () => void;
  hasRole:     (role: string | string[]) => boolean;
  isAdmin:     () => boolean;
  isStaff:     () => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null, accessToken: null, isHydrated: false,

      setAuth: (user, accessToken) => {
        if (typeof window !== 'undefined') localStorage.setItem('access_token', accessToken);
        set({ user, accessToken });
      },
      clearAuth: () => {
        if (typeof window !== 'undefined') localStorage.removeItem('access_token');
        set({ user: null, accessToken: null });
      },
      setHydrated: () => set({ isHydrated: true }),

      hasRole: (role) => {
        const roles = get().user?.roles ?? [];
        return Array.isArray(role) ? role.some(r => roles.includes(r)) : roles.includes(role);
      },
      isAdmin: () => {
        const roles = get().user?.roles ?? [];
        return roles.some(r => ['admin','management','super_admin'].includes(r));
      },
      isStaff: () => {
        const roles = get().user?.roles ?? [];
        return roles.some(r => ['lecturer','researcher','admin','management','super_admin'].includes(r));
      },
    }),
    {
      name: 'uninms-auth',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : {
          getItem: () => null, setItem: () => {}, removeItem: () => {}
        } as unknown as Storage
      ),
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken }),
      onRehydrateStorage: () => (s) => s?.setHydrated(),
    }
  )
);
