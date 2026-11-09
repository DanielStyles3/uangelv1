import { useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeOut,
    LinearTransition,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import CustomHeader from "@/components/CustomHeader";

const ORANGE = '#FD652A';
const NAVY = '#181C2E';
const GREY = '#878787';
const BG = '#FAFAFA';

const FAQS: { q: string; a: string }[] = [
    {
        q: 'How do I place an order?',
        a: 'Browse categories on Home or search, add items to your cart, then tap Checkout and pay securely with Paystack.',
    },
    {
        q: 'How can I pay?',
        a: 'Pay everything online with Paystack (card, bank transfer or USSD), or choose Pay on delivery: you pay the delivery fee online first, then pay for your items to the rider in cash or by transfer. Your order is confirmed once Paystack confirms the online payment.',
    },
    {
        q: 'I closed the payment page — what now?',
        a: 'Your order stays "Awaiting payment". Open Profile → My orders, open the order and tap "Pay now". You can also cancel an unpaid order there.',
    },
    {
        q: 'How much is delivery?',
        a: '₦2,000 per order, or ₦5,000 if your order has anything from Groceries & Essentials or The Local Market.',
    },
    {
        q: 'When will The Local Market items arrive?',
        a: 'The Local Market uses standard next-day delivery.',
    },
    {
        q: 'How do I book catering or an event?',
        a: 'Open Catering on Home and choose Corporate Catering, Food Stands or Events (then your type of event). Send a request with your date, guests, budget and location, and our team will contact you with a quote. Track it in Profile → Catering & event requests.',
    },
    {
        q: 'Can I pick up my order?',
        a: 'No. We deliver every order to your door. Set your address in Profile → Delivery address.',
    },
    {
        q: 'Can I cancel an order?',
        a: "You can cancel an order while it is awaiting payment. Paid orders can't be cancelled in the app.",
    },
    {
        q: 'How do I change my delivery address or phone number?',
        a: 'Profile → Delivery address / Personal details.',
    },
    {
        q: 'I forgot my password.',
        a: 'On the Sign in screen tap "Forgot password?". We\'ll email you a 6-digit code; enter it in the app with your new password.',
    },
    {
        q: 'How do I delete my account?',
        a: 'Profile → Delete account. This permanently removes your account and data.',
    },
];

const CONTACTS: { label: string; value: string; url: string; icon: keyof typeof Ionicons.glyphMap; color: string; tint: string }[] = [
    { label: 'WhatsApp', value: '0704 905 5555', url: 'https://wa.me/2347049055555', icon: 'logo-whatsapp', color: '#1FA855', tint: '#E7F7EE' },
    { label: 'Call us', value: '0704 905 5555', url: 'tel:+2347049055555', icon: 'call-outline', color: ORANGE, tint: '#FFF1EA' },
    { label: 'Email', value: 'uangelfoods@gmail.com', url: 'mailto:uangelfoods@gmail.com', icon: 'mail-outline', color: NAVY, tint: '#EEF0F5' },
    { label: 'Instagram', value: '@uangelfoods', url: 'https://instagram.com/uangelfoods', icon: 'logo-instagram', color: '#D6249F', tint: '#FCE9F5' },
];

const FaqItem =({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) => {
    const rotation = useSharedValue(open ? 180 : 0);

    useEffect(() => {
        rotation.value = withTiming(open ? 180 : 0, { duration: 220 });
    }, [open, rotation]);

    const chevronStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    return (
        <Animated.View layout={LinearTransition.duration(220)} style={[styles.item, open && styles.itemOpen]}>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={onToggle}
                style={styles.itemHeader}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
            >
                <Text style={styles.question}>{q}</Text>
                <Animated.View style={chevronStyle}>
                    <Ionicons name="chevron-down" size={20} color={open ? ORANGE : NAVY} />
                </Animated.View>
            </TouchableOpacity>
            {open && (
                <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
                    <Text style={styles.answer}>{a}</Text>
                </Animated.View>
            )}
        </Animated.View>
    );
};

const Help = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <CustomHeader title="Help & FAQs" showSearch={false} />

                <Animated.View entering={FadeInDown} style={styles.intro}>
                    <View style={styles.introIcon}>
                        <Ionicons name="help-buoy-outline" size={24} color={ORANGE} />
                    </View>
                    <View style={styles.flex}>
                        <Text style={styles.introTitle}>How can we help?</Text>
                        <Text style={styles.introText}>Tap a question to see the answer.</Text>
                    </View>
                </Animated.View>

                <View style={styles.list}>
                    {FAQS.map((faq, i) => (
                        <Animated.View key={faq.q} entering={FadeInDown.delay(i * 60)}>
                            <FaqItem
                                q={faq.q}
                                a={faq.a}
                                open={openIndex === i}
                                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
                            />
                        </Animated.View>
                    ))}
                </View>

                <Animated.View layout={LinearTransition.duration(220)} style={styles.contact}>
                    <Ionicons name="chatbubbles-outline" size={26} color={ORANGE} />
                    <Text style={styles.contactTitle}>Still need help?</Text>
                    <Text style={styles.contactText}>Our team is happy to help. Reach us any way you like.</Text>
                    <View style={styles.contactGrid}>
                        {CONTACTS.map((c) => (
                            <TouchableOpacity
                                key={c.label}
                                style={styles.contactBtn}
                                activeOpacity={0.8}
                                onPress={() => Linking.openURL(c.url).catch(() => {})}
                                accessibilityRole="link"
                                accessibilityLabel={`${c.label}: ${c.value}`}
                            >
                                <View style={[styles.contactIcon, { backgroundColor: c.tint }]}>
                                    <Ionicons name={c.icon} size={20} color={c.color} />
                                </View>
                                <View style={styles.flex}>
                                    <Text style={styles.contactLabel}>{c.label}</Text>
                                    <Text style={styles.contactValue} numberOfLines={1}>{c.value}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={GREY} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
};

const shadow = {
    shadowColor: NAVY,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
};

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: BG },
    content: { padding: 20, paddingBottom: 40 },
    flex: { flex: 1 },

    intro: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        marginTop: 8,
        ...shadow,
    },
    introIcon: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: 'rgba(254,140,0,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    introTitle: { fontFamily: 'Quicksand-Bold', fontSize: 17, color: NAVY },
    introText: { fontFamily: 'Quicksand-Regular', fontSize: 14, color: GREY, marginTop: 2 },

    list: { marginTop: 20, gap: 12 },
    item: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: 'transparent',
        overflow: 'hidden',
        ...shadow,
    },
    itemOpen: { borderColor: 'rgba(254,140,0,0.35)' },
    itemHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 },
    question: { flex: 1, fontFamily: 'Quicksand-SemiBold', fontSize: 15, lineHeight: 21, color: NAVY },
    answer: {
        fontFamily: 'Quicksand-Regular',
        fontSize: 14,
        lineHeight: 22,
        color: GREY,
        paddingBottom: 16,
    },

    contact: {
        marginTop: 24,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 22,
        alignItems: 'center',
        ...shadow,
    },
    contactTitle: { fontFamily: 'Quicksand-Bold', fontSize: 17, color: NAVY, marginTop: 8 },
    contactText: { fontFamily: 'Quicksand-Regular', fontSize: 14, color: GREY, marginTop: 4, textAlign: 'center' },
    contactGrid: { alignSelf: 'stretch', gap: 10, marginTop: 16 },
    contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: BG },
    contactIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    contactLabel: { fontFamily: 'Quicksand-Bold', fontSize: 14.5, color: NAVY },
    contactValue: { fontFamily: 'Quicksand-Medium', fontSize: 13, color: GREY, marginTop: 1 },
});

export default Help;
