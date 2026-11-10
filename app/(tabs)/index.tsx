import {SafeAreaView} from "react-native-safe-area-context";
import {ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {ReactNode, useMemo, useState} from "react";
import {router} from "expo-router";

import CartButton from "@/components/CartButton";
import CustomButton from "@/components/CustomButton";
import PromoCarousel, {PromoSlide} from "@/components/PromoCarousel";
import ProductImage from "@/components/ProductImage";
import {getCampaignProgress, getCategories, getChristmasBanner,getHomeProducts, getOrders, getProductsNeedingChoices, getPromotions, HomeProduct} from "@/lib/api";
import {CAMPAIGN_FLYER, CAMPAIGN_GOAL, campaignDaysLeft, campaignLive} from "@/constants/campaign";
import {formatNaira} from "@/lib/format";
import useFetch from "@/lib/useFetch";
import useAuthStore from "@/store/auth.store";
import {useCartStore} from "@/store/cart.store";
import {Category, OrderItem} from "@/type";

const GUTTER = 20;
const ORANGE = '#FD652A';
const DARK = '#181C2E';
const ROW_SIZE = 8;       // products per category row
const TOP_RATED_SIZE = 10;

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const openCategory = (c?: Category) => c && router.push({ pathname: '/category/[id]', params: { id: c.id } });
const openProduct = (id: string) => router.push({ pathname: '/menu/[id]', params: { id } });

/**
 * Home, top to bottom. Each category appears ONCE as a circle; below that the space
 * goes to products customers can add straight from Home.
 *   greeting + delivery area → search → promos → category circles → order again
 *   → top rated → one product row per category → catering & events banner
 */
export default function Index() {
  const { user } = useAuthStore();
  const addItem = useCartStore((s) => s.addItem);
  const { data: categories, loading, error, refetch } = useFetch({ fn: getCategories });
  const { data: products, refetch: refetchProducts } = useFetch({ fn: getHomeProducts });
  const { data: orders, refetch: refetchOrders } = useFetch({ fn: getOrders, skip: !user });
  const { data: promos, refetch: refetchPromos } = useFetch({ fn: getPromotions });
  const { data: preorders, refetch: refetchPreorders } = useFetch({ fn: getCampaignProgress, skip: !campaignLive() });
  const { data: xmas, refetch: refetchXmas } = useFetch({ fn: getChristmasBanner, skip: !campaignLive() });
  const [refreshing, setRefreshing] = useState(false);

  const firstName = user?.name?.trim().split(/\s+/)[0];
  const deliveryArea = [user?.city, user?.state].filter(Boolean).join(', ');

  const productCategories = useMemo(() => (categories ?? []).filter((c) => c.kind !== 'service'), [categories]);
  const serviceCategories = useMemo(() => (categories ?? []).filter((c) => c.kind === 'service'), [categories]);

  // Products arrive best-rated first, so slicing keeps each row's best items.
  const topRated = useMemo(() => (products ?? []).slice(0, TOP_RATED_SIZE), [products]);
  const rows = useMemo(() => productCategories
      .map((category) => ({
        category,
        items: (products ?? []).filter((p) => p.main_category_id === category.id).slice(0, ROW_SIZE),
      }))
      .filter((r) => r.items.length > 0),
    [productCategories, products]);

  // Distinct products from the customer's recent paid orders, newest first.
  const orderAgain = useMemo(() => {
    const seen = new Set<string>();
    const items: OrderItem[] = [];
    for (const o of orders ?? []) {
      if (o.payment_status !== 'paid') continue;
      for (const it of o.order_items ?? []) {
        if (!it.menu_id || seen.has(it.menu_id)) continue;
        seen.add(it.menu_id);
        items.push(it);
      }
    }
    return items.slice(0, 10);
  }, [orders]);

  // Banners: the Christmas pre-order slide first (until 25 Dec), then the admin's
  // Promotions, or the two built-in ones when none are live.
  const baseSlides: PromoSlide[] = useMemo(() => {
    if (promos?.length) {
      return promos.map((p) => ({
        id: p.id,
        eyebrow: p.eyebrow ?? '',
        title: p.title,
        cta: p.cta,
        color: p.color,
        image: { uri: p.image_url },
        onPress: () => {
          if (!p.link_id) return;
          if (p.link_type === 'category') router.push({ pathname: '/category/[id]', params: { id: p.link_id } });
          else if (p.link_type === 'product') openProduct(p.link_id);
          else if (p.link_type === 'service') router.push({ pathname: '/service-request', params: { categoryId: p.link_id } });
        },
      }));
    }
    const byName = (name: string) => categories?.find((c) => c.name === name);
    return [
      { id: 'drinks', eyebrow: 'Fresh & chilled', title: 'Fruit-infused drinks, made with love', cta: 'Shop drinks', color: '#FD652A',
        image: require('../../assets/images/auth/drinks.jpg'), onPress: () => openCategory(byName('Drinks & Refreshments')) },
      { id: 'cakes', eyebrow: 'Celebrate', title: 'Cakes for every special moment', cta: 'Order a cake', color: '#E11D74',
        image: require('../../assets/images/auth/cake.jpg'), onPress: () => openCategory(byName('Cakes & Celebrations')) },
    ];
  }, [categories, promos]);

  const slides: PromoSlide[] = useMemo(() => {
    // Text/photo come from Admin › Promotions (Christmas banner); built-in values are the fallback.
    const christmas: PromoSlide[] = campaignLive() && xmas?.enabled !== false ? [{
      id: 'christmas',
      eyebrow: xmas?.eyebrow?.trim() || 'Christmas pre-order',
      title: xmas?.title?.trim() || `Help us reach ${CAMPAIGN_GOAL.toLocaleString('en-NG')} pre-orders`,
      cta: xmas?.cta?.trim() || 'Pre-order now', color: '#C8102E', ctaBackground: '#F5B301', ctaTextColor: '#181C2E', eyebrowColor: '#FDE68A',
      image: xmas?.image_url ? { uri: xmas.image_url } : CAMPAIGN_FLYER, onPress: () => router.push('/christmas'),
      progress: {
        fraction: (preorders ?? 0) / CAMPAIGN_GOAL,
        label: `${(preorders ?? 0).toLocaleString('en-NG')} so far · ${campaignDaysLeft()} day${campaignDaysLeft() === 1 ? '' : 's'} left`,
      },
    }] : [];
    return [...christmas, ...baseSlides];
  }, [preorders, baseSlides, xmas]);

  // Cakes etc. need a size/flavour first: open their page instead of adding straight away.
  const addToCart = async (p: HomeProduct) => {
    if ((await getProductsNeedingChoices()).has(p.id)) return openProduct(p.id);
    addItem({ id: p.id, name: p.name, price: p.price, image_url: p.image_url, emoji: p.emoji, customizations: [] });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchProducts(), refetchPromos(), campaignLive() ? Promise.all([refetchPreorders(), refetchXmas()]) : Promise.resolve(), user ? refetchOrders() : Promise.resolve()]);
    setRefreshing(false);
  };

  const firstLoad = loading && !refreshing && !categories;
  const failed = !loading && (error || (categories?.length ?? 0) === 0);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
      >
        {/* Greeting + delivery area + cart */}
        <View className="flex-row items-center justify-between mt-4">
          <View className="flex-1 mr-4">
            <Text className="body-medium text-gray-200">{greeting()}{firstName ? `, ${firstName}` : ''} <Ionicons name="hand-left" size={14} color="#FD652A" /></Text>
            <TouchableOpacity className="flex-row items-center gap-x-1 mt-1" onPress={() => router.push('/delivery-address')}>
              <Ionicons name="location" size={16} color={ORANGE} />
              <Text className="paragraph-bold text-dark-100 flex-shrink" numberOfLines={1}>
                {deliveryArea || 'Set delivery address'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={DARK} />
            </TouchableOpacity>
          </View>
          <CartButton />
        </View>

        {/* Search shortcut */}
        <Pressable style={styles.search} onPress={() => router.push('/search')} accessibilityRole="search">
          <Ionicons name="search-outline" size={20} color="#9A9AA3" />
          <Text style={styles.searchText}>Search cakes, drinks, groceries…</Text>
        </Pressable>

        {firstLoad ? (
          <View className="py-20 flex-center"><ActivityIndicator size="large" color={ORANGE} /></View>
        ) : failed ? (
          <View className="py-16 items-center gap-y-3">
            <Ionicons name={error ? "cloud-offline-outline" : "basket-outline"} size={52} color="#C4C4CC" />
            <Text className="paragraph-bold text-dark-100 text-center">{error ? "Couldn't load the shop" : 'Nothing here yet'}</Text>
            <Text className="body-regular text-gray-200 text-center">
              {error ? 'Check your connection and try again.' : 'Pull down to refresh, or try again in a moment.'}
            </Text>
            <View className="w-40 mt-2"><CustomButton title="Retry" onPress={() => refetch()} /></View>
          </View>
        ) : (
          <>
            {/* Promos */}
            <View style={{ marginTop: 20 }}>
              <PromoCarousel slides={slides} />
            </View>

            {/* Categories — circles only; the one place categories are listed */}
            {productCategories.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.bleed, { marginTop: 22 }]} contentContainerStyle={styles.circles}>
                {productCategories.map((c) => (
                  <TouchableOpacity key={c.id} style={styles.circle} onPress={() => openCategory(c)} accessibilityLabel={c.name}>
                    <View style={[styles.ring, { borderColor: c.color ?? ORANGE }]}>
                      <View style={styles.ringPhoto}>
                        <ProductImage imageUrl={c.image_url} className="size-full" resizeMode="cover" />
                      </View>
                    </View>
                    {/* Break only between words ("Drinks &" / "Refreshments"), shrinking slightly if needed. */}
                    <Text style={styles.circleText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} textBreakStrategy="simple">
                      {c.name.replace(' & ', ' &\n')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Order again — only for customers with past paid orders */}
            {orderAgain.length > 0 && (
              <Section title="Order again" subtitle="Your recent favourites">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.row}>
                  {orderAgain.map((it) => (
                    <Pressable key={it.menu_id!} style={styles.again} onPress={() => openProduct(it.menu_id!)}>
                      <View style={styles.againPhoto}>
                        <ProductImage imageUrl={it.image_url} className="size-full" resizeMode="cover" />
                      </View>
                      <Text style={styles.againName} numberOfLines={2}>{it.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </Section>
            )}

            {/* Top rated across the whole shop */}
            {topRated.length > 0 && (
              <ProductRow
                title="Top Rated"
                items={topRated}
                onSeeAll={() => router.push('/search')}
                onAdd={addToCart}
              />
            )}

            {/* One product row per category (replaces the old big category cards) */}
            {rows.map(({ category, items }) => (
              <ProductRow
                key={category.id}
                title={category.name}
                note={category.delivery_note}
                items={items}
                onSeeAll={() => openCategory(category)}
                onAdd={addToCart}
              />
            ))}

            {/* Catering & events — service categories, shown once */}
            {serviceCategories.length > 0 && (
              <View style={styles.services}>
                <View style={styles.servicesGlow} />
                <Text style={styles.servicesEyebrow}>CATERING & EVENTS</Text>
                <Text style={styles.servicesTitle}>Planning something special?</Text>
                <Text style={styles.servicesBody}>
                  Weddings, birthdays, church & corporate. Tell us your budget and we&apos;ll call you with a quote.
                </Text>
                <View style={styles.servicesBtns}>
                  {serviceCategories.map((c) => (
                    <TouchableOpacity key={c.id} style={styles.servicesBtn} onPress={() => openCategory(c)}>
                      <Text style={styles.servicesBtnText} numberOfLines={1}>{c.name}</Text>
                      <Ionicons name="arrow-forward" size={16} color={DARK} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, subtitle, note, onSeeAll, children }: {
  title: string;
  subtitle?: string;
  note?: string | null;
  onSeeAll?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={{ marginTop: 28 }}>
      <View className="flex-row items-end justify-between mb-3">
        <View className="flex-1 mr-3">
          <Text className="h3-bold text-dark-100" numberOfLines={1}>{title}</Text>
          {subtitle ? <Text className="body-regular text-gray-200 mt-0.5">{subtitle}</Text> : null}
          {note ? (
            <View style={styles.noteChip}><Text style={styles.noteText}><Ionicons name="bicycle" size={13} /> {note}</Text></View>
          ) : null}
        </View>
        {onSeeAll && (
          <TouchableOpacity className="flex-row items-center gap-x-1" onPress={onSeeAll} hitSlop={8}>
            <Text className="paragraph-bold text-primary">See all</Text>
            <Ionicons name="chevron-forward" size={16} color={ORANGE} />
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

function ProductRow({ title, note, items, onSeeAll, onAdd }: {
  title: string;
  note?: string | null;
  items: HomeProduct[];
  onSeeAll: () => void;
  onAdd: (p: HomeProduct) => void;
}) {
  return (
    <Section title={title} note={note} onSeeAll={onSeeAll}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.row}>
        {items.map((item) => (
          <Pressable key={item.id} style={styles.product} onPress={() => openProduct(item.id)} accessibilityLabel={item.name}>
            <View style={styles.productPhoto}>
              <ProductImage imageUrl={item.image_url} className="size-full" resizeMode="cover" />
              {item.rating ? (
                <View style={styles.rating}>
                  <Ionicons name="star" size={11} color={ORANGE} />
                  <Text style={styles.ratingText}>{Number(item.rating).toFixed(1)}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
            <View style={styles.productFoot}>
              <Text style={styles.productPrice}>{formatNaira(item.price)}</Text>
              {item.is_available === false ? (
                <Text style={styles.soldOut}>Sold out</Text>
              ) : (
                <TouchableOpacity style={styles.addBtn} onPress={() => onAdd(item)} hitSlop={8} accessibilityLabel={`Add ${item.name} to cart`}>
                  <Ionicons name="add" size={18} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Section>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', height: 52, marginTop: 18,
    paddingHorizontal: 16, borderRadius: 18, backgroundColor: '#F5F5F7', gap: 10,
  },
  searchText: { flex: 1, fontFamily: 'Quicksand-Medium', fontSize: 15, color: '#9A9AA3' },

  bleed: { marginHorizontal: -GUTTER },
  row: { paddingHorizontal: GUTTER, gap: 12, paddingBottom: 4 },

  circles: { paddingHorizontal: GUTTER, gap: 14 },
  // Wide enough that the longest single word ("Refreshments", "Celebrations") fits on one line.
  circle: { width: 86, alignItems: 'center', gap: 8 },
  ring: {
    width: 68, height: 68, borderRadius: 34, borderWidth: 2.5, padding: 3, backgroundColor: '#fff',
    shadowColor: DARK, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  ringPhoto: { flex: 1, borderRadius: 999, overflow: 'hidden', backgroundColor: '#FFF3E6' },
  circleText: { fontFamily: 'Quicksand-SemiBold', fontSize: 11, color: DARK, textAlign: 'center', lineHeight: 14 },

  noteChip: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: '#F6ECE2', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  noteText: { fontFamily: 'Quicksand-Bold', fontSize: 10, color: '#7A4419' },

  again: { width: 84, alignItems: 'center', gap: 6 },
  againPhoto: { width: 72, height: 72, borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFF3E6' },
  againName: { fontFamily: 'Quicksand-SemiBold', fontSize: 12, color: DARK, textAlign: 'center', lineHeight: 15 },

  product: {
    width: 150, padding: 8, borderRadius: 20, backgroundColor: '#fff',
    shadowColor: DARK, shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
    marginVertical: 6,
  },
  productPhoto: { height: 120, borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFF3E6' },
  rating: {
    position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3,
  },
  ratingText: { fontFamily: 'Quicksand-Bold', fontSize: 11, color: DARK },
  productName: { fontFamily: 'Quicksand-Bold', fontSize: 14, color: DARK, marginTop: 8, minHeight: 36, lineHeight: 18 },
  productFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  productPrice: { fontFamily: 'Quicksand-Bold', fontSize: 14, color: ORANGE },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  soldOut: { fontFamily: 'Quicksand-Bold', fontSize: 11, color: '#9A9AA3' },

  services: { marginTop: 28, borderRadius: 26, padding: 20, backgroundColor: DARK, overflow: 'hidden', gap: 6 },
  servicesGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(253,101,42,0.25)', right: -80, top: -90 },
  servicesEyebrow: { color: '#FD652A', fontFamily: 'Quicksand-Bold', fontSize: 11, letterSpacing: 1.5 },
  servicesTitle: { color: '#fff', fontFamily: 'Quicksand-Bold', fontSize: 20 },
  servicesBody: { color: 'rgba(255,255,255,0.75)', fontFamily: 'Quicksand-Medium', fontSize: 13, lineHeight: 18 },
  servicesBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  servicesBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff',
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '100%',
  },
  servicesBtnText: { fontFamily: 'Quicksand-Bold', fontSize: 13, color: DARK, flexShrink: 1 },
});
