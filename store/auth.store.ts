import { create } from 'zustand';
import {User} from "@/type";
import {getCurrentUser, signOut} from "@/lib/api";
import {clearPersonalCache} from "@/lib/dataCache";

type AuthState = {
    isAuthenticated: boolean;
    user: User | null;
    isLoading: boolean;

    setIsAuthenticated: (value: boolean) => void;
    setUser: (user: User | null) => void;
    setLoading: (loading: boolean) => void;

    fetchAuthenticatedUser: () => Promise<void>;
    logout: () => Promise<void>;
}

const useAuthStore = create<AuthState>((set) => ({
    isAuthenticated: false,
    user: null,
    isLoading: true,

    setIsAuthenticated: (value) => set({ isAuthenticated: value }),
    setUser: (user) => set({ user }),
    setLoading: (value) => set({isLoading: value}),

    // isLoading starts as true and is only cleared here; we don't flip it back to true on
    // later calls, otherwise the root layout would unmount the whole navigator mid sign-in.
    fetchAuthenticatedUser: async () => {
        try {
            const user = await getCurrentUser();

            if(user) set({ isAuthenticated: true, user })
            else set( { isAuthenticated: false, user: null } );
        } catch (e) {
            console.log('fetchAuthenticatedUser error', e);
            set({ isAuthenticated: false, user: null })
        } finally {
            set({ isLoading: false });
        }
    },

    logout: async () => {
        try {
            await signOut();
        } finally {
            // Clear local state even if the server call fails (e.g. session already expired).
            clearPersonalCache();
            set({ isAuthenticated: false, user: null });
        }
    },
}))

export default useAuthStore;
