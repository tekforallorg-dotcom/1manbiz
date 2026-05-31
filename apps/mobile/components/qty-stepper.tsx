import { View, Text, Pressable } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { colors as designColors } from "@1manbiz/design";

interface Props {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}

export function QtyStepper({ value, onChange, min = 1, max = 999 }: Props) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <View className="flex-row items-center bg-gray-100 rounded-full px-1 py-1">
      <Pressable
        onPress={dec}
        disabled={atMin}
        className="w-7 h-7 items-center justify-center active:opacity-50"
        style={{ opacity: atMin ? 0.35 : 1 }}
      >
        <Minus size={16} color={designColors.text} />
      </Pressable>
      <Text className="text-text text-base font-semibold w-7 text-center">{value}</Text>
      <Pressable
        onPress={inc}
        disabled={atMax}
        className="w-7 h-7 items-center justify-center active:opacity-50"
        style={{ opacity: atMax ? 0.35 : 1 }}
      >
        <Plus size={16} color={designColors.text} />
      </Pressable>
    </View>
  );
}
