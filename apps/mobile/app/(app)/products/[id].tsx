import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenHeader } from "../../../components/screen-header";
import { QtyStepper } from "../../../components/qty-stepper";
import {
  fetchProduct,
  updateProduct,
  type Product,
  type ProductStatus,
} from "../../../lib/products";
import { formatNaira } from "../../../lib/format";

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [priceText, setPriceText] = useState("");
  const [stock, setStock] = useState(0);
  const [status, setStatus] = useState<ProductStatus>("active");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    fetchProduct(id)
      .then((p) => {
        if (cancelled || !p) return;
        setProduct(p);
        setName(p.name);
        setPriceText(String(Math.round(p.price_kobo / 100)));
        setStock(p.stock_quantity);
        setStatus(p.status);
      })
      .catch((err) => console.error("[edit-product] load error:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const priceKobo = (Number(priceText) || 0) * 100;
  const nameTrimmed = name.trim();
  const valid = nameTrimmed.length > 0 && priceKobo > 0;
  const dirty =
    !!product &&
    (nameTrimmed !== product.name ||
      priceKobo !== product.price_kobo ||
      stock !== product.stock_quantity ||
      status !== product.status);
  const canSave = valid && dirty && !saving;

  const handleSave = async () => {
    if (!id || !canSave) return;
    setSaving(true);
    const result = await updateProduct(id, {
      name: nameTrimmed,
      price_kobo: priceKobo,
      stock_quantity: stock,
      status,
    });
    setSaving(false);
    if (!result.ok) {
      Alert.alert("Could not save", result.error);
      return;
    }
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScreenHeader title="Edit product" />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#9CA3AF" />
        </View>
      ) : !product ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-textMuted text-sm">Product not found.</Text>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140, paddingTop: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="text-textMuted text-xs uppercase tracking-wider">Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Product name"
              placeholderTextColor="#9CA3AF"
              className="mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
            />

            <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">Price (NGN)</Text>
            <TextInput
              value={priceText}
              onChangeText={(t) => setPriceText(t.replace(/[^0-9]/g, ""))}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              className="mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
            />
            <Text className="text-textMuted text-xs mt-1">{formatNaira(priceKobo)}</Text>

            <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">Stock</Text>
            <View className="mt-2 flex-row items-center justify-between bg-white border border-gray-200 rounded-2xl px-4 py-3">
              <Text className="text-text text-base">Quantity in stock</Text>
              <QtyStepper value={stock} onChange={setStock} min={0} max={99999} />
            </View>

            <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">Status</Text>
            <View className="mt-2 flex-row bg-gray-100 rounded-full p-1">
              {(["active", "archived"] as ProductStatus[]).map((s) => {
                const on = status === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setStatus(s)}
                    className={
                      "flex-1 py-2 rounded-full items-center active:opacity-70 " +
                      (on ? "bg-white" : "")
                    }
                  >
                    <Text
                      className={
                        "text-sm font-medium " + (on ? "text-text" : "text-textMuted")
                      }
                    >
                      {s === "active" ? "Active" : "Archived"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-textMuted text-xs mt-1">
              {status === "archived"
                ? "Hidden from your catalogue and new orders."
                : "Visible in your catalogue."}
            </Text>
          </ScrollView>

          <View className="absolute left-0 right-0 bottom-0 px-6 pb-6 pt-3 bg-background border-t border-gray-100">
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              className={
                "rounded-2xl py-4 items-center active:opacity-80 " +
                (canSave ? "bg-primary" : "bg-borderStrong")
              }
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-white text-base font-semibold">Save changes</Text>
              )}
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
