'use client';

import { create } from 'zustand';

function getStorage() {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.localStorage;
}

const useAuthStore = create((set, get) => ({
    user: null,
    token: null,
    loading: false,
    error: null,

    // Initialize from localStorage
    init: () => {
        const storage = getStorage();
        if (!storage) return;
        const token = storage.getItem('iggm_token');
        const userStr = storage.getItem('iggm_user');
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
                getStorage()?.setItem('iggm_user', JSON.stringify(data.user));
            } else {
                get().logout();
            }
        } catch {
            // silently fail
        }
    },

    login: async (email, password, verifyCode = '') => {
        set({ loading: true, error: null });
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, verifyCode }),
            });
            const data = await res.json();
            if (!res.ok) {
                set({ loading: false, error: data.error });
                return false;
            }
            set({ user: data.user, token: data.token, loading: false, error: null });
            getStorage()?.setItem('iggm_token', data.token);
            getStorage()?.setItem('iggm_user', JSON.stringify(data.user));
            return true;
        } catch {
            set({ loading: false, error: 'Network error' });
            return false;
        }
    },

    register: async (email, password, username, verifyCode) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, username, verifyCode }),
            });
            const data = await res.json();
            if (!res.ok) {
                set({ loading: false, error: data.error });
                return false;
            }
            set({ user: data.user, token: data.token, loading: false, error: null });
            getStorage()?.setItem('iggm_token', data.token);
            getStorage()?.setItem('iggm_user', JSON.stringify(data.user));
            return true;
        } catch {
            set({ loading: false, error: 'Network error' });
            return false;
        }
    },

    sendVerificationCode: async (email, purpose) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch('/api/auth/verification-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, purpose }),
            });
            const data = await res.json();
            if (!res.ok) {
                set({ loading: false, error: data.error || 'Failed to send verification code' });
                return { success: false, message: data.error || 'Failed to send verification code' };
            }
            set({ loading: false, error: null });
            return { success: true, message: data.message || 'Verification code sent.' };
        } catch {
            set({ loading: false, error: 'Network error' });
            return { success: false, message: 'Network error' };
        }
    },

    completeOAuthLogin: async (token) => {
        if (!token) return false;
        set({ loading: true, error: null });
        try {
            const res = await fetch('/api/auth/me', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) {
                set({ loading: false, error: data.error || 'OAuth sign-in failed' });
                return false;
            }
            set({ user: data.user, token, loading: false, error: null });
            getStorage()?.setItem('iggm_token', token);
            getStorage()?.setItem('iggm_user', JSON.stringify(data.user));
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
                getStorage()?.setItem('iggm_user', JSON.stringify(data.user));
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
        getStorage()?.removeItem('iggm_token');
        getStorage()?.removeItem('iggm_user');
    },

    isLoggedIn: () => !!get().token,
    isAdmin: () => get().user?.role === 'admin',
}));

export default useAuthStore;
