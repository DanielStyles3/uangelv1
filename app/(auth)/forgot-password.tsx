import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { Link, router } from "expo-router";
import AuthInput from "@/components/AuthInput";
import CustomButton from "@/components/CustomButton";
import { sendPasswordReset } from "@/lib/api";

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sent, setSent] = useState(false);

    const submit = async () => {
        const trimmed = email.trim();
        if (!trimmed) return Alert.alert('Error', 'Please enter your email address.');

        setIsSubmitting(true);
        try {
            await sendPasswordReset(trimmed);
            setSent(true);
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <View style={{ paddingHorizontal: 24, paddingTop: 22, gap: 18 }}>
            <View style={{ gap: 4 }}>
                <Text className="h1-bold text-dark-100">Forgot password? 🔑</Text>
                <Text className="paragraph-medium text-gray-200">
                    {sent
                        ? `If an account exists for ${email.trim()}, we've sent a link to reset your password. Open it on this phone.`
                        : "Enter the email you signed up with and we'll send you a reset link."}
                </Text>
            </View>

            {!sent && (
                <>
                    <AuthInput
                        label="Email"
                        icon="mail-outline"
                        placeholder="you@example.com"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoComplete="email"
                        textContentType="emailAddress"
                        returnKeyType="send"
                        onSubmitEditing={submit}
                    />
                    <CustomButton
                        title="Send reset link"
                        isLoading={isSubmitting}
                        onPress={submit}
                        style="!py-4 shadow-lg shadow-primary/40"
                        textStyle="!text-base"
                    />
                </>
            )}

            {sent && (
                <CustomButton
                    title="Back to sign in"
                    onPress={() => router.replace('/sign-in')}
                    style="!py-4 shadow-lg shadow-primary/40"
                    textStyle="!text-base"
                />
            )}

            <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
                <Text className="paragraph-medium text-gray-200">Remembered it?</Text>
                <Link href="/sign-in" replace className="paragraph-bold text-primary">Sign in</Link>
            </View>
        </View>
    );
}
