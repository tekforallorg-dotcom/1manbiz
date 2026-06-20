import type { ComponentType, ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { colors } from "@1manbiz/design";

import type { ConnectorTone, ConnectorHealth } from "../lib/connectors";

type IconType = ComponentType<{ size?: number; color?: string }>;

interface Props {
  name: string;
  description: string;
  icon?: IconType; // used only when no logo node is provided
  logo?: ReactNode; // brand logo chip; overrides icon when present
  health: ConnectorHealth | null; // null => not connected
  detail?: string | null;
  metaLine?: string | null;
  errorText?: string | null;
  onPress?: () => void;
}

const PILL: Record<ConnectorTone, { box: string; dot: string; text: string }> = {
  success: { box: "bg-green-50", dot: "bg-green-600", text: "text-green-700" },
  warn: { box: "bg-amber-50", dot: "bg-amber-500", text: "text-amber-700" },
  danger: { box: "bg-red-50", dot: "bg-red-500", text: "text-red-700" },
  muted: { box: "bg-gray-100", dot: "bg-gray-400", text: "text-gray-500" },
};

export function ConnectorCard({
  name,
  description,
  icon: Icon,
  logo,
  health,
  detail,
  metaLine,
  errorText,
  onPress,
}: Props) {
  const tone: ConnectorTone = health?.tone ?? "muted";
  const pill = PILL[tone];
  const statusLabel = health?.label ?? "Not connected";

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${name}, ${statusLabel}`}
      className="bg-white border border-gray-200 rounded-2xl p-4 mb-3 active:opacity-90"
    >
      <View className="flex-row items-center">
        {logo ?? (
          <View className="w-11 h-11 rounded-xl bg-green-50 items-center justify-center">
            {Icon ? <Icon size={20} color={colors.primary} /> : null}
          </View>
        )}

        <View className="flex-1 px-3">
          <Text className="text-text text-base font-bold" numberOfLines={1}>
            {name}
          </Text>
          <Text className="text-textMuted text-sm mt-0.5" numberOfLines={1}>
            {description}
          </Text>
        </View>

        <View className={`flex-row items-center ${pill.box} rounded-full px-2.5 py-1`}>
          <View className={`w-1.5 h-1.5 rounded-full ${pill.dot} mr-1.5`} />
          <Text className={`text-xs font-semibold ${pill.text}`}>{statusLabel}</Text>
        </View>

        {onPress ? (
          <ChevronRight size={16} color={colors.textMuted} style={{ marginLeft: 6 }} />
        ) : null}
      </View>

      {detail || metaLine ? (
        <View className="flex-row items-center mt-3" style={{ paddingLeft: 56 }}>
          {detail ? (
            <Text className="text-text text-sm font-medium" numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
          {detail && metaLine ? (
            <Text className="text-textMuted text-sm">{"  \u00B7  "}</Text>
          ) : null}
          {metaLine ? <Text className="text-textMuted text-sm">{metaLine}</Text> : null}
        </View>
      ) : null}

      {errorText ? (
        <View className="mt-3 bg-red-50 rounded-xl px-3 py-2" style={{ marginLeft: 56 }}>
          <Text className="text-red-700 text-sm">{errorText}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
