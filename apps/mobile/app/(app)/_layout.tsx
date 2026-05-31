import { Redirect, Stack } from "expo-router";
import { useSession } from "../../lib/session";

export default function AppLayout() {
  const { session, loading } = useSession();
  if (loading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
