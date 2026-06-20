import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput } from "react-native";
import { useNotifier } from "../../../components/notifier";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { UserPlus, ChevronDown } from "lucide-react-native";
import { useSession } from "../../../lib/session";
import { getActiveBusinessId } from "../../../lib/business";
import { createBooking } from "../../../lib/bookings";
import { fetchProducts, type Product } from "../../../lib/products";
import type { Customer } from "../../../lib/customers";
import { ScreenHeader } from "../../../components/screen-header";
import { CustomerPicker } from "../../../components/customer-picker";
import { colors as designColors } from "@1manbiz/design";

function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nextHourStr(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

export default function NewBookingScreen() {
  const router = useRouter();
  const { notify } = useNotifier();
  const { session } = useSession();
  const userId = session?.user?.id;

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [showServices, setShowServices] = useState(false);
  const [title, setTitle] = useState("");
  const [dateStr, setDateStr] = useState(todayStr());
  const [timeStr, setTimeStr] = useState(nextHourStr());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    getActiveBusinessId(userId).then(async (bid) => {
      setBusinessId(bid);
      if (bid) {
        const list = await fetchProducts(bid, "active");
        setProducts(list);
      }
    });
  }, [userId]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId],
  );

  function pickService(p: Product | null) {
    setProductId(p?.id ?? null);
    setShowServices(false);
    if (p && !title.trim()) setTitle(p.name);
  }

  const canSave = Boolean(customer) && title.trim() !== "" && !saving;

  const handleSave = async () => {
    if (!customer || !businessId) return;
    const startsAtIso = toIso(dateStr, timeStr);
    if (!startsAtIso) {
      notify({ type: "error", title: "Check the date and time", message: "Use the format YYYY-MM-DD for the date and HH:MM (24h) for the time." });
      return;
    }
    setSaving(true);
    const result = await createBooking({
      businessId,
      customerId: customer.id,
      title,
      productId,
      startsAtIso,
      notes,
    });
    setSaving(false);

    if (result.error || !result.id) {
      notify({ type: "error", title: "Could not save booking", message: result.error ?? "Please try again." });
      return;
    }
    if (result.conflictWarning) {
      notify({ type: "info", title: "Booking created", message: result.conflictWarning });
    }
    router.replace(`/bookings/${result.id}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScreenHeader title="New booking" />

      <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 24 }}>
        {/* Customer */}
        <Text className="text-textMuted text-xs uppercase tracking-wider mt-2">Customer</Text>
        {customer ? (
          <Pressable
            onPress={() => setShowCustomerPicker(true)}
            className="mt-2 bg-white border border-gray-200 rounded-2xl p-4 flex-row items-center active:opacity-60"
          >
            <View className="flex-1">
              <Text className="text-text text-base font-semibold">{customer.name}</Text>
              <Text className="text-textMuted text-sm mt-0.5">+{customer.phone_e164}</Text>
            </View>
            <Text className="text-primary text-sm font-medium">Change</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setShowCustomerPicker(true)}
            className="mt-2 bg-white border border-gray-200 rounded-2xl p-4 flex-row items-center active:opacity-60"
          >
            <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3">
              <UserPlus size={20} color={designColors.primary} />
            </View>
            <Text className="text-text text-base font-medium">Select customer</Text>
          </Pressable>
        )}

        {/* Service (optional) */}
        {products.length > 0 ? (
          <>
            <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">Service (optional)</Text>
            <Pressable
              onPress={() => setShowServices((v) => !v)}
              className="mt-2 bg-white border border-gray-200 rounded-2xl p-4 flex-row items-center active:opacity-60"
            >
              <Text className="text-text text-base flex-1">
                {selectedProduct ? selectedProduct.name : "No specific service"}
              </Text>
              <ChevronDown size={18} color="#9CA3AF" />
            </Pressable>
            {showServices ? (
              <View className="mt-2 bg-white border border-gray-200 rounded-2xl px-4">
                <Pressable onPress={() => pickService(null)} className="py-3 active:opacity-60">
                  <Text className="text-text text-base">No specific service</Text>
                </Pressable>
                {products.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => pickService(p)}
                    className="py-3 active:opacity-60 border-t border-gray-100"
                  >
                    <Text className="text-text text-base">{p.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {/* Title */}
        <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Haircut, Fitting, Repair drop-off"
          placeholderTextColor="#9CA3AF"
          className="mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
        />

        {/* Date + time */}
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

        {/* Notes */}
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

      {/* Sticky save */}
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
              Create booking
            </Text>
          )}
        </Pressable>
      </View>

      <CustomerPicker
        visible={showCustomerPicker}
        businessId={businessId}
        onSelect={(c) => { setCustomer(c); setShowCustomerPicker(false); }}
        onClose={() => setShowCustomerPicker(false)}
      />
    </SafeAreaView>
  );
}
