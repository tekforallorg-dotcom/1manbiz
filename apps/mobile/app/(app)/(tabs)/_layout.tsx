import { useState } from "react";
import { View } from "react-native";
import { Tabs } from "expo-router";

import { AppDrawer } from "../../../components/app-drawer";
import { BottomBar, type BottomBarNav } from "../../../components/bottom-bar";

export default function TabsLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => (
          <BottomBar
            // props is react-navigation BottomTabBarProps; we read state/navigation only.
            bar={props as unknown as BottomBarNav}
            onMenu={() => setDrawerOpen(true)}
            menuActive={drawerOpen}
          />
        )}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="conversations" />
        <Tabs.Screen name="orders" />
        <Tabs.Screen name="bookings" />
        <Tabs.Screen name="inventory" />
        <Tabs.Screen name="bizbot" />
        <Tabs.Screen name="settings" />
      </Tabs>

      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}
