import { ReactNode } from "react";
import { Image, ScrollView, StyleProp, StyleSheet, Text, TextStyle, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";

import CustomHeader from "@/components/CustomHeader";

const ORANGE = '#FD652A';
const LOGO_ORANGE = '#FD652A';
const NAVY = '#181C2E';
const GREY = '#878787';
const BG = '#FAFAFA';
const SUCCESS = '#2F9B65';

type IconName = keyof typeof Ionicons.glyphMap;

const IMPACT_STEPS = [
    'Every purchase helps fund our outreach programs. The profit from what you buy supports this initiative.',
    'We get to know individuals in need, understand their stories, and provide for them.',
    'We will employ and empower locals—from our food outlets to our future farms—creating a cycle of community-driven impact.',
];

const FOUNDATIONS: { icon: IconName; title: string; text: string }[] = [
    { icon: 'trending-up-outline', title: 'Sustainable Business Growth', text: 'Expanding food outlets and retail distribution' },
    { icon: 'heart-outline', title: 'Continuous Social Outreach', text: 'Feeding and supporting verified individuals in need' },
    { icon: 'briefcase-outline', title: 'Job Creation', text: 'Empowering communities through meaningful employment' },
    { icon: 'leaf-outline', title: 'Backward Integration', text: 'Farming for supply chain control and cost efficiency' },
];

const BENEFITS = [
    'Nutritious meals for the less privileged through our outreach programs',
    'Empowered communities through jobs and local partnerships',
    'Restored dignity through a personalised approach to social care',
    'Affordable, high-quality food for the general public',
    'A replicable model for community transformation without dependence on donations',
    'Supporting ministries and strengthening The Body of CHRIST',
];

const LEGACY = [
    'A child receiving food.',
    'A family receiving support.',
    'A person discovering human compassion.',
    'A customer choosing to return because of the pleasant experience we create.',
    'A business creating employment.',
    'A community choosing generosity.',
];

const CLOSING = [
    'Faith that serves.',
    'Success that gives.',
    'Business that creates.',
    'Compassion that acts.',
    'And a life that brings glory to JESUS CHRIST.',
];

/**
 * Paragraph text. Android can measure long Quicksand paragraphs a line short (the last line
 * then disappears under the next card); the simple break strategy + a little bottom room avoids it.
 */
const P = ({ style, children }: { style: StyleProp<TextStyle>; children: ReactNode }) => (
    <Text style={[style, { paddingBottom: 2 }]} textBreakStrategy="simple">{children}</Text>
);

const Section = ({ index, title, children }: { index: number; title: string; children: ReactNode }) => (
    <Animated.View entering={FadeInDown.delay(index * 80)} style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {children}
    </Animated.View>
);

const About = () => {
    const version = Constants.expoConfig?.version ?? '1.0.0';

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <CustomHeader title="About U Angel Foods" showSearch={false} />

                {/* Hero */}
                <Animated.View entering={FadeInDown} style={styles.hero}>
                    <Image
                        source={require('../assets/images/uangel-logo-white.png')}
                        style={styles.heroLogo}
                        resizeMode="contain"
                    />
                    <Text style={styles.heroTitle}>Welcome to U Angel Foods</Text>
                    <Text style={styles.heroSubtitle}>An Initiative of Ecclesia Nation</Text>
                    <View style={styles.heroDivider} />
                    <Text style={styles.heroSlogan}>U Are An Angel</Text>
                </Animated.View>

                {/* Vision & Mission */}
                <Section index={1} title="OUR VISION">
                    <View style={styles.card}>
                        <View style={styles.iconBadge}>
                            <Ionicons name="eye-outline" size={22} color={ORANGE} />
                        </View>
                        <P style={styles.body}>
                            To build a sustainable food ecosystem that uplifts communities—where every meal purchased helps provide nourishment, dignity, and hope to the less privileged.
                        </P>
                    </View>
                </Section>

                <Section index={2} title="OUR MISSION">
                    <View style={styles.card}>
                        <View style={styles.iconBadge}>
                            <Ionicons name="flag-outline" size={22} color={ORANGE} />
                        </View>
                        <P style={styles.body}>
                            To serve high-quality food and beverages to the public while using the proceeds to fund our outreach programs that feed and care for those in need: not by relying on donations, but through excellence in business.
                        </P>
                    </View>
                </Section>

                {/* About us */}
                <Section index={3} title="ABOUT US">
                    <View style={styles.card}>
                        <P style={[styles.body, styles.mb]}>
                            U Angel Foods is a social enterprise founded by Ecclesia Nation with the goal of transforming lives.
                        </P>
                        <P style={styles.body}>
                            As a social enterprise, we operate at the intersection of for-profit and non-profit organisations. Our mission is simple: to build a profitable business whose profits are channelled towards caring for the less privileged, supporting outreaches, establishing soup kitchens, and creating employment opportunities for GOD’s people.
                        </P>
                    </View>
                </Section>

                {/* Social impact model */}
                <Section index={4} title="OUR SOCIAL IMPACT MODEL">
                    <View style={styles.card}>
                        <P style={[styles.body, styles.mb]}>
                            We are committed to solving real problems—not with handouts, but with a sustainable, empowering approach. Here’s how it works:
                        </P>
                        {IMPACT_STEPS.map((step, i) => {
                            const isLast = i === IMPACT_STEPS.length - 1;
                            return (
                                <View key={step} style={styles.timelineRow}>
                                    <View style={styles.timelineRail}>
                                        <View style={styles.timelineDot}>
                                            <Text style={styles.timelineNumber}>{i + 1}</Text>
                                        </View>
                                        {!isLast && <View style={styles.timelineLine} />}
                                    </View>
                                    <Text style={[styles.body, styles.timelineText, !isLast && styles.timelineTextSpaced]}>
                                        {step}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </Section>

                {/* Sustainability plan */}
                <Section index={5} title="OUR SUSTAINABILITY PLAN">
                    <View style={styles.statement}>
                        <Ionicons name="infinite-outline" size={26} color={ORANGE} />
                        <Text style={styles.statementText}>
                            WE DON&apos;T WANT TO BUILD A CAMPAIGN. WE WANT TO BUILD A SYSTEM.
                        </Text>
                    </View>
                    <P style={[styles.body, styles.mb]}>U Angel Foods is built on the foundation of:</P>
                    <View style={styles.grid}>
                        {FOUNDATIONS.map((item) => (
                            <View key={item.title} style={styles.gridCard}>
                                <View style={styles.iconBadgeSmall}>
                                    <Ionicons name={item.icon} size={18} color={ORANGE} />
                                </View>
                                <Text style={styles.gridTitle}>{item.title}</Text>
                                <Text style={styles.small}>{item.text}</Text>
                            </View>
                        ))}
                    </View>
                </Section>

                {/* Benefits */}
                <Section index={6} title="BENEFITS TO SOCIETY">
                    <View style={styles.card}>
                        {BENEFITS.map((benefit, i) => (
                            <View key={benefit} style={[styles.checkRow, i > 0 && styles.checkRowSpaced]}>
                                <Ionicons name="checkmark-circle" size={20} color={SUCCESS} style={styles.bulletIcon} />
                                <Text style={[styles.body, styles.flex]}>{benefit}</Text>
                            </View>
                        ))}
                    </View>
                </Section>

                {/* Legacy */}
                <Section index={7} title="OUR LEGACY">
                    <P style={[styles.body, styles.mb]}>
                        One day, we want to look back and know that this name represented millions—perhaps billions—of moments where someone&apos;s dignity was restored.
                    </P>
                    <View style={styles.card}>
                        {LEGACY.map((line, i) => (
                            <View key={line} style={[styles.legacyRow, i > 0 && styles.legacyDivider]}>
                                <View style={styles.legacyDot} />
                                <Text style={[styles.bodyMedium, styles.flex]}>{line}</Text>
                            </View>
                        ))}
                    </View>
                </Section>

                {/* Honouring our father */}
                <Section index={8} title="HONOURING OUR FATHER">
                    <View style={styles.card}>
                        <P style={[styles.body, styles.mb]}>
                            At U Angel Foods, our name carries a story of honour, gratitude, and spiritual heritage.
                        </P>
                        <P style={[styles.body, styles.mb]}>
                            The name U Angel Foods was inspired by THE HOLY SPIRIT and given in honour of our spiritual father, the highly esteemed Prophet Uebert Angel, a bondservant of GOD.
                        </P>
                        <P style={styles.body}>
                            He has inspired countless people around the world through his life, ministry and commitment to the advancement of the Kingdom of GOD.
                        </P>
                    </View>

                    <View style={styles.closing}>
                        {CLOSING.map((line) => (
                            <Text key={line} style={styles.closingLine}>{line}</Text>
                        ))}
                        <View style={styles.closingDivider} />
                        <Text style={styles.signature}>Built by Ecclesia Nation</Text>
                        <Text style={styles.signatureSub}>Named in honour of Prophet Uebert Angel.</Text>
                    </View>
                </Section>

                {/* Orders, refunds and liability (client wording) */}
                <Section index={9} title="ORDERS AND DELIVERY">
                    <View style={styles.card}>
                        {[
                            'Orders are confirmed once payment succeeds.',
                            'We schedule your delivery and keep you updated. We deliver only; there is no pick-up.',
                            'Preparation times shown are estimates.',
                        ].map((line, i) => (
                            <View key={line} style={[styles.checkRow, i > 0 && styles.checkRowSpaced]}>
                                <Ionicons name="checkmark-circle" size={20} color={SUCCESS} style={styles.bulletIcon} />
                                <Text style={[styles.body, styles.flex]}>{line}</Text>
                            </View>
                        ))}
                    </View>
                </Section>

                <Section index={10} title="CANCELLATION AND REFUNDS">
                    <View style={styles.card}>
                        <P style={styles.body}>
                            If we cancel your order, you will be refunded. If there is a problem with your order, contact us as soon as possible and we will put it right.
                        </P>
                    </View>
                </Section>

                <Section index={11} title="LIABILITY">
                    <View style={styles.card}>
                        <P style={styles.body}>
                            We take great care to provide a reliable service, but we cannot promise it will always be error-free. If something goes wrong, we sincerely apologise and will always put it right. Our goal is the highest possible standard of service.
                        </P>
                    </View>
                </Section>

                <Text style={styles.footer}>U Angel Foods · v{version}</Text>
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
    mb: { marginBottom: 12 },

    hero: {
        backgroundColor: LOGO_ORANGE,
        borderRadius: 24,
        paddingVertical: 28,
        paddingHorizontal: 20,
        alignItems: 'center',
        marginTop: 8,
        ...shadow,
    },
    heroLogo: { width: 110, height: 110, marginBottom: 14 },
    heroTitle: { fontFamily: 'Quicksand-Bold', fontSize: 22, color: '#FFFFFF', textAlign: 'center' },
    heroSubtitle: {
        fontFamily: 'Quicksand-Medium',
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
        marginTop: 4,
        textAlign: 'center',
    },
    heroDivider: { width: 40, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.6)', marginVertical: 16 },
    heroSlogan: { fontFamily: 'Quicksand-Bold', fontSize: 30, color: '#FFFFFF', textAlign: 'center' },

    section: { marginTop: 28 },
    sectionTitle: {
        fontFamily: 'Quicksand-Bold',
        fontSize: 13,
        letterSpacing: 1.2,
        color: ORANGE,
        marginBottom: 12,
    },

    card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, ...shadow },
    iconBadge: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(254,140,0,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    iconBadgeSmall: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(254,140,0,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },

    body: { fontFamily: 'Quicksand-Regular', fontSize: 15, lineHeight: 23, color: NAVY },
    bodyMedium: { fontFamily: 'Quicksand-Medium', fontSize: 15, lineHeight: 22, color: NAVY },
    small: { fontFamily: 'Quicksand-Regular', fontSize: 13, lineHeight: 19, color: GREY },

    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 12 },
    bulletIcon: { marginRight: 10, marginTop: 2 },

    highlight: {
        marginTop: 14,
        backgroundColor: 'rgba(254,140,0,0.08)',
        borderLeftWidth: 4,
        borderLeftColor: ORANGE,
        borderRadius: 20,
        padding: 18,
    },
    highlightText: { fontFamily: 'Quicksand-Medium', fontSize: 15, lineHeight: 23, color: NAVY },
    highlightLead: { fontFamily: 'Quicksand-Bold', color: ORANGE },

    timelineRow: { flexDirection: 'row' },
    timelineRail: { alignItems: 'center', marginRight: 14, width: 30 },
    timelineDot: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: ORANGE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timelineNumber: { fontFamily: 'Quicksand-Bold', fontSize: 14, color: '#FFFFFF' },
    timelineLine: { flex: 1, width: 2, backgroundColor: 'rgba(254,140,0,0.3)', marginVertical: 4 },
    timelineText: { flex: 1, paddingTop: 3 },
    timelineTextSpaced: { paddingBottom: 18 },

    statement: {
        backgroundColor: NAVY,
        borderRadius: 24,
        padding: 22,
        marginBottom: 16,
        ...shadow,
    },
    statementText: {
        fontFamily: 'Quicksand-Bold',
        fontSize: 19,
        lineHeight: 27,
        color: '#FFFFFF',
        marginTop: 10,
    },

    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
    gridCard: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 14, ...shadow },
    gridTitle: { fontFamily: 'Quicksand-Bold', fontSize: 14, lineHeight: 19, color: NAVY, marginBottom: 4 },

    checkRow: { flexDirection: 'row', alignItems: 'flex-start' },
    checkRowSpaced: { marginTop: 12 },

    legacyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    legacyDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5E5' },
    legacyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ORANGE, marginRight: 12 },

    closing: {
        marginTop: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        paddingVertical: 24,
        paddingHorizontal: 20,
        alignItems: 'center',
        ...shadow,
    },
    closingLine: {
        fontFamily: 'Quicksand-SemiBold',
        fontSize: 16,
        lineHeight: 26,
        color: NAVY,
        textAlign: 'center',
    },
    closingDivider: { width: 40, height: 3, borderRadius: 2, backgroundColor: ORANGE, marginVertical: 16 },
    signature: { fontFamily: 'Quicksand-Bold', fontSize: 15, color: LOGO_ORANGE, textAlign: 'center' },
    signatureSub: { fontFamily: 'Quicksand-Medium', fontSize: 13, color: GREY, textAlign: 'center', marginTop: 4 },

    footer: {
        fontFamily: 'Quicksand-Medium',
        fontSize: 12,
        color: GREY,
        textAlign: 'center',
        marginTop: 32,
    },
});

export default About;
