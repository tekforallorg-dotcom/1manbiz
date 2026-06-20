import { useEffect, useState } from "react";
import { View, Text, Image } from "react-native";
import { Landmark } from "lucide-react-native";
import { colors } from "@1manbiz/design";

// Loads a provider's real brand logo at runtime by domain. Default source is
// Google's favicon service (no key, always resolves); if EXPO_PUBLIC_LOGODEV_TOKEN
// is set we use logo.dev for crisper, higher-res marks. On any load failure we
// fall back to a clean lettermark so a card never renders broken. Generic rails
// with no brand domain (bank transfer) render a neutral icon.
const LOGODEV_TOKEN = process.env.EXPO_PUBLIC_LOGODEV_TOKEN;

function logoUrl(domain: string): string {
  if (LOGODEV_TOKEN) {
    return `https://img.logo.dev/${domain}?token=${LOGODEV_TOKEN}&size=96&format=png`;
  }
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

export function ProviderLogo({ domain, name }: { domain: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  // Reset the error state if the domain changes (list reuse safety).
  useEffect(() => {
    setFailed(false);
  }, [domain]);

  if (!domain) {
    return (
      <View className="w-11 h-11 rounded-xl bg-green-50 items-center justify-center">
        <Landmark size={20} color={colors.primary} />
      </View>
    );
  }

  if (failed) {
    return (
      <View className="w-11 h-11 rounded-xl bg-gray-100 items-center justify-center">
        <Text className="text-gray-600 text-base font-bold">{name.charAt(0)}</Text>
      </View>
    );
  }

  return (
    <View className="w-11 h-11 rounded-xl bg-white border border-gray-200 items-center justify-center overflow-hidden">
      <Image
        source={{ uri: logoUrl(domain) }}
        style={{ width: 26, height: 26 }}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    </View>
  );
}
