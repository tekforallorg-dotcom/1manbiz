import { View, TextInput } from "react-native";
import { Search } from "lucide-react-native";
import { colors as designColors } from "@1manbiz/design";

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function PickerSearchBar({ value, onChangeText, placeholder, autoFocus }: Props) {
  return (
    <View className="mx-6 mt-2 bg-gray-100 rounded-2xl px-3 py-2.5 flex-row items-center">
      <Search size={18} color={designColors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? "Search"}
        placeholderTextColor="#9CA3AF"
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        className="flex-1 ml-2 text-text text-base"
      />
    </View>
  );
}
