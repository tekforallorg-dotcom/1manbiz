import { View, Text } from "react-native";

interface Props {
  label: string;
  value: string | null;     // null = error state -> render em-dash
  loading?: boolean;
}

// Single dashboard metric tile. White card, label above value.
// Loading: gray skeleton block. Error: em-dash. Otherwise: value.
export function DashboardTile({ label, value, loading }: Props) {
  return (
    <View className="flex-1 bg-white border border-gray-200 rounded-2xl p-4">
      <Text className="text-textMuted text-xs font-medium uppercase tracking-wider">
        {label}
      </Text>

      {loading ? (
        <View className="mt-2 h-8 w-20 rounded-md bg-gray-100" />
      ) : (
        <Text className="text-text text-2xl font-bold mt-1" numberOfLines={1}>
          {value ?? "—"}
        </Text>
      )}
    </View>
  );
}
