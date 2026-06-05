import { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter, type Href } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { colors } from "@1manbiz/design";

import { NAV_ITEMS } from "./nav-items";

const MENU_WIDTH = 264;

export function AppDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // RN core Animated (native driver). No Reanimated/worklets -> no native dep.
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [open, progress]);

  // Floating popover: fade + small rise + subtle scale, centered above the bar.
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
  const backdropOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] });

  const left = Math.max((width - MENU_WIDTH) / 2, 16);

  const go = (route: string) => {
    onClose();
    router.push(route as Href);
  };

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
            left,
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

        <View style={styles.list}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.route || pathname.startsWith(item.route + "/");
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
                <Text style={[styles.label, active && styles.labelActive]}>
                  {item.label}
                </Text>
                <ChevronRight
                  size={15}
                  color={active ? colors.primary : colors.textMuted}
                />
              </Pressable>
            );
          })}
        </View>
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
    marginBottom: 4,
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
  list: {
    gap: 2,
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
