import { View, Text, Pressable } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import { colors as designColors } from "@1manbiz/design";

interface Props {
  title: string;
  onBack?: () => void;
}

// Reusable header for Stack screens nested under the (app) group, which has
// headerShown: false. Provides iOS-standard back chevron + title aligned left.
export function ScreenHeader({ title, onBack }: Props) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace("/home");
  };

  return (
    <View className="px-2 py-2 flex-row items-center">
      <Pressable
        onPress={handleBack}
        hitSlop={12}
        className="w-10 h-10 items-center justify-center active:opacity-60"
      >
        <ChevronLeft size={28} color={designColors.text} />
      </Pressable>
      <Text className="text-text text-xl font-semibold ml-1">{title}</Text>
    </View>
  );
}
