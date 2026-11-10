import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { Enter, PressableScale } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Button, Notice } from '@/components/ui';
import { useAffiliate } from '@/lib/affiliate';
import { colors, fonts, referralLink, shareMessage } from '@/lib/theme';

const QR_SIZE = 190;

const qrUrl = (link: string) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=440x440&margin=0&data=${encodeURIComponent(link)}`;

type QrState = 'loading' | 'ready' | 'failed';

/** The QR picture comes from the web: spinner while it loads, the code and link if it can't. */
function QrCode({ link, code }: { link: string; code: string }) {
    const [state, setState] = useState<QrState>('loading');
    const [attempt, setAttempt] = useState(0);

    const retry = () => {
        setState('loading');
        setAttempt((a) => a + 1);
    };

    return (
        <View style={styles.qrBox} accessible accessibilityRole="image" accessibilityLabel="QR code that opens your invite link">
            {state === 'failed' ? (
                <TouchableOpacity style={styles.qrFallback} onPress={retry} activeOpacity={0.7} accessibilityLabel="QR code didn’t load. Tap to try again">
                    <Ionicons name="qr-code-outline" size={30} color={colors.greyLight} />
                    <Text style={styles.qrFallbackCode} numberOfLines={1} adjustsFontSizeToFit>{code}</Text>
                    <Text style={styles.qrFallbackLink}>{link.replace('https://', '')}</Text>
                    <Text style={styles.qrFallbackRetry}>Tap to load the QR code</Text>
                </TouchableOpacity>
            ) : (
                <>
                    <Image
                        key={attempt}
                        source={{ uri: qrUrl(link) }}
                        style={styles.qrImage}
                        resizeMode="contain"
                        onLoad={() => setState('ready')}
                        onError={() => setState('failed')}
                    />
                    {state === 'loading' ? (
                        <View style={styles.qrLoading}>
                            <ActivityIndicator color={colors.orange} />
                        </View>
                    ) : null}
                </>
            )}
        </View>
    );
}

export default function ShareScreen() {
    const router = useRouter();
    const { summary } = useAffiliate();
    const cardRef = useRef<ComponentRef<typeof View>>(null);
    const [copied, setCopied] = useState(false);
    const [makingPicture, setMakingPicture] = useState(false);

    useEffect(() => {
        if (!copied) return;
        const t = setTimeout(() => setCopied(false), 2000);
        return () => clearTimeout(t);
    }, [copied]);

    if (!summary) return null;

    const code = summary.code ?? ''; // always set once approved (only approved affiliates reach this screen)
    const link = referralLink(code);
    const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

    const copyLink = async () => {
        try {
            await Clipboard.setStringAsync(link);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            setCopied(true);
        } catch {
            Alert.alert('Couldn’t copy', `Your link is ${link}`);
        }
    };

    const shareWhatsApp = async () => {
        Haptics.selectionAsync().catch(() => {});
        try {
            await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(shareMessage(code))}`);
        } catch {
            Alert.alert('Couldn’t open WhatsApp', 'Copy your link and paste it into WhatsApp instead.');
        }
    };

    const shareOther = async () => {
        Haptics.selectionAsync().catch(() => {});
        try {
            await Share.share({ message: shareMessage(code) });
        } catch {
            // Share sheet dismissed or unavailable: nothing to do.
        }
    };

    const sharePicture = async () => {
        if (makingPicture) return;
        setMakingPicture(true);
        try {
            if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing isn’t available on this phone.');
            const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile', fileName: `u-angel-${code}` });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share your invite' });
        } catch {
            Alert.alert('Couldn’t make the picture', 'Please try again, or use “More ways” to share your link instead.');
        } finally {
            setMakingPicture(false);
        }
    };

    return (
        <Screen white stack title="Share your code" onBack={goBack}>
            <Enter index={0}>
                {/* collapsable={false}: keeps this a real native view so it can be captured as a picture */}
                <View ref={cardRef} collapsable={false} style={styles.card}>
                    <View style={styles.cardGlow} />
                    <Text style={styles.cardKicker}>U ANGEL FOODS</Text>
                    <Text style={styles.cardTitle}>Join me and order{'\n'}good food</Text>
                    <QrCode link={link} code={code} />
                    <View style={styles.codePlate}>
                        <Text style={styles.codeText} numberOfLines={1} adjustsFontSizeToFit>{code}</Text>
                    </View>
                    <Text style={styles.cardTagline}>Every order feeds someone in need</Text>
                </View>
            </Enter>

            <Enter index={1}>
                <View style={styles.linkRow}>
                    <Text style={styles.linkText} numberOfLines={1} selectable>{link.replace('https://', '')}</Text>
                    <PressableScale style={styles.copyBtn} onPress={copyLink} accessibilityRole="button" accessibilityLabel={copied ? 'Link copied' : 'Copy link'}>
                        {copied ? <Ionicons name="checkmark" size={15} color={colors.green} /> : null}
                        <Text style={[styles.copyText, copied && styles.copyTextDone]}>{copied ? 'Copied' : 'Copy link'}</Text>
                    </PressableScale>
                </View>
            </Enter>

            <Enter index={2}>
                <Button title="Share on WhatsApp" icon="logo-whatsapp" variant="whatsapp" onPress={shareWhatsApp} />
            </Enter>

            <Enter index={3} style={styles.pair}>
                <Button title="Share picture" icon="image-outline" variant="outline" loading={makingPicture} onPress={sharePicture} style={styles.flex} />
                <Button title="More ways" icon="share-social-outline" variant="outline" onPress={shareOther} style={styles.flex} />
            </Enter>

            <Enter index={4}>
                <Notice
                    icon="information-circle-outline"
                    text="Your friend must sign up in the U Angel Foods app with your code, before their first order."
                />
            </Enter>
        </Screen>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },

    card: {
        backgroundColor: colors.orange,
        borderRadius: 30,
        paddingVertical: 22,
        paddingHorizontal: 20,
        alignItems: 'center',
        gap: 14,
        overflow: 'hidden',
    },
    cardGlow: {
        position: 'absolute',
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: colors.orangeLight,
        right: -80,
        top: -90,
    },
    cardKicker: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.6, color: colors.navy },
    cardTitle: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 27, color: colors.white, textAlign: 'center' },
    cardTagline: { fontFamily: fonts.bold, fontSize: 13, color: colors.navy, textAlign: 'center' },

    qrBox: {
        width: QR_SIZE,
        height: QR_SIZE,
        borderRadius: 22,
        backgroundColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    qrImage: { width: '100%', height: '100%' },
    qrLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    qrFallback: { alignItems: 'center', gap: 4 },
    qrFallbackCode: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: 2, color: colors.navy, marginTop: 4 },
    qrFallbackLink: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.grey, textAlign: 'center' },
    qrFallbackRetry: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.orangeDark, marginTop: 4 },

    codePlate: { backgroundColor: colors.navy, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 22, maxWidth: '100%' },
    codeText: { fontFamily: fonts.bold, fontSize: 24, letterSpacing: 6, color: colors.white, textAlign: 'center' },

    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: colors.bg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        paddingVertical: 6,
        paddingLeft: 16,
        paddingRight: 6,
    },
    linkText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.grey },
    copyBtn: {
        height: 44,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: colors.white,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    copyText: { fontFamily: fonts.bold, fontSize: 13, color: colors.navy },
    copyTextDone: { color: colors.green },

    pair: { flexDirection: 'row', gap: 10 },
});
