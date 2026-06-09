import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Plus, Trash2, X } from "lucide-react-native";
import { ScreenHeader } from "../../../components/screen-header";
import { QtyStepper } from "../../../components/qty-stepper";
import { getActiveBusinessId } from "../../../lib/business";
import { formatNaira } from "../../../lib/format";
import { fetchProduct } from "../../../lib/products";
import { useSession } from "../../../lib/session";
import {
  fetchVariantSetup,
  saveVariantSetup,
  generateVariants,
  OPTION_PRESETS,
  type VariantOption,
  type VariantRow,
} from "../../../lib/variants";

export default function ProductOptionsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [productPriceKobo, setProductPriceKobo] = useState(0);
  const [options, setOptions] = useState<VariantOption[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [valueDrafts, setValueDrafts] = useState<Record<number, string>>({});
  const [customName, setCustomName] = useState("");
  const [allStockText, setAllStockText] = useState("");
  const [allPriceText, setAllPriceText] = useState("");

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const bid = await getActiveBusinessId(userId);
      if (!cancelled) setBusinessId(bid);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const p = await fetchProduct(id);
      if (cancelled) return;
      if (!p) {
        setNotFound(true);
        return;
      }
      setProductName(p.name);
      setProductPriceKobo(p.price_kobo);
      const setup = await fetchVariantSetup(id);
      if (cancelled) return;
      setOptions(setup.options);
      setVariants(setup.variants);
    })()
      .catch((err) => console.error("[product-options] load error:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const addPreset = (preset: { name: string; values: string[] }) => {
    if (options.length >= 2) return;
    if (options.some((o) => o.name.toLowerCase() === preset.name.toLowerCase())) return;
    setOptions([
      ...options,
      { name: preset.name, position: options.length + 1, values: [...preset.values] },
    ]);
  };

  const addCustomOption = () => {
    const name = customName.trim();
    if (!name || options.length >= 2) return;
    if (options.some((o) => o.name.toLowerCase() === name.toLowerCase())) {
      setCustomName("");
      return;
    }
    setOptions([...options, { name, position: options.length + 1, values: [] }]);
    setCustomName("");
  };

  const removeOption = (index: number) => {
    setOptions(
      options.filter((_, i) => i !== index).map((o, i) => ({ ...o, position: i + 1 })),
    );
  };

  const addValue = (index: number) => {
    const draft = (valueDrafts[index] ?? "").trim();
    if (!draft) return;
    setOptions(
      options.map((o, i) => {
        if (i !== index) return o;
        if (o.values.some((val) => val.toLowerCase() === draft.toLowerCase())) return o;
        return { ...o, values: [...o.values, draft] };
      }),
    );
    setValueDrafts({ ...valueDrafts, [index]: "" });
  };

  const removeValue = (index: number, value: string) => {
    setOptions(
      options.map((o, i) =>
        i === index ? { ...o, values: o.values.filter((val) => val !== value) } : o,
      ),
    );
  };

  const handleGenerate = () => {
    setVariants(generateVariants(options, productPriceKobo, variants));
  };

  const updateVariant = (index: number, patch: Partial<VariantRow>) => {
    setVariants(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const setAllStock = (n: number) => setVariants(variants.map((v) => ({ ...v, stockQuantity: n })));
  const setAllPrice = (kobo: number) => setVariants(variants.map((v) => ({ ...v, priceKobo: kobo })));

  const handleSave = async () => {
    if (!id || !businessId || saving) return;
    setSaving(true);
    const result = await saveVariantSetup(businessId, id, { options, variants });
    setSaving(false);
    if (!result.ok) {
      Alert.alert("Could not save", result.error);
      return;
    }
    router.back();
  };

  const canGenerate = options.some((o) => o.values.length > 0);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScreenHeader title="Options & variants" />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#9CA3AF" />
        </View>
      ) : notFound ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-textMuted text-sm">Product not found.</Text>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140, paddingTop: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="text-text text-base font-semibold">{productName}</Text>
            <Text className="text-textMuted text-xs mt-0.5">
              Base price {formatNaira(productPriceKobo)}
            </Text>

            <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">Options</Text>
            {options.length === 0 ? (
              <Text className="text-textMuted text-sm mt-1">
                Add an option like Size or Color, then generate the variants.
              </Text>
            ) : null}

            {options.map((opt, oi) => (
              <View key={oi} className="mt-3 bg-white border border-gray-200 rounded-2xl p-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-text text-base font-semibold">{opt.name}</Text>
                  <Pressable onPress={() => removeOption(oi)} hitSlop={6}>
                    <Text className="text-textMuted text-sm font-medium">Remove</Text>
                  </Pressable>
                </View>
                <View className="flex-row flex-wrap mt-2">
                  {opt.values.map((val) => (
                    <View
                      key={val}
                      className="flex-row items-center bg-gray-100 rounded-full pl-3 pr-2 py-1.5 mr-2 mb-2"
                    >
                      <Text className="text-text text-sm mr-1">{val}</Text>
                      <Pressable onPress={() => removeValue(oi, val)} hitSlop={6}>
                        <X size={14} color="#6B7280" />
                      </Pressable>
                    </View>
                  ))}
                </View>
                <View className="flex-row items-center mt-1">
                  <TextInput
                    value={valueDrafts[oi] ?? ""}
                    onChangeText={(t) => setValueDrafts({ ...valueDrafts, [oi]: t })}
                    onSubmitEditing={() => addValue(oi)}
                    placeholder="Add a value"
                    placeholderTextColor="#9CA3AF"
                    className="flex-1 bg-surface-muted border border-gray-200 rounded-xl px-3 py-2 text-text text-sm mr-2"
                  />
                  <Pressable
                    onPress={() => addValue(oi)}
                    className="bg-gray-100 rounded-xl px-4 py-2 active:opacity-70"
                  >
                    <Text className="text-text text-sm font-semibold">Add</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            {options.length < 2 ? (
              <View className="mt-3">
                <Text className="text-textMuted text-xs mb-2">Quick add</Text>
                <View className="flex-row flex-wrap">
                  {OPTION_PRESETS.filter(
                    (p) => !options.some((o) => o.name.toLowerCase() === p.name.toLowerCase()),
                  ).map((p) => (
                    <Pressable
                      key={p.name}
                      onPress={() => addPreset(p)}
                      className="flex-row items-center bg-white border border-gray-200 rounded-full px-3 py-2 mr-2 mb-2 active:opacity-70"
                    >
                      <Plus size={14} color="#16A34A" />
                      <Text className="text-text text-sm font-medium ml-1">{p.name}</Text>
                    </Pressable>
                  ))}
                </View>
                <View className="flex-row items-center mt-1">
                  <TextInput
                    value={customName}
                    onChangeText={setCustomName}
                    onSubmitEditing={addCustomOption}
                    placeholder="Custom option name"
                    placeholderTextColor="#9CA3AF"
                    className="flex-1 bg-surface-muted border border-gray-200 rounded-xl px-3 py-2 text-text text-sm mr-2"
                  />
                  <Pressable
                    onPress={addCustomOption}
                    className="bg-gray-100 rounded-xl px-4 py-2 active:opacity-70"
                  >
                    <Text className="text-text text-sm font-semibold">Add</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {canGenerate ? (
              <Pressable
                onPress={handleGenerate}
                className="mt-5 bg-white border border-gray-300 rounded-2xl py-3.5 items-center active:opacity-70"
              >
                <Text className="text-primary text-base font-semibold">Generate variants</Text>
              </Pressable>
            ) : null}

            {variants.length > 0 ? (
              <>
                <Text className="text-textMuted text-xs uppercase tracking-wider mt-7">
                  Variants ({variants.length})
                </Text>

                <View className="mt-2 bg-white border border-gray-200 rounded-2xl p-4">
                  <Text className="text-textMuted text-xs">Apply to all</Text>
                  <View className="flex-row items-center mt-2 flex-wrap">
                    <TextInput
                      value={allStockText}
                      onChangeText={(t) => setAllStockText(t.replace(/[^0-9]/g, ""))}
                      placeholder="Stock"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      className="w-20 bg-surface-muted border border-gray-200 rounded-xl px-3 py-2 text-text text-sm mr-2 mb-2"
                    />
                    <Pressable
                      onPress={() => {
                        if (allStockText !== "") setAllStock(Number(allStockText) || 0);
                      }}
                      className="bg-gray-100 rounded-xl px-3 py-2 mr-4 mb-2 active:opacity-70"
                    >
                      <Text className="text-text text-sm font-semibold">Set stock</Text>
                    </Pressable>
                    <TextInput
                      value={allPriceText}
                      onChangeText={(t) => setAllPriceText(t.replace(/[^0-9]/g, ""))}
                      placeholder="Price"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      className="w-24 bg-surface-muted border border-gray-200 rounded-xl px-3 py-2 text-text text-sm mr-2 mb-2"
                    />
                    <Pressable
                      onPress={() => {
                        if (allPriceText !== "") setAllPrice((Number(allPriceText) || 0) * 100);
                      }}
                      className="bg-gray-100 rounded-xl px-3 py-2 mb-2 active:opacity-70"
                    >
                      <Text className="text-text text-sm font-semibold">Set price</Text>
                    </Pressable>
                  </View>
                </View>

                {variants.map((v, vi) => (
                  <View
                    key={(v.id ?? "new") + ":" + vi}
                    className="mt-3 bg-white border border-gray-200 rounded-2xl p-4"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text
                        className="text-text text-base font-semibold flex-1 mr-3"
                        numberOfLines={1}
                      >
                        {v.label}
                      </Text>
                      <View className="flex-row items-center">
                        <Switch
                          value={v.isActive}
                          onValueChange={(on) => updateVariant(vi, { isActive: on })}
                          trackColor={{ true: "#00D26A", false: "#D1D5DB" }}
                        />
                        <Pressable
                          onPress={() => removeVariant(vi)}
                          hitSlop={6}
                          className="ml-3"
                        >
                          <Trash2 size={18} color="#DC2626" />
                        </Pressable>
                      </View>
                    </View>
                    <View className="flex-row items-center justify-between mt-3">
                      <Text className="text-textMuted text-sm">Price (NGN)</Text>
                      <TextInput
                        value={String(Math.round(v.priceKobo / 100))}
                        onChangeText={(t) =>
                          updateVariant(vi, {
                            priceKobo: (Number(t.replace(/[^0-9]/g, "")) || 0) * 100,
                          })
                        }
                        keyboardType="number-pad"
                        className="w-32 bg-surface-muted border border-gray-200 rounded-xl px-3 py-2 text-text text-sm text-right"
                      />
                    </View>
                    <View className="flex-row items-center justify-between mt-3">
                      <Text className="text-textMuted text-sm">Stock</Text>
                      <QtyStepper
                        value={v.stockQuantity}
                        onChange={(n) => updateVariant(vi, { stockQuantity: n })}
                        min={0}
                        max={99999}
                      />
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </ScrollView>

          <View className="absolute left-0 right-0 bottom-0 px-6 pb-6 pt-3 bg-background border-t border-gray-100">
            <Pressable
              onPress={handleSave}
              disabled={saving || !businessId}
              className={
                "rounded-2xl py-4 items-center active:opacity-80 " +
                (saving || !businessId ? "bg-borderStrong" : "bg-primary")
              }
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-white text-base font-semibold">Save</Text>
              )}
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
