/**
 * Auth Context for Expirly — Supabase Edition
 *
 * Uses Supabase Auth for:
 *  - Google OAuth (primary flow)
 *  - Email/password sign-in + sign-up (via Supabase)
 *  - Automatic session refresh and persistence
 *
 * On first sign-in, GET /api/auth/me syncs the Supabase user to MongoDB
 * and seeds the user's default niches.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '../types';
import { supabase } from '../lib/supabaseClient';
import { api } from '../lib/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Sync Supabase user profile to MongoDB via GET /api/auth/me.
   * The backend creates the profile + seeds niches on first call.
   */
  const syncProfile = useCallback(async (): Promise<User | null> => {
    try {
      const profile = await api.get<User>('/api/auth/me');
      setUser(profile);
      return profile;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    // Bootstrap: check if there's an active session already
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        await syncProfile();
      }
      setIsLoading(false);
    });

    // Listen for future auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
          await syncProfile();
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [syncProfile]);

  // ── Auth Actions ──────────────────────────────────────────────────

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw new Error(error.message);
  };

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    // onAuthStateChange → SIGNED_IN → syncProfile() handles the rest
  };

  const register = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    });
    if (error) throw new Error(error.message);
    // For email/password, Supabase may send a confirmation email.
    // If email confirmation is disabled in Supabase, the user is auto-signed in.
  };

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        signInWithGoogle,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
