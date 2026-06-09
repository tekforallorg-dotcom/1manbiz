import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronRight, ImagePlus } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { QtyStepper } from "../../../components/qty-stepper";
import { ScreenHeader } from "../../../components/screen-header";
import { getActiveBusinessId } from "../../../lib/business";
import { formatNaira } from "../../../lib/format";
import {
  pickAndUploadProductImage,
  productImageUrl,
} from "../../../lib/product-image";
import {
  fetchProduct,
  updateProduct,
  type Product,
  type ProductStatus,
} from "../../../lib/products";
import { fetchVariantSummary } from "../../../lib/variants";
import { useSession } from "../../../lib/session";

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { session } = useSession();
  const userId = session?.user?.id;

  const [name, setName] = useState("");
  const [priceText, setPriceText] = useState("");
  const [stock, setStock] = useState(0);
  const [status, setStatus] = useState<ProductStatus>("active");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imageLocalUri, setImageLocalUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [variantCount, setVariantCount] = useState(0);
  const [variantStock, setVariantStock] = useState(0);

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
    fetchProduct(id)
      .then((p) => {
        if (cancelled || !p) return;
        setProduct(p);
        setName(p.name);
        setPriceText(String(Math.round(p.price_kobo / 100)));
        setStock(p.stock_quantity);
        setStatus(p.status);
        setImagePath(p.image_path);
      })
      .catch((err) => console.error("[edit-product] load error:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      fetchVariantSummary(id)
        .then((s) => {
          if (cancelled) return;
          setVariantCount(s.count);
          setVariantStock(s.totalStock);
        })
        .catch((err) =>
          console.error("[edit-product] variant summary error:", err),
        );
      return () => {
        cancelled = true;
      };
    }, [id]),
  );

  const priceKobo = (Number(priceText) || 0) * 100;
  const nameTrimmed = name.trim();
  const hasVariants = variantCount > 0;
  const valid = nameTrimmed.length > 0 && priceKobo > 0;
  const dirty =
    !!product &&
    (nameTrimmed !== product.name ||
      priceKobo !== product.price_kobo ||
      (!hasVariants && stock !== product.stock_quantity) ||
      status !== product.status ||
      imagePath !== product.image_path);
  const canSave = valid && dirty && !saving;

  const handlePickImage = async () => {
    if (uploadingImage) return;
    const bid =
      businessId ?? (userId ? await getActiveBusinessId(userId) : null);
    if (!bid) {
      Alert.alert(
        "No business",
        "Could not find your active business yet. Try again in a moment.",
      );
      return;
    }
    setUploadingImage(true);
    const res = await pickAndUploadProductImage(bid);
    setUploadingImage(false);
    if (res.status === "cancelled") return;
    if (res.status === "error") {
      Alert.alert("Image not added", res.message);
      return;
    }
    setImagePath(res.path);
    setImageLocalUri(res.localUri);
  };

  const handleRemoveImage = () => {
    setImagePath(null);
    setImageLocalUri(null);
  };

  const handleSave = async () => {
    if (!id || !canSave) return;
    setSaving(true);
    const result = await updateProduct(id, {
      name: nameTrimmed,
      price_kobo: priceKobo,
      ...(hasVariants ? {} : { stock_quantity: stock }),
      status,
      ...(imagePath !== (product?.image_path ?? null)
        ? { image_path: imagePath }
        : {}),
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
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingBottom: 140,
              paddingTop: 8,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="text-textMuted text-xs uppercase tracking-wider">
              Photo
            </Text>
            <Pressable
              onPress={handlePickImage}
              disabled={uploadingImage}
              className="mt-2 bg-white border border-gray-200 rounded-2xl items-center justify-center overflow-hidden"
              style={{ height: 160 }}
            >
              {uploadingImage ? (
                <ActivityIndicator color="#16A34A" />
              ) : imageLocalUri || productImageUrl(imagePath) ? (
                <Image
                  source={{
                    uri: imageLocalUri ?? productImageUrl(imagePath) ?? "",
                  }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <View className="items-center">
                  <ImagePlus size={28} color="#9CA3AF" strokeWidth={2} />
                  <Text className="text-textMuted text-sm mt-2">
                    Add a photo
                  </Text>
                </View>
              )}
            </Pressable>
            {(imageLocalUri || imagePath) && !uploadingImage ? (
              <View className="flex-row mt-2">
                <Pressable
                  onPress={handlePickImage}
                  className="mr-4"
                  hitSlop={6}
                >
                  <Text className="text-primary text-sm font-medium">
                    Change
                  </Text>
                </Pressable>
                <Pressable onPress={handleRemoveImage} hitSlop={6}>
                  <Text className="text-textMuted text-sm font-medium">
                    Remove
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">
              Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Product name"
              placeholderTextColor="#9CA3AF"
              className="mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
            />

            <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">
              Price (NGN)
            </Text>
            <TextInput
              value={priceText}
              onChangeText={(t) => setPriceText(t.replace(/[^0-9]/g, ""))}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              className="mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
            />
            <Text className="text-textMuted text-xs mt-1">
              {formatNaira(priceKobo)}
            </Text>

            <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">
              Stock
            </Text>
            {hasVariants ? (
              <>
                <View className="mt-2 flex-row items-center justify-between bg-white border border-gray-200 rounded-2xl px-4 py-3">
                  <Text className="text-text text-base">Total in stock</Text>
                  <Text className="text-text text-base font-semibold">
                    {variantStock}
                  </Text>
                </View>
                <Text className="text-textMuted text-xs mt-1">
                  {"Managed across " +
                    variantCount +
                    (variantCount === 1 ? " variant" : " variants") +
                    " in Options & variants."}
                </Text>
              </>
            ) : (
              <View className="mt-2 flex-row items-center justify-between bg-white border border-gray-200 rounded-2xl px-4 py-3">
                <Text className="text-text text-base">Quantity in stock</Text>
                <QtyStepper
                  value={stock}
                  onChange={setStock}
                  min={0}
                  max={99999}
                />
              </View>
            )}

            <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">
              Status
            </Text>
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
                        "text-sm font-medium " +
                        (on ? "text-text" : "text-textMuted")
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

            <Pressable
              onPress={() =>
                router.push({ pathname: "/products/options", params: { id } })
              }
              className="mt-6 bg-white border border-gray-200 rounded-2xl px-4 py-4 flex-row items-center justify-between active:opacity-60"
            >
              <View className="flex-1 pr-3">
                <Text className="text-text text-base font-medium">
                  Options & variants
                </Text>
                <Text className="text-textMuted text-xs mt-0.5">
                  {hasVariants
                    ? variantCount +
                      (variantCount === 1 ? " variant - " : " variants - ") +
                      variantStock +
                      " in stock"
                    : "Sizes, colors, per-variant stock and price"}
                </Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </Pressable>
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
                <Text className="text-white text-base font-semibold">
                  Save changes
                </Text>
              )}
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
