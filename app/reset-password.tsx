import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Linking from "expo-linking";

import CustomInput from "@/components/CustomInput";
import CustomButton from "@/components/CustomButton";
import { createSessionFromUrl, updatePassword } from "@/lib/api";
import useAuthStore from "@/store/auth.store";

type LinkState = 'checking' | 'ready' | 'invalid';

/** Opened from the password-reset email (fastfood://reset-password#access_token=...). */
export default function ResetPassword() {
    const url = Linking.useURL();
    const { fetchAuthenticatedUser } = useAuthStore();

    const [linkState, setLinkState] = useState<LinkState>('checking');
    const [linkError, setLinkError] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!url) return;

        createSessionFromUrl(url)
            .then((ok) => {
                setLinkState(ok ? 'ready' : 'invalid');
                if (!ok) setLinkError('This reset link is missing its sign-in token.');
            })
            .catch((e: Error) => {
                setLinkState('invalid');
                setLinkError(e.message);
            });
    }, [url]);

    const save = async () => {
        if (password.length < 6) return Alert.alert('Error', 'Password must be at least 6 characters.');
        if (password !== confirm) return Alert.alert('Error', 'The passwords do not match.');

        setIsSaving(true);
        try {
            await updatePassword(password);
            await fetchAuthenticatedUser();
            Alert.alert('Password updated', 'You are now signed in with your new password.');
            router.replace('/');
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white px-5 pt-10 gap-8">
            <Text className="h1-bold text-dark-100">Reset password</Text>

            {linkState === 'checking' && (
                <View className="flex-row items-center gap-3">
                    <ActivityIndicator color="#FD652A" />
                    <Text className="paragraph-medium text-gray-200">Checking your reset link…</Text>
                </View>
            )}

            {linkState === 'invalid' && (
                <View className="gap-6">
                    <Text className="paragraph-medium text-gray-200">
                        {linkError || 'This reset link is invalid or has expired.'} Please request a new one.
                    </Text>
                    <CustomButton title="Request a new link" onPress={() => router.replace('/forgot-password')} />
                </View>
            )}

            {linkState === 'ready' && (
                <View className="gap-8">
                    <CustomInput label="New password" placeholder="At least 6 characters" value={password} onChangeText={setPassword} secureTextEntry />
                    <CustomInput label="Confirm new password" placeholder="Type it again" value={confirm} onChangeText={setConfirm} secureTextEntry />
                    <CustomButton title="Save new password" isLoading={isSaving} onPress={save} />
                </View>
            )}
        </SafeAreaView>
    );
}
