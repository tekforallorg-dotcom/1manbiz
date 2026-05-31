import { View, Text, Pressable, ScrollView } from "react-native";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}

// Pill-style horizontally-scrollable segmented filter.
// Active pill = brand-primary background, white text. Inactive = light gray.
export function StatusFilter<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={active ? { backgroundColor: "#00D26A" } : undefined}
            className={
              "px-4 py-2 rounded-full active:opacity-70 " +
              (active ? "" : "bg-gray-100")
            }
          >
            <Text
              style={active ? { color: "#FFFFFF" } : undefined}
              className={"text-sm font-medium " + (active ? "" : "text-text")}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
