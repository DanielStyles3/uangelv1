import { Alert, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import * as Sentry from "@sentry/react-native";

import AuthInput from "@/components/AuthInput";
import AuthScreen, { AuthButton, AuthGhostButton, authStyles } from "@/components/AuthScreen";
import { signIn } from "@/lib/api";
import useAuthStore from "@/store/auth.store";

const SignIn = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form, setForm] = useState({ email: "", password: "" });
    const { fetchAuthenticatedUser } = useAuthStore();

    const submit = async () => {
        const { email, password } = form;

        if (!email || !password) return Alert.alert("Error", "Please enter valid email address & password.");

        setIsSubmitting(true);

        try {
            await signIn({ email: email.trim(), password });
            await fetchAuthenticatedUser();

            router.replace("/");
        } catch (error: any) {
            Alert.alert("Error", error.message);
            Sentry.captureException(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AuthScreen
            title={"Welcome\nback."}
            subtitle="Sign in to order your favourites."
            footer={
                <>
                    <Text style={authStyles.onOrange}>New to U Angel Foods?</Text>
                    <AuthGhostButton title="Create an account" onPress={() => router.push("/sign-up")} />
                    <Text style={authStyles.onOrangeSmall}>Every order feeds someone in need</Text>
                </>
            }
        >
            <AuthInput
                label="Email"
                icon="mail-outline"
                placeholder="you@example.com"
                value={form.email}
                onChangeText={(text) => setForm((prev) => ({ ...prev, email: text }))}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
            />
            <View style={{ gap: 10 }}>
                <AuthInput
                    label="Password"
                    icon="lock-closed-outline"
                    placeholder="Your password"
                    value={form.password}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, password: text }))}
                    secure
                    autoComplete="password"
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={submit}
                />
                <TouchableOpacity onPress={() => router.push("/forgot-password")} hitSlop={10} style={{ alignSelf: "flex-end" }} accessibilityRole="link">
                    <Text style={authStyles.link}>Forgot password?</Text>
                </TouchableOpacity>
            </View>

            <AuthButton title="Sign in" loading={isSubmitting} onPress={submit} />
        </AuthScreen>
    );
};

export default SignIn;
