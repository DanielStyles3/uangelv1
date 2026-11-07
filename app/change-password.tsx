import { useState } from "react";
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import CustomHeader from "@/components/CustomHeader";
import CustomButton from "@/components/CustomButton";
import AuthInput from "@/components/AuthInput";
import { updatePassword } from "@/lib/api";

export default function ChangePassword() {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const save = async () => {
        if (password.length < 6) return Alert.alert('Password', 'Your new password must be at least 6 characters.');
        if (password !== confirm) return Alert.alert('Password', 'The two passwords do not match.');

        setIsSaving(true);
        try {
            await updatePassword(password);
            Alert.alert('Password changed', 'Use your new password next time you sign in.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (e: any) {
            Alert.alert('Could not change password', e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.screen}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <CustomHeader title="Change password" showSearch={false} />
                    <Text style={styles.intro}>Choose a new password with at least 6 characters.</Text>

                    <View style={{ gap: 18 }}>
                        <AuthInput label="New password" icon="lock-closed-outline" placeholder="At least 6 characters"
                            value={password} onChangeText={setPassword} secure autoComplete="new-password" textContentType="newPassword" />
                        <AuthInput label="Confirm new password" icon="lock-closed-outline" placeholder="Type it again"
                            value={confirm} onChangeText={setConfirm} secure autoComplete="new-password" textContentType="newPassword"
                            returnKeyType="done" onSubmitEditing={save} />
                    </View>

                    <View style={{ marginTop: 28 }}>
                        <CustomButton title="Save new password" isLoading={isSaving} onPress={save} />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#fff' },
    content: { padding: 20, paddingBottom: 40 },
    intro: { fontFamily: 'Quicksand-Medium', fontSize: 14, color: '#878787', marginTop: -24, marginBottom: 24 },
});
