import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";

import CustomHeader from "@/components/CustomHeader";
import CustomButton from "@/components/CustomButton";
import RequestStatusBadge from "@/components/RequestStatusBadge";
import useFetch from "@/lib/useFetch";
import { cancelServiceRequest, getServiceRequests } from "@/lib/api";
import { formatDateTime, formatNaira } from "@/lib/format";
import { images } from "@/constants";
import { ServiceRequest } from "@/type";

const formatEventDate = (ymd: string) =>
    new Date(`${ymd}T00:00:00`).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

const CANCELLABLE = new Set(['new', 'contacted', 'quoted']);

const RequestCard = ({ request, onCancelled }: { request: ServiceRequest; onCancelled: () => void }) => {
    const [isCancelling, setIsCancelling] = useState(false);

    const confirmCancel = () =>
        Alert.alert('Cancel request', 'Are you sure you want to cancel this request?', [
            { text: 'Keep it', style: 'cancel' },
            {
                text: 'Cancel request',
                style: 'destructive',
                onPress: async () => {
                    setIsCancelling(true);
                    try {
                        await cancelServiceRequest(request.id);
                        onCancelled();
                    } catch (e: any) {
                        Alert.alert('Error', e.message);
                    } finally {
                        setIsCancelling(false);
                    }
                },
            },
        ]);

    return (
        <View className="bg-white rounded-2xl p-4 shadow-md shadow-black/10 gap-2">
            <View className="flex-between flex-row">
                <View className="flex-1 mr-3">
                    <Text className="paragraph-bold text-dark-100">{request.event_type}</Text>
                    <Text className="body-regular text-gray-200">{request.service}</Text>
                </View>
                <RequestStatusBadge status={request.status} />
            </View>

            <Text className="body-medium text-dark-100">
                📅 {formatEventDate(request.event_date)} · 👥 {request.guest_count} guests
            </Text>
            <Text className="body-medium text-dark-100">💰 Budget {formatNaira(request.budget)}</Text>
            <Text className="body-regular text-gray-200" numberOfLines={1}>
                📍 {request.address}, {request.city}, {request.state}
            </Text>
            {request.details ? <Text className="body-regular text-gray-200" numberOfLines={2}>“{request.details}”</Text> : null}
            <Text className="small-bold text-gray-200 mt-1">Sent {formatDateTime(request.created_at)}</Text>

            {CANCELLABLE.has(request.status) && (
                <View className="mt-2">
                    <CustomButton
                        title="Cancel request"
                        isLoading={isCancelling}
                        onPress={confirmCancel}
                        style="!bg-error/10 border border-error !p-2"
                        textStyle="!text-error"
                    />
                </View>
            )}
        </View>
    );
};

/** The customer's catering / event requests and their status. */
export default function Requests() {
    const { data: requests, loading, refetch } = useFetch({ fn: getServiceRequests });

    useFocusEffect(useCallback(() => { refetch(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <SafeAreaView className="flex-1 bg-white">
            <FlatList
                data={requests ?? []}
                keyExtractor={(r) => r.id}
                contentContainerClassName="px-5 pt-5 pb-10 gap-4"
                refreshControl={<RefreshControl refreshing={loading && !!requests} onRefresh={() => refetch()} tintColor="#FD652A" />}
                ListHeaderComponent={() => <CustomHeader title="My requests" showSearch={false} />}
                renderItem={({ item }) => <RequestCard request={item} onCancelled={() => refetch()} />}
                ListEmptyComponent={() =>
                    loading ? (
                        <ActivityIndicator color="#FD652A" className="mt-10" />
                    ) : (
                        <View className="flex-center gap-3 mt-10">
                            <Image source={images.emptyState} className="size-52" resizeMode="contain" />
                            <Text className="h3-bold text-dark-100">No requests yet</Text>
                            <Text className="paragraph-medium text-gray-200 text-center">
                                Planning an event? Request catering or event services from the home page.
                            </Text>
                            <View className="w-full mt-4">
                                <CustomButton title="Go to home" onPress={() => router.replace('/')} />
                            </View>
                        </View>
                    )
                }
            />
        </SafeAreaView>
    );
}
