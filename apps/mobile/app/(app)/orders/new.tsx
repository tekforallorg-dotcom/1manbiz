import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, Alert, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { UserPlus, Plus, X } from "lucide-react-native";
import { useSession } from "../../../lib/session";
import { getActiveBusinessId } from "../../../lib/business";
import { createOrder, type NewOrderLine } from "../../../lib/order-create";
import type { Customer } from "../../../lib/customers";
import type { Product } from "../../../lib/products";
import { formatNaira } from "../../../lib/format";
import { ScreenHeader } from "../../../components/screen-header";
import { QtyStepper } from "../../../components/qty-stepper";
import {
  CustomerPicker,
} from "../../../components/customer-picker";
import {
  ProductPicker,
  type SelectedQtyMap,
} from "../../../components/product-picker";
import { colors as designColors } from "@1manbiz/design";

interface CartItem extends NewOrderLine {
  // Augmented from the picker so we can rerender without refetching products.
  display_name: string;
}

export default function NewOrderScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user?.id;

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    getActiveBusinessId(userId).then(setBusinessId);
  }, [userId]);

  const subtotalKobo = useMemo(
    () => cart.reduce((sum, it) => sum + it.quantity * it.price_kobo, 0),
    [cart],
  );

  const initialSelection: SelectedQtyMap = useMemo(() => {
    const map: SelectedQtyMap = {};
    cart.forEach((it) => { map[it.product_id] = it.quantity; });
    return map;
  }, [cart]);

  const handleCustomerSelected = useCallback((c: Customer) => {
    setCustomer(c);
    setShowCustomerPicker(false);
  }, []);

  const handleProductsDone = useCallback((selection: SelectedQtyMap, products: Product[]) => {
    const next: CartItem[] = [];
    products.forEach((p) => {
      const qty = selection[p.id];
      if (qty && qty > 0) {
        next.push({
          product_id: p.id,
          name: p.name,
          display_name: p.name,
          price_kobo: p.price_kobo,
          quantity: qty,
        });
      }
    });
    setCart(next);
    setShowProductPicker(false);
  }, []);

  const updateCartQty = (productId: string, qty: number) => {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((it) => it.product_id !== productId);
      return prev.map((it) => (it.product_id === productId ? { ...it, quantity: qty } : it));
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((it) => it.product_id !== productId));
  };

  const canSave = customer && cart.length > 0 && !saving;

  const handleSave = async () => {
    if (!customer || !businessId || cart.length === 0) return;
    setSaving(true);
    const result = await createOrder({
      businessId,
      customerId: customer.id,
      items: cart.map((it) => ({
        product_id: it.product_id,
        name: it.name,
        price_kobo: it.price_kobo,
        quantity: it.quantity,
      })),
      notes,
    });
    setSaving(false);

    if (result.error && !result.id) {
      Alert.alert("Could not save order", result.error);
      return;
    }
    if (!result.id) {
      Alert.alert("Could not save order", "Unexpected error. Please try again.");
      return;
    }
    if (result.error) {
      // Order created but items failed. warn and still navigate
      Alert.alert("Order saved with issues", result.error);
    }
    router.replace(`/orders/${result.id}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScreenHeader title="New order" />

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

        {/* Items */}
        <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">Items</Text>
        {cart.length === 0 ? (
          <Pressable
            onPress={() => setShowProductPicker(true)}
            className="mt-2 bg-white border border-gray-200 rounded-2xl p-4 flex-row items-center active:opacity-60"
          >
            <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3">
              <Plus size={20} color={designColors.primary} />
            </View>
            <Text className="text-text text-base font-medium">Add items</Text>
          </Pressable>
        ) : (
          <View className="mt-2 bg-white border border-gray-200 rounded-2xl px-4">
            {cart.map((it, idx) => (
              <View
                key={it.product_id}
                className={"py-3 flex-row items-center " + (idx === 0 ? "" : "border-t border-gray-100")}
              >
                <View className="flex-1 mr-2">
                  <Text className="text-text text-base font-medium" numberOfLines={1}>
                    {it.display_name}
                  </Text>
                  <Text className="text-textMuted text-xs mt-0.5">
                    {formatNaira(it.price_kobo)} each {"·"} line {formatNaira(it.quantity * it.price_kobo)}
                  </Text>
                </View>
                <QtyStepper
                  value={it.quantity}
                  onChange={(next) => updateCartQty(it.product_id, next)}
                  min={0}
                />
                <Pressable
                  onPress={() => removeFromCart(it.product_id)}
                  hitSlop={8}
                  className="ml-2 w-7 h-7 items-center justify-center active:opacity-60"
                >
                  <X size={18} color="#9CA3AF" />
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={() => setShowProductPicker(true)}
              className="border-t border-gray-100 py-3 flex-row items-center active:opacity-60"
            >
              <Plus size={18} color={designColors.primary} />
              <Text className="text-primary text-sm font-medium ml-2">
                Edit items
              </Text>
            </Pressable>
          </View>
        )}

        {/* Notes */}
        <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Delivery instructions, payment method, etc."
          placeholderTextColor="#9CA3AF"
          multiline
          className="mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
          style={{ minHeight: 64, textAlignVertical: "top" }}
        />

        {/* Subtotal */}
        <View className="mt-6 flex-row items-center justify-between">
          <Text className="text-textMuted text-xs uppercase tracking-wider">Subtotal</Text>
          <Text className="text-text text-3xl font-bold">{formatNaira(subtotalKobo)}</Text>
        </View>
      </ScrollView>

      {/* Sticky save button */}
      <View className="absolute left-0 right-0 bottom-0 px-6 pb-6 pt-3 bg-background border-t border-gray-100">
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          className={"rounded-2xl py-4 items-center active:opacity-80 " + (canSave ? "bg-primary" : "bg-borderStrong")}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white text-base font-semibold">
              Save order
            </Text>
          )}
        </Pressable>
      </View>

      <CustomerPicker
        visible={showCustomerPicker}
        businessId={businessId}
        onSelect={handleCustomerSelected}
        onClose={() => setShowCustomerPicker(false)}
      />
      <ProductPicker
        visible={showProductPicker}
        businessId={businessId}
        initialSelection={initialSelection}
        onDone={handleProductsDone}
        onClose={() => setShowProductPicker(false)}
      />
    </SafeAreaView>
  );
}
