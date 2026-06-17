import { View, Text } from "react-native";

// A row of metric cards shown at the top of list screens, mirroring the web
// summary strips. The cards sit inside a hairline green ledger frame (the
// signature motif: 1Man.Biz is a ledger). The lead card is solid brand green;
// the rest are white tiles. A "warn" tone turns the number amber. A value
// beginning with the Naira mark renders the symbol at a lighter weight (the
// bold glyph shows a slash artifact in our font). Figures are always derived
// from already-fetched data.
export type StatItem = {
  label: string;
  value: string;
  tone?: "lead" | "default" | "warn";
};

const NAIRA = "\u20A6";

// Concentric with the cards: card radius 24 + 8 frame padding = 32.
const FRAME = {
  borderWidth: 2,
  borderColor: "rgba(21, 128, 61, 0.45)",
  backgroundColor: "#FFFFFF",
} as const;

const CARD_SHADOW = {
  shadowColor: "#0B0B0B",
  shadowOpacity: 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

export function SummaryStrip({ items }: { items: StatItem[] }) {
  return (
    <View className="rounded-[32px] p-2 mb-4" style={FRAME}>
      <View className="flex-row gap-2">
        {items.map((s, i) => {
          const lead = s.tone === "lead";
          const isMoney = s.value.startsWith(NAIRA);
          const amount = isMoney ? s.value.replace(/^\u20A6\s*/, "") : s.value;
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
                {isMoney ? <Text style={{ fontWeight: "500", opacity: 0.7 }}>{NAIRA + " "}</Text> : null}
                {amount}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
