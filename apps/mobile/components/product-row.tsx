import { View, Text, Pressable, Image } from "react-native";
import type { Product } from "../lib/products";
import { formatNaira } from "../lib/format";
import { getProductImageUrl } from "../lib/image";

interface Props {
  product: Product;
  onPress?: () => void;
}

export function ProductRow({ product, onPress }: Props) {
  const imageUrl = getProductImageUrl(product.image_path);
  const outOfStock = product.stock_quantity === 0;
  const archived = product.status === "archived";

  return (
    <Pressable
      onPress={onPress}
      className="bg-white border border-gray-200 rounded-2xl p-3 flex-row items-center active:opacity-60"
    >
      {/* Thumbnail */}
      <View className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden">
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} className="w-14 h-14" resizeMode="cover" />
        ) : null}
      </View>

      {/* Body */}
      <View className="flex-1 ml-3">
        <Text className="text-text text-base font-medium" numberOfLines={1}>
          {product.name}
        </Text>
        <View className="flex-row items-center mt-0.5">
          <Text className="text-text text-sm font-semibold">
            {formatNaira(product.price_kobo)}
          </Text>
          <Text className="text-textMuted text-xs ml-2">
            {"• "}
            {outOfStock ? "Out of stock" : `${product.stock_quantity} in stock`}
          </Text>
        </View>
      </View>

      {/* Status pill (only when archived; active is the implicit default) */}
      {archived ? (
        <View className="bg-gray-100 px-2 py-0.5 rounded-full ml-2">
          <Text className="text-gray-600 text-xs font-medium">Archived</Text>
        </View>
      ) : outOfStock ? (
        <View className="bg-amber-50 px-2 py-0.5 rounded-full ml-2">
          <Text className="text-amber-700 text-xs font-medium">Low</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
