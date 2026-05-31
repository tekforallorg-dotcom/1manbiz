import { Redirect, Stack } from "expo-router";
import { useSession } from "../../lib/session";

export default function AuthLayout() {
  const { session, loading } = useSession();
  if (loading) return null;
  if (session) return <Redirect href="/home" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
