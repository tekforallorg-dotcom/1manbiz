import { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter, type Href } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { colors } from "@1manbiz/design";

import { NAV_ITEMS, DRAWER_GROUPS, DRAWER_FOOTER } from "./nav-items";

const MENU_WIDTH = 260;

export function AppDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // RN core Animated (native driver). No Reanimated/worklets -> no native dep.
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [open, progress]);

  // Floating popover: fade + small rise + subtle scale, anchored bottom right.
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
  const backdropOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] });

  const go = (route: string) => {
    onClose();
    router.push(route as Href);
  };

  function renderRow(name: string) {
    const item = NAV_ITEMS.find((i) => i.name === name);
    if (!item) return null;
    const Icon = item.icon;
    const active = pathname === item.route || pathname.startsWith(item.route + "/");
    return (
      <Pressable
        key={item.name}
        onPress={() => go(item.route)}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: active }}
        style={[styles.row, active && styles.rowActive]}
      >
        <View style={[styles.iconBox, active && styles.iconBoxActive]}>
          <Icon size={17} color={active ? colors.primary : colors.textMuted} />
        </View>
        <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
        <ChevronRight size={15} color={active ? colors.primary : colors.textMuted} />
      </Pressable>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? "auto" : "none"}>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.card,
          {
            right: 16,
            bottom: insets.bottom + 72,
            opacity: progress,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Menu</Text>
          <Text style={styles.subtitle}>Move around your business</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {DRAWER_GROUPS.map((group) => (
            <View key={group.heading} style={styles.group}>
              <Text style={styles.groupHeading}>{group.heading}</Text>
              {group.items.map((name) => renderRow(name))}
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>{DRAWER_FOOTER.map((name) => renderRow(name))}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "#000000",
  },
  card: {
    position: "absolute",
    width: MENU_WIDTH,
    backgroundColor: colors.background,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 18,
  },
  header: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "500",
    color: colors.textMuted,
  },
  scroll: {
    maxHeight: 392,
  },
  scrollContent: {
    paddingBottom: 2,
  },
  group: {
    marginTop: 4,
  },
  groupHeading: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textMuted,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
  },
  footer: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  rowActive: {
    backgroundColor: colors.primarySoft,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  iconBoxActive: {
    backgroundColor: colors.background,
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  labelActive: {
    color: colors.primary,
  },
});
