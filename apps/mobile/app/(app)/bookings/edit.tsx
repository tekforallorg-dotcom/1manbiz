import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { fetchBookingDetail, updateBooking } from "../../../lib/bookings";
import { ScreenHeader } from "../../../components/screen-header";

function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

// Split a stored ISO timestamp into local YYYY-MM-DD + HH:MM (inverse of toIso).
function fromIso(iso: string): { dateStr: string; timeStr: string } {
  const d = new Date(iso);
  return {
    dateStr: d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()),
    timeStr: pad(d.getHours()) + ":" + pad(d.getMinutes()),
  };
}

// Parse YYYY-MM-DD + HH:MM (local) into an ISO string, or null if invalid.
function toIso(dateStr: string, timeStr: string): string | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!dm || !tm) return null;
  const year = Number(dm[1]); const month = Number(dm[2]); const day = Number(dm[3]);
  const hour = Number(tm[1]); const minute = Number(tm[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const d = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function EditBookingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const data = await fetchBookingDetail(id);
    if (!data) { setNotFound(true); return; }
    if (data.status === "cancelled" || data.status === "completed") {
      router.replace({ pathname: "/bookings/[id]", params: { id } });
      return;
    }
    setTitle(data.title);
    const parts = fromIso(data.starts_at);
    setDateStr(parts.dateStr);
    setTimeStr(parts.timeStr);
    setNotes(data.notes ?? "");
  }, [id, router]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load()
        .catch((err) => console.error("[booking-edit] load error:", err))
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [load]),
  );

  const canSave = title.trim() !== "" && !saving;

  const handleSave = async () => {
    if (!id) return;
    const startsAtIso = toIso(dateStr, timeStr);
    if (!startsAtIso) {
      Alert.alert("Check the date and time", "Use the format YYYY-MM-DD for the date and HH:MM (24h) for the time.");
      return;
    }
    setSaving(true);
    const result = await updateBooking(id, { title, startsAtIso, notes });
    setSaving(false);
    if (!result.ok) {
      Alert.alert("Could not save changes", result.error);
      return;
    }
    router.replace({ pathname: "/bookings/[id]", params: { id } });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <ScreenHeader title="Edit booking" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#9CA3AF" />
        </View>
      </SafeAreaView>
    );
  }

  if (notFound) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <ScreenHeader title="Edit booking" />
        <View className="flex-1 px-6 pt-8">
          <Text className="text-text text-lg font-semibold">Booking not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScreenHeader title="Edit booking" />

      <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 24 }}>
        <Text className="text-textMuted text-xs uppercase tracking-wider mt-2">Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Haircut, Fitting, Repair drop-off"
          placeholderTextColor="#9CA3AF"
          className="mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
        />

        <View className="flex-row gap-3 mt-6">
          <View className="flex-1">
            <Text className="text-textMuted text-xs uppercase tracking-wider">Date</Text>
            <TextInput
              value={dateStr}
              onChangeText={setDateStr}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
              className="mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
            />
          </View>
          <View className="w-32">
            <Text className="text-textMuted text-xs uppercase tracking-wider">Time</Text>
            <TextInput
              value={timeStr}
              onChangeText={setTimeStr}
              placeholder="HH:MM"
              placeholderTextColor="#9CA3AF"
              keyboardType="numbers-and-punctuation"
              className="mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
            />
          </View>
        </View>

        <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything to remember for this appointment"
          placeholderTextColor="#9CA3AF"
          multiline
          className="mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
          style={{ minHeight: 64, textAlignVertical: "top" }}
        />
      </ScrollView>

      <View className="absolute left-0 right-0 bottom-0 px-6 pb-6 pt-3 bg-background border-t border-gray-100">
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          className={"rounded-2xl py-4 items-center " + (canSave ? "bg-primary active:opacity-80" : "bg-gray-200")}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className={"text-base font-semibold " + (canSave ? "text-white" : "text-gray-400")}>
              Save changes
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
