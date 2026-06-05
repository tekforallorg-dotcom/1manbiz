import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, ImagePlus } from "lucide-react-native";
import { colors as designColors } from "@1manbiz/design";

import { useSession } from "../../../lib/session";
import { getActiveBusinessId } from "../../../lib/business";
import { createProduct, type ProductStatus } from "../../../lib/products";
import { pickAndUploadProductImage } from "../../../lib/product-image";

export default function NewProductScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const userId = session?.user?.id;

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [status, setStatus] = useState<ProductStatus>("active");
  const [saving, setSaving] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imageLocalUri, setImageLocalUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const bid = await getActiveBusinessId(userId);
      if (!cancelled) setBusinessId(bid);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Money is entered in naira and stored in kobo. Strip non-numeric input so a
  // stray currency symbol or comma cannot poison the parse.
  const priceKobo = Math.round((Number(price.replace(/[^0-9.]/g, "")) || 0) * 100);
  const stockQty = Math.max(0, Math.trunc(Number(stock.replace(/[^0-9]/g, "")) || 0));
  const canSave = name.trim().length > 0 && priceKobo > 0 && !saving && !uploadingImage;

  async function handleSave() {
    if (!canSave || !userId) return;
    setSaving(true);
    const bid = businessId ?? (await getActiveBusinessId(userId));
    if (!bid) {
      setSaving(false);
      Alert.alert("No business", "Could not find your active business. Reopen the app and try again.");
      return;
    }
    const result = await createProduct(bid, {
      name: name.trim(),
      price_kobo: priceKobo,
      stock_quantity: stockQty,
      status,
      image_path: imagePath,
    });
    setSaving(false);
    if (!result.ok) {
      Alert.alert("Could not save", result.error);
      return;
    }
    router.back();
  }

  async function handlePickImage() {
    if (uploadingImage) return;
    const bid = businessId ?? (userId ? await getActiveBusinessId(userId) : null);
    if (!bid) {
      Alert.alert("No business", "Could not find your active business yet. Try again in a moment.");
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
  }

  function handleRemoveImage() {
    setImagePath(null);
    setImageLocalUri(null);
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-row items-center px-3 py-3 border-b border-gray-200">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center"
            hitSlop={8}
          >
            <ChevronLeft size={24} color={designColors.text} strokeWidth={2} />
          </Pressable>
          <Text className="text-text text-lg font-semibold ml-1">Add product</Text>
        </View>

        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingTop: 20, paddingBottom: insets.bottom + 120 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-5">
            <Text className="text-textMuted text-sm mb-2">Product image</Text>
            <Pressable
              onPress={handlePickImage}
              disabled={uploadingImage}
              className="bg-white border border-gray-200 rounded-2xl items-center justify-center overflow-hidden"
              style={{ height: 160 }}
            >
              {uploadingImage ? (
                <ActivityIndicator color={designColors.primary} />
              ) : imageLocalUri ? (
                <Image source={{ uri: imageLocalUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              ) : (
                <View className="items-center">
                  <ImagePlus size={28} color={designColors.textMuted} strokeWidth={2} />
                  <Text className="text-textMuted text-sm mt-2">Add a photo</Text>
                </View>
              )}
            </Pressable>
            {imageLocalUri && !uploadingImage ? (
              <View className="flex-row mt-2">
                <Pressable onPress={handlePickImage} className="mr-4" hitSlop={6}>
                  <Text className="text-primary text-sm font-medium">Change</Text>
                </Pressable>
                <Pressable onPress={handleRemoveImage} hitSlop={6}>
                  <Text className="text-textMuted text-sm font-medium">Remove</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View className="mb-5">
            <Text className="text-textMuted text-sm mb-2">Product name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. iPhone 17 Pro 256GB"
              placeholderTextColor={designColors.textMuted}
              className="bg-white border border-gray-200 rounded-2xl px-4 py-4 text-text text-base"
              returnKeyType="next"
            />
          </View>

          <View className="mb-5">
            <Text className="text-textMuted text-sm mb-2">Price</Text>
            <View className="flex-row items-center bg-white border border-gray-200 rounded-2xl px-4">
              <Text className="text-textMuted text-base mr-1">{"\u20A6"}</Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="0"
                placeholderTextColor={designColors.textMuted}
                keyboardType="numeric"
                className="flex-1 py-4 text-text text-base"
              />
            </View>
          </View>

          <View className="mb-5">
            <Text className="text-textMuted text-sm mb-2">Stock quantity</Text>
            <TextInput
              value={stock}
              onChangeText={setStock}
              placeholder="0"
              placeholderTextColor={designColors.textMuted}
              keyboardType="numeric"
              className="bg-white border border-gray-200 rounded-2xl px-4 py-4 text-text text-base"
            />
          </View>

          <View className="mb-2">
            <Text className="text-textMuted text-sm mb-2">Status</Text>
            <View className="flex-row">
              <Pressable
                onPress={() => setStatus("active")}
                className={"rounded-full px-5 py-2 mr-2 " + (status === "active" ? "bg-primary" : "bg-gray-100")}
              >
                <Text className={"text-sm font-medium " + (status === "active" ? "text-white" : "text-text")}>Active</Text>
              </Pressable>
              <Pressable
                onPress={() => setStatus("archived")}
                className={"rounded-full px-5 py-2 " + (status === "archived" ? "bg-primary" : "bg-gray-100")}
              >
                <Text className={"text-sm font-medium " + (status === "archived" ? "text-white" : "text-text")}>Archived</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <View
          className="px-6 pt-3 border-t border-gray-200 bg-background"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            className={"rounded-full items-center justify-center py-3.5 " + (canSave ? "bg-primary" : "bg-borderStrong")}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-white text-base font-semibold">Save product</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
