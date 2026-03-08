'use client';

import { create } from 'zustand';

const useAuthStore = create((set, get) => ({
    user: null,
    token: null,
    loading: false,
    error: null,

    // Initialize from localStorage
    init: () => {
        if (typeof window === 'undefined') return;
        const token = localStorage.getItem('iggm_token');
        const userStr = localStorage.getItem('iggm_user');
        if (token && userStr) {
            try {
                const user = JSON.parse(userStr);
                set({ user, token });
                // Verify token is still valid
                get().fetchMe(token);
            } catch {
                get().logout();
            }
        }
    },

    fetchMe: async (tokenOverride) => {
        const token = tokenOverride || get().token;
        if (!token) return;
        try {
            const res = await fetch('/api/auth/me', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                set({ user: data.user });
                localStorage.setItem('iggm_user', JSON.stringify(data.user));
            } else {
                get().logout();
            }
        } catch {
            // silently fail
        }
    },

    login: async (email, password) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                set({ loading: false, error: data.error });
                return false;
            }
            set({ user: data.user, token: data.token, loading: false, error: null });
            localStorage.setItem('iggm_token', data.token);
            localStorage.setItem('iggm_user', JSON.stringify(data.user));
            return true;
        } catch {
            set({ loading: false, error: 'Network error' });
            return false;
        }
    },

    register: async (email, password, username) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, username }),
            });
            const data = await res.json();
            if (!res.ok) {
                set({ loading: false, error: data.error });
                return false;
            }
            set({ user: data.user, token: data.token, loading: false, error: null });
            localStorage.setItem('iggm_token', data.token);
            localStorage.setItem('iggm_user', JSON.stringify(data.user));
            return true;
        } catch {
            set({ loading: false, error: 'Network error' });
            return false;
        }
    },

    updateProfile: async (profileData) => {
        const token = get().token;
        if (!token) return false;
        try {
            const res = await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(profileData),
            });
            const data = await res.json();
            if (res.ok) {
                set({ user: data.user });
                localStorage.setItem('iggm_user', JSON.stringify(data.user));
                return true;
            }
            return false;
        } catch {
            return false;
        }
    },

    changePassword: async (currentPassword, newPassword) => {
        const token = get().token;
        if (!token) return false;
        try {
            const res = await fetch('/api/auth/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            return res.ok;
        } catch {
            return false;
        }
    },

    logout: () => {
        set({ user: null, token: null, error: null });
        localStorage.removeItem('iggm_token');
        localStorage.removeItem('iggm_user');
    },

    isLoggedIn: () => !!get().token,
    isAdmin: () => get().user?.role === 'admin',
}));

export default useAuthStore;
