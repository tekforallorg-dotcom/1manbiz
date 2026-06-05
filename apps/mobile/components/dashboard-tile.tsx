import { View, Text, Pressable } from "react-native";

interface Props {
  label: string;
  value: string | null; // null = error state, render a dash
  loading?: boolean;
  accent?: boolean;      // green number, for the metric that matters most
  onPress?: () => void;
}

const CARD_SHADOW = {
  shadowColor: "#0B0B0B",
  shadowOpacity: 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

// Single dashboard metric card in the premium style: white, no border,
// soft shadow, muted uppercase micro-label above one big number.
export function DashboardTile({ label, value, loading, accent, onPress }: Props) {
  const body = (
    <View className="flex-1 bg-white rounded-3xl px-4 py-4" style={CARD_SHADOW}>
      <Text className="text-textMuted text-xs font-medium uppercase tracking-wider">
        {label}
      </Text>
      {loading ? (
        <View className="mt-2 h-8 w-20 rounded-lg bg-gray-100" />
      ) : (
        <Text
          className={"text-2xl font-bold mt-1 " + (accent ? "text-primary" : "text-text")}
          numberOfLines={1}
        >
          {value ?? "-"}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} className="flex-1 active:opacity-80">
        {body}
      </Pressable>
    );
  }
  return body;
}
