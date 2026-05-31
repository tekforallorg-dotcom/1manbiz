import { useEffect, useState, useMemo } from "react";
import { View, Text, Modal, Pressable, ScrollView, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchProducts, type Product } from "../lib/products";
import { formatNaira } from "../lib/format";
import { getProductImageUrl } from "../lib/image";
import { QtyStepper } from "./qty-stepper";
import { PickerSearchBar } from "./picker-search-bar";

export interface SelectedQtyMap {
  [productId: string]: number;
}

interface Props {
  visible: boolean;
  businessId: string | null;
  initialSelection: SelectedQtyMap;
  onDone: (selection: SelectedQtyMap, products: Product[]) => void;
  onClose: () => void;
}

export function ProductPicker({ visible, businessId, initialSelection, onDone, onClose }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<SelectedQtyMap>({});

  useEffect(() => {
    if (!visible || !businessId) return;
    setLoading(true);
    setQuery("");
    setSelection({ ...initialSelection });
    fetchProducts(businessId, "active")
      .then(setProducts)
      .finally(() => setLoading(false));
  }, [visible, businessId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return products;
    const q = query.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku?.toLowerCase().includes(q) ?? false),
    );
  }, [products, query]);

  const totalSelected = useMemo(
    () => Object.values(selection).reduce((sum, q) => sum + q, 0),
    [selection],
  );

  const setQty = (productId: string, qty: number) => {
    setSelection((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  };

  const handleDone = () => {
    onDone(selection, products);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <View className="px-6 pt-2 pb-3 flex-row items-center justify-between">
          <Pressable onPress={onClose} hitSlop={12}>
            <Text className="text-textMuted text-base">Cancel</Text>
          </Pressable>
          <Text className="text-text text-base font-semibold">Select items</Text>
          <Pressable onPress={handleDone} hitSlop={12}>
            <Text className="text-primary text-base font-semibold">
              {totalSelected > 0 ? `Done (${totalSelected})` : "Done"}
            </Text>
          </Pressable>
        </View>

        <PickerSearchBar value={query} onChangeText={setQuery} placeholder="Search products" />

        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 }}>
          {loading ? (
            <ActivityIndicator color="#9CA3AF" />
          ) : filtered.length === 0 ? (
            <Text className="text-textMuted text-sm">
              {query ? "No products match." : "No active products. Add some from Inventory."}
            </Text>
          ) : (
            <View className="gap-2">
              {filtered.map((product) => {
                const imageUrl = getProductImageUrl(product.image_path);
                const qty = selection[product.id] ?? 0;
                const selected = qty > 0;
                return (
                  <Pressable
                    key={product.id}
                    onPress={() => !selected && setQty(product.id, 1)}
                    className="bg-white border border-gray-200 rounded-2xl p-3 flex-row items-center active:opacity-80"
                  >
                    <View className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden">
                      {imageUrl ? (
                        <Image source={{ uri: imageUrl }} className="w-12 h-12" resizeMode="cover" />
                      ) : null}
                    </View>
                    <View className="flex-1 ml-3">
                      <Text className="text-text text-base font-medium" numberOfLines={1}>
                        {product.name}
                      </Text>
                      <Text className="text-textMuted text-xs mt-0.5">
                        {formatNaira(product.price_kobo)}
                      </Text>
                    </View>
                    {selected ? (
                      <QtyStepper
                        value={qty}
                        onChange={(next) => setQty(product.id, next)}
                        min={0}
                      />
                    ) : (
                      <View className="bg-gray-100 px-3 py-1.5 rounded-full">
                        <Text className="text-text text-sm font-medium">Add</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
