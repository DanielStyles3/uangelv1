import type { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { supabase } from './supabase';

type AuthState = { session: Session | null; ready: boolean };

const AuthContext = createContext<AuthState>({ session: null, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({ session: null, ready: false });

    useEffect(() => {
        let alive = true;
        supabase.auth
            .getSession()
            .then(({ data }) => {
                if (alive) setState({ session: data.session, ready: true });
            })
            .catch(() => {
                if (alive) setState({ session: null, ready: true });
            });

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            if (alive) setState({ session, ready: true });
        });

        return () => {
            alive = false;
            sub.subscription.unsubscribe();
        };
    }, []);

    return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** The name saved at sign-up, falling back to the start of the email address. */
export const displayName = (session: Session | null) => {
    const meta = session?.user.user_metadata as { name?: string } | undefined;
    const name = meta?.name?.trim();
    if (name) return name;
    return session?.user.email?.split('@')[0] ?? 'Friend';
};
