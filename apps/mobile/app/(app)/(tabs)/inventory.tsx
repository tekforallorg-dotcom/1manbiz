import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useSession } from "../../../lib/session";
import { getActiveBusinessId } from "../../../lib/business";
import { fetchProducts, type ProductFilter, type Product } from "../../../lib/products";
import { ProductRow } from "../../../components/product-row";
import { StatusFilter } from "../../../components/status-filter";
import { Plus } from "lucide-react-native";
import { formatNaira } from "../../../lib/format";
import { SummaryStrip } from "../../../components/summary-strip";

const FILTER_OPTIONS: { value: ProductFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

export default function InventoryScreen() {
  const { session } = useSession();
  const userId = session?.user?.id;
  const router = useRouter();

  const [filter, setFilter] = useState<ProductFilter>("all");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const businessId = await getActiveBusinessId(userId);
    if (!businessId) {
      setProducts([]);
      return;
    }
    const data = await fetchProducts(businessId, filter);
    setProducts(data);
  }, [userId, filter]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load()
        .catch((err) => console.error("[inventory] load error:", err))
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); }
    catch (err) { console.error("[inventory] refresh error:", err); }
    finally { setRefreshing(false); }
  }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-6 pt-4 pb-3">
        <Text className="text-text text-3xl font-bold">Inventory</Text>
        <Text className="text-textMuted text-base mt-1">Products, stock, and catalogue</Text>
      </View>

      <View className="pb-3">
        <StatusFilter options={FILTER_OPTIONS} value={filter} onChange={setFilter} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9CA3AF" />}
      >
        {products && products.length > 0 ? (
          <SummaryStrip
            items={[
              { label: "Stock value", value: formatNaira(products.reduce((sum, p) => sum + p.price_kobo * p.stock_quantity, 0)), tone: "lead" },
              { label: "Products", value: String(products.length) },
              {
                label: "Low stock",
                value: String(products.filter((p) => p.status === "active" && p.stock_quantity <= 5).length),
                tone: products.some((p) => p.status === "active" && p.stock_quantity <= 5) ? "warn" : "default",
              },
            ]}
          />
        ) : null}
        {loading && !products ? (
          <Text className="text-textMuted text-sm">Loading products…</Text>
        ) : products && products.length === 0 ? (
          <View className="bg-white border border-gray-200 rounded-2xl p-6">
            <Text className="text-text text-base font-medium">No products</Text>
            <Text className="text-textMuted text-sm mt-1">
              {filter === "all"
                ? "Tap the plus button to add your first product."
                : `No products in this view.`}
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {products?.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                onPress={() => router.push(`/products/${product.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={() => router.push("/products/new")}
        className="absolute bg-primary rounded-full items-center justify-center active:opacity-80"
        style={{
          right: 24,
          bottom: 24,
          width: 56,
          height: 56,
          shadowColor: "#0B0B0B",
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
        hitSlop={6}
      >
        <Plus size={26} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>
    </SafeAreaView>
  );
}
