import { create } from "zustand";
import * as authService from "@/services/auth";
import type { AuthState } from "@/types";

interface AuthActions {
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  isLoggedIn: false,
  isLoading: true,
  username: null,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const success = await authService.login(username, password);
      if (success) {
        set({ isLoggedIn: true, username, isLoading: false });
        return true;
      }
      set({ error: "Invalid credentials", isLoading: false });
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      set({ error: message, isLoading: false });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    await authService.logout();
    set({ isLoggedIn: false, username: null, isLoading: false });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const success = await authService.tryAutoLogin();
      if (success) {
        const credentials = await authService.getCredentials();
        set({
          isLoggedIn: true,
          username: credentials?.username ?? null,
          isLoading: false,
        });
      } else {
        set({ isLoggedIn: false, isLoading: false });
      }
    } catch {
      set({ isLoggedIn: false, isLoading: false });
    }
  },

  setError: (error) => set({ error }),
}));
