import {SafeAreaView} from "react-native-safe-area-context";
import {ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {useMemo, useState} from "react";
import {router} from "expo-router";

import CartButton from "@/components/CartButton";
import CategoryCard from "@/components/CategoryCard";
import CustomButton from "@/components/CustomButton";
import MenuCard from "@/components/MenuCard";
import PromoCarousel, {PromoSlide} from "@/components/PromoCarousel";
import ProductImage from "@/components/ProductImage";
import {getCategories, getMenu} from "@/lib/api";
import useFetch from "@/lib/useFetch";
import useAuthStore from "@/store/auth.store";
import {Category} from "@/type";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const openCategory = (c?: Category) => c && router.push({ pathname: '/category/[id]', params: { id: c.id } });

export default function Index() {
  const { user } = useAuthStore();
  const { data: categories, loading, error, refetch } = useFetch({ fn: getCategories });
  const { data: picks, refetch: refetchPicks } = useFetch({ fn: getMenu, params: { limit: 8 } });
  const [refreshing, setRefreshing] = useState(false);

  const firstName = user?.name?.trim().split(/\s+/)[0];
  // Show the saved delivery area, e.g. "Lekki, Lagos"; otherwise prompt to add one.
  const deliveryArea = [user?.city, user?.state].filter(Boolean).join(', ');
  const byName = (name: string) => categories?.find((c) => c.name === name);

  const onRefresh = async () => {
      setRefreshing(true);
      await Promise.all([refetch(), refetchPicks()]);
      setRefreshing(false);
  };

  const firstLoad = loading && !refreshing && !categories;

  // Promo banners use U Angel Foods' own photos.
  const slides: PromoSlide[] = useMemo(() => {
    const drinks = categories?.find((c) => c.name === 'Drinks & Refreshments');
    const cakes = categories?.find((c) => c.name === 'Cakes & Celebrations');
    const events = categories?.find((c) => c.name === 'Events & Celebrations');
    return [
      { id: 'drinks', eyebrow: 'Fresh & chilled', title: 'Fruit-infused drinks, made with love', cta: 'Shop drinks', color: '#FD652A',
        image: require('../../assets/images/auth/drinks.jpg'), onPress: () => openCategory(drinks) },
      { id: 'cakes', eyebrow: 'Celebrate', title: 'Cakes for every special moment', cta: 'Order a cake', color: '#9D174D',
        image: require('../../assets/images/auth/cake.jpg'), onPress: () => openCategory(cakes) },
      { id: 'events', eyebrow: 'Catering & events', title: 'Planning a party? Let us handle it', cta: 'Get a quote', color: '#181C2E',
        image: require('../../assets/images/auth/juice.jpg'),
        onPress: () => events ? router.push({ pathname: '/service-request', params: { categoryId: events.id } }) : undefined },
    ];
  }, [categories]);

  const eventsCategory = byName('Events & Celebrations');

  const header = (
    <View>
      {/* Greeting + location + cart */}
      <View className="flex-row items-center justify-between mt-4">
        <View className="flex-1 mr-4">
          <Text className="body-medium text-gray-200">{greeting()}{firstName ? `, ${firstName}` : ''} 👋</Text>
          <TouchableOpacity className="flex-row items-center gap-x-1 mt-1" onPress={() => router.push('/edit-profile')}>
            <Ionicons name="location" size={16} color="#FE8C00" />
            <Text className="paragraph-bold text-dark-100 flex-shrink" numberOfLines={1}>
              {deliveryArea || 'Set delivery address'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#181C2E" />
          </TouchableOpacity>
        </View>
        <CartButton />
      </View>

      {/* Search shortcut */}
      <Pressable style={styles.search} onPress={() => router.push('/search')} accessibilityRole="search">
        <Ionicons name="search-outline" size={20} color="#9A9AA3" />
        <Text style={styles.searchText}>Search cakes, drinks, groceries…</Text>
        <View style={styles.searchBtn}>
          <Ionicons name="options-outline" size={18} color="#fff" />
        </View>
      </Pressable>

      {/* Promo banners */}
      <View className="mt-5">
        <PromoCarousel slides={slides} />
      </View>

      {/* Quick category chips */}
      {(categories?.length ?? 0) > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ marginHorizontal: -20 }}>
          {categories!.map((c) => (
            <TouchableOpacity key={c.id} style={styles.chip} onPress={() => openCategory(c)}>
              {/* Round category photo with a ring in the category's colour */}
              <View style={[styles.chipRing, { borderColor: c.color ?? '#FE8C00' }]}>
                <View style={styles.chipPhoto}>
                  <ProductImage imageUrl={c.image_url} className="size-full" resizeMode="cover" />
                </View>
              </View>
              <Text style={styles.chipText} numberOfLines={2}>{c.name.replace(' & ', ' &\n')}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View className="flex-row items-end justify-between mt-6 mb-1">
        <View>
          <Text className="h3-bold text-dark-100">Shop by category</Text>
          <Text className="body-regular text-gray-200 mt-0.5">Everything U Angel, in one place.</Text>
        </View>
      </View>
    </View>
  );

  const footer = (categories?.length ?? 0) > 0 ? (
    <View>
      {/* Events / catering banner */}
      <Pressable
        style={styles.eventBanner}
        onPress={() => eventsCategory && router.push({ pathname: '/category/[id]', params: { id: eventsCategory.id } })}
      >
        <View style={styles.eventGlow} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.eventEyebrow}>CATERING & EVENTS</Text>
          <Text style={styles.eventTitle}>Planning an event?</Text>
          <Text style={styles.eventBody}>Weddings, birthdays, church & corporate. Tell us your budget and we&apos;ll call you with a quote.</Text>
        </View>
        <View style={styles.eventBtn}>
          <Ionicons name="arrow-forward" size={20} color="#181C2E" />
        </View>
      </Pressable>

      {/* Popular picks */}
      {(picks?.length ?? 0) > 0 && (
        <View className="mt-8">
          <View className="flex-row items-center justify-between">
            <Text className="h3-bold text-dark-100">Popular picks</Text>
            <TouchableOpacity className="flex-row items-center gap-x-1" onPress={() => router.push('/search')}>
              <Text className="paragraph-bold text-primary">See all</Text>
              <Ionicons name="chevron-forward" size={16} color="#FE8C00" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={picks ?? []}
            keyExtractor={(p) => p.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -20 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12, gap: 16 }}
            renderItem={({ item }) => (
              <View style={{ width: 168 }}>
                <MenuCard item={item} />
              </View>
            )}
          />
        </View>
      )}
    </View>
  ) : undefined;

  return (
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
          <FlatList
              data={categories ?? []}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => <CategoryCard category={item} reversed={index % 2 === 0} />}
              contentContainerClassName="pb-8 px-5"
              showsVerticalScrollIndicator={false}
              refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FE8C00" colors={['#FE8C00']} />
              }
              // Elements (not inline components) so the carousel isn't remounted on every render.
              ListHeaderComponent={header}
              ListFooterComponent={footer}
              ListEmptyComponent={
                  firstLoad ? (
                      <View className="py-20 flex-center">
                          <ActivityIndicator size="large" color="#FE8C00" />
                      </View>
                  ) : loading ? undefined : (
                      <View className="py-16 items-center gap-y-3">
                          <Text className="text-5xl">🛒</Text>
                          <Text className="paragraph-bold text-dark-100 text-center">
                              {error ? "Couldn't load categories" : 'No categories yet'}
                          </Text>
                          <Text className="body-regular text-gray-200 text-center">
                              {error ? 'Check your connection and try again.' : 'Pull down to refresh, or try again in a moment.'}
                          </Text>
                          <View className="w-40 mt-2">
                              <CustomButton title="Retry" onPress={() => refetch()} />
                          </View>
                      </View>
                  )
              }
          />
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    marginTop: 18,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: 18,
    backgroundColor: '#F5F5F7',
    gap: 10,
  },
  searchText: { flex: 1, fontFamily: 'Quicksand-Medium', fontSize: 15, color: '#9A9AA3' },
  searchBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FE8C00', alignItems: 'center', justifyContent: 'center' },
  chips: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4, gap: 10 },
  chip: { width: 88, alignItems: 'center', gap: 8 },
  chipRing: {
    width: 70, height: 70, borderRadius: 35, borderWidth: 2.5, padding: 3, backgroundColor: '#fff',
    shadowColor: '#181C2E', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  chipPhoto: { flex: 1, borderRadius: 999, overflow: 'hidden', backgroundColor: '#FFF3E6' },
  chipText: { fontFamily: 'Quicksand-SemiBold', fontSize: 11, color: '#181C2E', textAlign: 'center', lineHeight: 14 },
  eventBanner: {
    marginTop: 18,
    borderRadius: 26,
    padding: 20,
    backgroundColor: '#181C2E',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    overflow: 'hidden',
  },
  eventGlow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(253,101,42,0.25)', right: -70, top: -80 },
  eventEyebrow: { color: '#FD652A', fontFamily: 'Quicksand-Bold', fontSize: 11, letterSpacing: 1.5 },
  eventTitle: { color: '#fff', fontFamily: 'Quicksand-Bold', fontSize: 20 },
  eventBody: { color: 'rgba(255,255,255,0.75)', fontFamily: 'Quicksand-Medium', fontSize: 13, lineHeight: 18 },
  eventBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
