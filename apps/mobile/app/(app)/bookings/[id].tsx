import { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, Alert } from "react-native";
import { ConfirmSheet } from "../../../components/confirm-sheet";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  fetchBookingDetail,
  transitionBooking,
  type BookingDetail,
  type BookingStatus,
} from "../../../lib/bookings";
import { ScreenHeader } from "../../../components/screen-header";

const STATUS_STYLES: Record<BookingStatus, { bg: string; text: string; label: string }> = {
  pending:   { bg: "bg-amber-50",  text: "text-amber-700", label: "Pending" },
  confirmed: { bg: "bg-green-50",  text: "text-green-700", label: "Confirmed" },
  cancelled: { bg: "bg-gray-100",  text: "text-gray-600",  label: "Cancelled" },
  completed: { bg: "bg-gray-100",  text: "text-gray-700",  label: "Completed" },
};

type TransitionKind = "confirmed" | "completed" | "cancelled";

const TRANSITION_COPY: Record<TransitionKind, { title: string; body: string; confirm: string; destructive: boolean }> = {
  confirmed: { title: "Confirm this booking?", body: "This marks the appointment as confirmed.", confirm: "Confirm", destructive: false },
  completed: { title: "Mark completed?", body: "This marks the appointment as done.", confirm: "Mark completed", destructive: false },
  cancelled: { title: "Cancel this booking?", body: "This marks the appointment as cancelled. This can't be undone.", confirm: "Cancel booking", destructive: true },
};

function formatFull(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const datePart = start.toLocaleDateString("en-NG", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const startTime = start.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (!endsAt) return datePart + " at " + startTime;
  const endTime = new Date(endsAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: false });
  return datePart + ", " + startTime + " – " + endTime;
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [working, setWorking] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<TransitionKind | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const data = await fetchBookingDetail(id);
    if (!data) { setNotFound(true); return; }
    setBooking(data);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load()
        .catch((err) => console.error("[booking-detail] load error:", err))
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [load]),
  );

  const applyTransition = async () => {
    if (!booking || !pendingTransition) return;
    const next = pendingTransition;
    setWorking(true);
    const original = booking;
    setBooking({ ...booking, status: next });
    const result = await transitionBooking(booking.id, original.status, next);
    if (!result.ok) {
      setBooking(original);
      setWorking(false);
      setPendingTransition(null);
      Alert.alert("Could not update booking", result.error);
      return;
    }
    const refreshed = await fetchBookingDetail(booking.id);
    if (refreshed) setBooking(refreshed);
    setWorking(false);
    setPendingTransition(null);
  };

  if (loading && !booking) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <ScreenHeader title="Booking" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#9CA3AF" />
        </View>
      </SafeAreaView>
    );
  }

  if (notFound || !booking) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <ScreenHeader title="Booking" />
        <View className="flex-1 px-6 pt-8">
          <Text className="text-text text-lg font-semibold">Booking not found</Text>
          <Text className="text-textMuted text-sm mt-1">It may have been deleted or you do not have access.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const s = STATUS_STYLES[booking.status];
  const isActionable = booking.status === "pending" || booking.status === "confirmed";

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScreenHeader title="Booking" />

      <ScrollView contentContainerStyle={{ paddingBottom: 140, paddingHorizontal: 24 }}>
        <View className="pt-2 flex-row items-start justify-between">
          <Text className="text-text text-3xl font-bold flex-1 mr-3" numberOfLines={2}>{booking.title}</Text>
          <View className={`${s.bg} px-2.5 py-1 rounded-full`}>
            <Text className={`${s.text} text-xs font-medium`}>{s.label}</Text>
          </View>
        </View>

        <View className="mt-6 bg-white border border-gray-200 rounded-2xl p-4">
          <Text className="text-textMuted text-xs uppercase tracking-wider">When</Text>
          <Text className="text-text text-base font-medium mt-1">{formatFull(booking.starts_at, booking.ends_at)}</Text>
        </View>

        <View className="mt-4 bg-white border border-gray-200 rounded-2xl p-4">
          <Text className="text-textMuted text-xs uppercase tracking-wider">Customer</Text>
          <Text className="text-text text-lg font-semibold mt-1">{booking.customer_name ?? "Unknown customer"}</Text>
          {booking.customer_phone ? (
            <Text className="text-textMuted text-sm mt-0.5">{booking.customer_phone}</Text>
          ) : null}
        </View>

        {booking.product_name ? (
          <View className="mt-4 bg-white border border-gray-200 rounded-2xl p-4">
            <Text className="text-textMuted text-xs uppercase tracking-wider">Service</Text>
            <Text className="text-text text-base font-medium mt-1">{booking.product_name}</Text>
          </View>
        ) : null}

        {booking.notes ? (
          <View className="mt-4 bg-white border border-gray-200 rounded-2xl p-4">
            <Text className="text-textMuted text-xs uppercase tracking-wider">Notes</Text>
            <Text className="text-text text-sm mt-1">{booking.notes}</Text>
          </View>
        ) : null}
      </ScrollView>

      {isActionable ? (
        <View className="absolute left-0 right-0 bottom-0 px-6 pb-6 pt-3 bg-background border-t border-gray-100 flex-row gap-3">
          {booking.status === "pending" ? (
            <Pressable
              onPress={() => setPendingTransition("confirmed")}
              disabled={working}
              className="flex-1 bg-primary rounded-2xl py-4 items-center active:opacity-80"
            >
              {working ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white text-base font-semibold">Confirm</Text>}
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setPendingTransition("completed")}
              disabled={working}
              className="flex-1 bg-primary rounded-2xl py-4 items-center active:opacity-80"
            >
              {working ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white text-base font-semibold">Mark completed</Text>}
            </Pressable>
          )}
          <Pressable
            onPress={() => setPendingTransition("cancelled")}
            disabled={working}
            className="bg-white border border-gray-200 rounded-2xl py-4 px-5 items-center justify-center active:opacity-60"
          >
            <Text className="text-text text-base font-semibold">Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      <ConfirmSheet
        visible={pendingTransition !== null}
        title={pendingTransition ? TRANSITION_COPY[pendingTransition].title : ""}
        body={pendingTransition ? TRANSITION_COPY[pendingTransition].body : undefined}
        confirmLabel={pendingTransition ? TRANSITION_COPY[pendingTransition].confirm : "Confirm"}
        destructive={pendingTransition ? TRANSITION_COPY[pendingTransition].destructive : false}
        pending={working}
        onConfirm={applyTransition}
        onCancel={() => setPendingTransition(null)}
      />
    </SafeAreaView>
  );
}
