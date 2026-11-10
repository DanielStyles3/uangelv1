import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

// Same Supabase project (and the same accounts) as the U Angel Foods shopping app.
// EXPO_PUBLIC_* from eas.json wins; app.json `extra` is the fallback so local runs work without a .env.
const extra = (Constants.expoConfig?.extra ?? {}) as { supabaseUrl?: string; supabaseKey?: string };
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseKey || '';

if (!supabaseUrl || !supabaseKey) {
    console.warn('[supabase] Missing Supabase URL or key (app.json extra / EXPO_PUBLIC_* env).');
}

export const supabase = createClient(supabaseUrl || 'http://localhost', supabaseKey || 'missing-key', {
    auth: {
        // Keep people signed in between launches. (No window during web static rendering → in-memory.)
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
