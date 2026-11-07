import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseKey) {
    console.warn('[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env. See .env.example.');
}

export const supabase = createClient(supabaseUrl || 'http://localhost', supabaseKey || 'missing-key', {
    auth: {
        // Persist the session on the device so users stay signed in between launches.
        // (On web during static rendering there is no window, so fall back to in-memory.)
        storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// Only refresh tokens while the app is in the foreground (recommended by Supabase for React Native).
if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (state) => {
        if (state === 'active') supabase.auth.startAutoRefresh();
        else supabase.auth.stopAutoRefresh();
    });
}
