import {View, Text, Alert} from 'react-native'
import {Link, router} from "expo-router";
import {useState} from "react";
import * as Sentry from '@sentry/react-native'

import AuthInput from "@/components/AuthInput";
import CustomButton from "@/components/CustomButton";
import {signIn} from "@/lib/api";
import useAuthStore from "@/store/auth.store";

const SignIn = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form, setForm] = useState({ email: '', password: '' });
    const { fetchAuthenticatedUser } = useAuthStore();

    const submit = async () => {
        const { email, password } = form;

        if(!email || !password) return Alert.alert('Error', 'Please enter valid email address & password.');

        setIsSubmitting(true)

        try {
            await signIn({ email: email.trim(), password });
            await fetchAuthenticatedUser();

            router.replace('/');
        } catch(error: any) {
            Alert.alert('Error', error.message);
            Sentry.captureException(error);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <View style={{ paddingHorizontal: 24, paddingTop: 22, gap: 18 }}>
            <View style={{ gap: 4, marginBottom: 2 }}>
                <Text className="h1-bold text-dark-100">Welcome back 👋</Text>
                <Text className="paragraph-medium text-gray-200">Sign in to order your favourites.</Text>
            </View>

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
            <View style={{ gap: 12 }}>
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
                <Link href="/forgot-password" className="paragraph-semibold text-primary text-right">
                    Forgot password?
                </Link>
            </View>

            <View style={{ marginTop: 6 }}>
                <CustomButton
                    title="Sign in"
                    isLoading={isSubmitting}
                    onPress={submit}
                    style="!py-4 shadow-lg shadow-primary/40"
                    textStyle="!text-base"
                />
            </View>

            <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
                <Text className="paragraph-medium text-gray-200">New to U Angel Foods?</Text>
                <Link href="/sign-up" replace className="paragraph-bold text-primary">Create account</Link>
            </View>
        </View>
    )
}

export default SignIn
