import { View, Text } from "react-native";

// A row of metric cards shown at the top of list screens, mirroring the web
// summary strips. The lead card is solid brand green (no gradient dep); the
// rest are white tiles. A "warn" tone turns the number amber when something
// needs attention. Figures are always derived from already-fetched data.
export type StatItem = {
  label: string;
  value: string;
  tone?: "lead" | "default" | "warn";
};

const CARD_SHADOW = {
  shadowColor: "#0B0B0B",
  shadowOpacity: 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

export function SummaryStrip({ items }: { items: StatItem[] }) {
  return (
    <View className="flex-row gap-2 mb-4">
      {items.map((s, i) => {
        const lead = s.tone === "lead";
        return (
          <View
            key={i}
            className={(lead ? "bg-primary" : "bg-white") + " flex-1 rounded-3xl px-4 py-4"}
            style={CARD_SHADOW}
          >
            <Text
              className={
                (lead ? "text-white" : "text-textMuted") +
                " text-[11px] font-semibold uppercase tracking-wider"
              }
              style={lead ? { opacity: 0.85 } : undefined}
              numberOfLines={1}
            >
              {s.label}
            </Text>
            <Text
              className={
                "text-2xl font-bold mt-1 " +
                (lead ? "text-white" : s.tone === "warn" ? "text-warn" : "text-text")
              }
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {s.value}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
