import { Bot } from "lucide-react-native";
import { Text, View } from "react-native";
import { colors as designColors } from "@1manbiz/design";

// Single source of truth for the BizBot identity mark. Import BizBotIcon (the
// head glyph) and BizBotLabel (head + "BizBot" text) from here everywhere, so
// the AI's branding never drifts again. To rebrand BizBot, change it once here.
export const BizBotIcon = Bot;

export function BizBotLabel() {
  return (
    <View className="flex-row items-center px-1">
      <BizBotIcon size={13} color={designColors.primary} strokeWidth={2} />
      <Text className="text-primary text-[11px] font-semibold ml-1">BizBot</Text>
    </View>
  );
}
