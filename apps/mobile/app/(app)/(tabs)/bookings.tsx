import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { useSession } from "../../../lib/session";
import { getActiveBusinessId } from "../../../lib/business";
import { fetchBookings, type BookingListItem, type BookingStatus } from "../../../lib/bookings";

const STATUS_STYLES: Record<BookingStatus, { bg: string; text: string; label: string }> = {
  pending:   { bg: "bg-amber-50",  text: "text-amber-700", label: "Pending" },
  confirmed: { bg: "bg-green-50",  text: "text-green-700", label: "Confirmed" },
  cancelled: { bg: "bg-gray-100",  text: "text-gray-600",  label: "Cancelled" },
  completed: { bg: "bg-gray-100",  text: "text-gray-700",  label: "Completed" },
};

function formatWhen(startsAt: string, endsAt: string | null): { date: string; time: string } {
  const start = new Date(startsAt);
  const date = start.toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric" });
  const startTime = start.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: false });
  const time = endsAt
    ? startTime + " – " + new Date(endsAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: false })
    : startTime;
  return { date, time };
}

export default function BookingsScreen() {
  const { session } = useSession();
  const userId = session?.user?.id;
  const router = useRouter();

  const [bookings, setBookings] = useState<BookingListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const businessId = await getActiveBusinessId(userId);
    if (!businessId) {
      setBookings([]);
      return;
    }
    const data = await fetchBookings(businessId, { upcomingOnly: true });
    setBookings(data);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load()
        .catch((err) => console.error("[bookings] load error:", err))
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); }
    catch (err) { console.error("[bookings] refresh error:", err); }
    finally { setRefreshing(false); }
  }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-6 pt-4 pb-3 flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-text text-3xl font-bold">Bookings</Text>
          <Text className="text-textMuted text-base mt-1">Upcoming appointments</Text>
        </View>
        <Pressable
          onPress={() => router.push("/bookings/new")}
          className="bg-primary w-11 h-11 rounded-full items-center justify-center active:opacity-80"
          hitSlop={8}
        >
          <Plus size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9CA3AF" />}
      >
        {loading && !bookings ? (
          <Text className="text-textMuted text-sm">Loading bookings…</Text>
        ) : bookings && bookings.length === 0 ? (
          <View className="bg-white border border-gray-200 rounded-2xl p-6">
            <Text className="text-text text-base font-medium">No upcoming bookings</Text>
            <Text className="text-textMuted text-sm mt-1">
              Tap + to schedule an appointment for a customer.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {bookings?.map((b) => {
              const when = formatWhen(b.starts_at, b.ends_at);
              const s = STATUS_STYLES[b.status];
              return (
                <Pressable
                  key={b.id}
                  onPress={() => router.push(`/bookings/${b.id}`)}
                  className="bg-white border border-gray-200 rounded-2xl p-4 flex-row items-center active:opacity-60"
                >
                  <View className="flex-1 mr-3">
                    <View className="flex-row items-center">
                      <Text className="text-text text-base font-semibold" numberOfLines={1}>{b.title}</Text>
                      <View className={`${s.bg} px-2 py-0.5 rounded-full ml-2`}>
                        <Text className={`${s.text} text-[11px] font-medium`}>{s.label}</Text>
                      </View>
                    </View>
                    <Text className="text-textMuted text-sm mt-0.5" numberOfLines={1}>
                      {b.customer_name ?? "Unknown customer"}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-text text-xs font-medium">{when.date}</Text>
                    <Text className="text-textMuted text-xs">{when.time}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
