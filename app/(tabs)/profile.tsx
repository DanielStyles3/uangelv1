import {useCallback, useState} from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {router, useFocusEffect} from "expo-router";
import Constants from "expo-constants";
import {Ionicons} from "@expo/vector-icons";

import Avatar from "@/components/Avatar";
import useAuthStore from "@/store/auth.store";
import {useCartStore} from "@/store/cart.store";
import useFetch from "@/lib/useFetch";
import {deleteAccount, getAffiliateSummary, getProfileStats} from "@/lib/api";
import {formatNigerianPhone} from "@/lib/format";
import ProfileInviteCard from "@/components/ProfileInviteCard";

import { notify } from "@/lib/notice";
// The invite card is a nice-to-have: if it can't load, show the "Get my code" version quietly.
const loadAffiliate = () => getAffiliateSummary().catch(() => null);

type IconName = keyof typeof Ionicons.glyphMap;

interface RowProps {
    icon: IconName;
    label: string;
    detail?: string;
    badge?: number;
    onPress: () => void;
    last?: boolean;
    tint?: string;
}

/** One settings-style row: tinted icon, label, optional detail line, count badge and chevron. */
const Row = ({ icon, label, detail, badge, onPress, last, tint = '#FD652A' }: RowProps) => (
    <TouchableOpacity style={[styles.row, !last && styles.rowDivider]} onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={label}>
        <View style={[styles.rowIcon, { backgroundColor: `${tint}1A` }]}>
            <Ionicons name={icon} size={20} color={tint} />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>{label}</Text>
            {detail ? <Text style={styles.rowDetail} numberOfLines={1}>{detail}</Text> : null}
        </View>
        {badge ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color="#C4C4CC" />
    </TouchableOpacity>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.card}>{children}</View>
    </View>
);

const Profile = () => {
    const insets = useSafeAreaInsets();
    const { user, logout, setUser, setIsAuthenticated } = useAuthStore();
    // Signing out / deleting: empty the cart AND the saved carts, so the next person on this phone sees none of it.
    const clearCart = () => useCartStore.setState({ items: [], savedCarts: [] });
    const { data: stats, refetch } = useFetch({ fn: getProfileStats });
    const [busy, setBusy] = useState<'logout' | 'delete' | null>(null);

    const { data: affiliate, refetch: refetchAffiliate } = useFetch({ fn: loadAffiliate });

    // Keep the counts (and invite earnings) fresh when coming back from an order / request.
    useFocusEffect(useCallback(() => { refetch(); refetchAffiliate(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

    const handleLogout = () => {
        notify('Log out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Log out',
                style: 'destructive',
                onPress: async () => {
                    setBusy('logout');
                    try { await logout(); } catch (e) { console.log('logout error', e); }
                    finally {
                        clearCart();
                        setBusy(null);
                        router.replace('/sign-in');
                    }
                },
            },
        ]);
    };

    const handleDelete = () => {
        notify(
            'Delete account?',
            'This permanently deletes your account, profile and saved address. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Continue',
                    style: 'destructive',
                    onPress: () => notify('Are you absolutely sure?', `Delete the account for ${user?.email}?`, [
                        { text: 'Keep my account', style: 'cancel' },
                        {
                            text: 'Delete forever',
                            style: 'destructive',
                            onPress: async () => {
                                setBusy('delete');
                                try {
                                    await deleteAccount();
                                    clearCart();
                                    setUser(null);
                                    setIsAuthenticated(false);
                                    router.replace('/sign-in');
                                    notify('Account deleted', 'Your account has been deleted.');
                                } catch (e: any) {
                                    notify('Could not delete account', e.message);
                                } finally {
                                    setBusy(null);
                                }
                            },
                        },
                    ]),
                },
            ]
        );
    };

    if (!user) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator color="#FD652A" />
            </View>
        );
    }

    const memberSince = new Date(user.created_at).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
    const address = [user.address, user.city, user.state].filter(Boolean).join(', ');
    const phone = formatNigerianPhone(user.phone);

    return (
        <View style={styles.screen}>
            <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
                {/* Header: who you are (shown once) */}
                <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
                    <View style={[styles.glow, { width: 260, height: 260, top: -120, right: -90 }]} />
                    <View style={[styles.glow, { width: 160, height: 160, bottom: -60, left: -50 }]} />

                    <View style={styles.headerRow}>
                        <View style={styles.avatarRing}>
                            <Avatar name={user.name} size={76} ring={3} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.name} numberOfLines={1}>{user.name}</Text>
                            <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
                            <View style={styles.memberPill}>
                                <Ionicons name="sparkles" size={12} color="#fff" />
                                <Text style={styles.memberText}>Member since {memberSince}</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/edit-profile')} accessibilityLabel="Edit personal details">
                            <Ionicons name="create-outline" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Invite others, earn up to 5% */}
                <View style={{ marginTop: 20, marginHorizontal: 20 }}>
                    <ProfileInviteCard summary={affiliate ?? null} />
                </View>

                <Section title="My activity">
                    <Row icon="receipt-outline" label="My orders" detail="Track, pay and view past orders" badge={stats?.orders} onPress={() => router.push('/orders')} />
                    <Row icon="calendar-outline" label="Catering & event requests" detail="Your quote requests" badge={stats?.requests} onPress={() => router.push('/requests')} last />
                </Section>

                <Section title="Account">
                    <Row icon="person-outline" label="Personal details" detail={phone ? `${user.name} · ${phone}` : 'Add your phone number'} onPress={() => router.push('/edit-profile')} />
                    <Row icon="location-outline" label="Delivery address" detail={address || 'Add your delivery address'} onPress={() => router.push('/delivery-address')} />
                    {/* Referral codes are only added at sign-up (or through an invite link), never later. */}
                    <Row icon="lock-closed-outline" label="Change password" onPress={() => router.push('/change-password')} last />
                </Section>

                <Section title="About & support">
                    <Row icon="heart-outline" label="About U Angel Foods" detail="Our mission: U Are An Angel" onPress={() => router.push('/about')} />
                    <Row icon="help-circle-outline" label="Help & FAQs" onPress={() => router.push('/help')} last />
                </Section>

                <View style={styles.section}>
                    <View style={styles.card}>
                        <TouchableOpacity style={styles.row} onPress={handleLogout} disabled={busy !== null} activeOpacity={0.7}>
                            <View style={[styles.rowIcon, { backgroundColor: '#F141411A' }]}>
                                {busy === 'logout' ? <ActivityIndicator color="#F14141" /> : <Ionicons name="log-out-outline" size={20} color="#F14141" />}
                            </View>
                            <Text style={[styles.rowLabel, { color: '#F14141', flex: 1 }]}>Log out</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={busy !== null} accessibilityRole="button">
                        {busy === 'delete'
                            ? <ActivityIndicator color="#878787" />
                            : <Text style={styles.deleteText}>Delete account</Text>}
                    </TouchableOpacity>
                </View>

                <Text style={styles.version}>U Angel Foods · v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
            </ScrollView>
        </View>
    )
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#F7F7F9' },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },

    header: {
        backgroundColor: '#FD652A',
        paddingHorizontal: 20,
        paddingBottom: 28,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        overflow: 'hidden',
    },
    glow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)' },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    avatarRing: {
        padding: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.25)',
        shadowColor: '#7a2a0b', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6,
    },
    name: { fontFamily: 'Quicksand-Bold', fontSize: 21, color: '#fff' },
    email: { fontFamily: 'Quicksand-Medium', fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    memberPill: {
        flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 8,
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)',
    },
    memberText: { fontFamily: 'Quicksand-Bold', fontSize: 11, color: '#fff' },
    editBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },

    section: { marginHorizontal: 20, marginTop: 22 },
    sectionTitle: { fontFamily: 'Quicksand-Bold', fontSize: 12, color: '#878787', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
    card: {
        backgroundColor: '#fff', borderRadius: 22, paddingHorizontal: 14,
        shadowColor: '#181C2E', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
    rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ECECF0' },
    rowIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    rowLabel: { fontFamily: 'Quicksand-Bold', fontSize: 15, color: '#181C2E' },
    rowDetail: { fontFamily: 'Quicksand-Medium', fontSize: 12.5, color: '#878787', marginTop: 2 },
    badge: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: '#FD652A', alignItems: 'center', justifyContent: 'center', marginRight: 4 },
    badgeText: { fontFamily: 'Quicksand-Bold', fontSize: 12, color: '#fff' },

    deleteBtn: { alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 20, marginTop: 6 },
    deleteText: { fontFamily: 'Quicksand-SemiBold', fontSize: 13, color: '#9A9AA3', textDecorationLine: 'underline' },
    version: { fontFamily: 'Quicksand-Medium', fontSize: 12, color: '#B0B0B8', textAlign: 'center', marginTop: 4 },
});

export default Profile
