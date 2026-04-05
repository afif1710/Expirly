/**
 * API Client for Expirly
 * Uses REACT_APP_BACKEND_URL from environment.
 * Reads Bearer token from active Supabase session.
 */

import { supabase } from './supabaseClient';

const API_BASE =
  import.meta.env.REACT_APP_BACKEND_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  'http://localhost:8000';

class ApiClient {
  private getTokenFromStorage(): string | null {
    try {
      const raw = window.localStorage.getItem('expirly_sb_session');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.access_token ?? null;
    } catch {
      return null;
    }
  }

  private async getToken(): Promise<string | null> {
    // Supabase getSession can hang in some environments; add a timeout + storage fallback.
    const sessionPromise = supabase.auth.getSession()
      .then(({ data: { session } }) => session?.access_token ?? null)
      .catch(() => null);

    const timeoutPromise = new Promise<string | null>((resolve) => {
      window.setTimeout(() => resolve(null), 1500);
    });

    const token = await Promise.race([sessionPromise, timeoutPromise]);
    return token ?? this.getTokenFromStorage();
  }

  private async request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
    });

    if (response.status === 401) {
      await supabase.auth.signOut();
      window.location.href = '/login';
      throw new Error('Session expired. Please sign in again.');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `Request failed (${response.status})`);
    }

    return response.json();
  }

  get<T = any>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  post<T = any>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  patch<T = any>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  delete<T = any>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'DELETE',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }
}

export const api = new ApiClient();
