import {View, Text, Alert} from 'react-native'
import {Link, router} from "expo-router";
import {useState} from "react";
import * as Sentry from '@sentry/react-native'

import AuthInput from "@/components/AuthInput";
import CustomButton from "@/components/CustomButton";
import {createUser} from "@/lib/api";
import useAuthStore from "@/store/auth.store";

const SignUp = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const { fetchAuthenticatedUser } = useAuthStore();

    const submit = async () => {
        const { name, email, password } = form;

        if(!name || !email || !password) return Alert.alert('Error', 'Please fill in your name, email address & password.');
        if(password.length < 6) return Alert.alert('Error', 'Password must be at least 6 characters.');

        setIsSubmitting(true)

        try {
            const { needsEmailConfirmation } = await createUser({ email: email.trim(), password, name: name.trim() });

            if (needsEmailConfirmation) {
                Alert.alert(
                    'Check your email',
                    'We sent you a confirmation link. Confirm your email, then sign in.',
                    [{ text: 'OK', onPress: () => router.replace('/sign-in') }]
                );
                return;
            }

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
                <Text className="h1-bold text-dark-100">Create account ✨</Text>
                <Text className="paragraph-medium text-gray-200">Join U Angel Foods in less than a minute.</Text>
            </View>

            <AuthInput
                label="Full name"
                icon="person-outline"
                placeholder="e.g. Ada Okafor"
                value={form.name}
                onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
            />
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
            <View style={{ gap: 8 }}>
                <AuthInput
                    label="Password"
                    icon="lock-closed-outline"
                    placeholder="At least 6 characters"
                    value={form.password}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, password: text }))}
                    secure
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="go"
                    onSubmitEditing={submit}
                />
                {form.password.length > 0 && form.password.length < 6 && (
                    <Text className="body-medium text-error ml-1">{6 - form.password.length} more character{6 - form.password.length === 1 ? '' : 's'} needed</Text>
                )}
            </View>

            <View style={{ marginTop: 6 }}>
                <CustomButton
                    title="Create account"
                    isLoading={isSubmitting}
                    onPress={submit}
                    style="!py-4 shadow-lg shadow-primary/40"
                    textStyle="!text-base"
                />
            </View>

            <Text className="body-regular text-gray-200 text-center px-4">
                By creating an account you agree to receive order and delivery updates from U Angel Foods.
            </Text>

            <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
                <Text className="paragraph-medium text-gray-200">Already have an account?</Text>
                <Link href="/sign-in" replace className="paragraph-bold text-primary">Sign in</Link>
            </View>
        </View>
    )
}

export default SignUp
