import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "../lib/session";
import { NotifierProvider } from "../components/notifier";

export default function RootLayout() {
  return (
    <SessionProvider>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <NotifierProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </NotifierProvider>
      </SafeAreaProvider>
    </SessionProvider>
  );
}
