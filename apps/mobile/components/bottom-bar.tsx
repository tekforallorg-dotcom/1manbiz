import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Menu } from "lucide-react-native";
import { colors } from "@1manbiz/design";

import { NAV_ITEMS, PINNED } from "./nav-items";

const INACTIVE = "#9CA3AF";

// Minimal structural view of react-navigation's BottomTabBarProps -- only the
// fields we read. The layout casts the real props to this to avoid importing a
// non-direct dependency (@react-navigation/bottom-tabs).
export type BottomBarNav = {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  navigation: {
    emit: (event: {
      type: "tabPress";
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

export function BottomBar({
  bar,
  onMenu,
  menuActive,
}: {
  bar: BottomBarNav;
  onMenu: () => void;
  menuActive: boolean;
}) {
  const insets = useSafeAreaInsets();
  const activeName = bar.state.routes[bar.state.index]?.name;

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom || 8 }]}>
      {PINNED.map((name) => {
        const item = NAV_ITEMS.find((i) => i.name === name);
        if (!item) return null;
        const Icon = item.icon;
        const route = bar.state.routes.find((r) => r.name === name);
        const active = !menuActive && activeName === name;
        const tint = active ? colors.primary : INACTIVE;
        const onPress = () => {
          if (!route) return;
          const event = bar.navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!active && !event.defaultPrevented) {
            bar.navigation.navigate(name);
          }
        };
        return (
          <Pressable
            key={name}
            style={styles.item}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Icon size={22} color={tint} />
            </View>
            <Text style={[styles.label, { color: tint }]}>{item.label}</Text>
          </Pressable>
        );
      })}

      <Pressable
        style={styles.item}
        onPress={onMenu}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        accessibilityState={{ selected: menuActive }}
      >
        <View style={[styles.iconWrap, menuActive && styles.iconWrapActive]}>
          <Menu size={22} color={menuActive ? colors.primary : INACTIVE} />
        </View>
        <Text style={[styles.label, { color: menuActive ? colors.primary : INACTIVE }]}>
          Menu
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  iconWrap: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 999,
  },
  iconWrapActive: {
    backgroundColor: colors.primarySoft,
  },
  label: {
    fontSize: 11,
    fontWeight: "500",
  },
});
