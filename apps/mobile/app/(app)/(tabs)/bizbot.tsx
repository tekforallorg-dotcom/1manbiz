import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@1manbiz/design";

import { supabase } from "../../../lib/supabase";
import { KnowledgeManager } from "../../../components/bizbot-knowledge";
import { DeliveryZonesManager } from "../../../components/bizbot-delivery";

export default function BizBotScreen() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (userErr || !userId) {
        if (active) {
          setError("You are not signed in.");
          setLoading(false);
        }
        return;
      }
      const { data, error: bizErr } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", userId)
        .maybeSingle();
      if (!active) return;
      if (bizErr || !data) {
        setError("Could not load your business.");
      } else {
        setBusinessId((data as { id: string }).id);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>BizBot</Text>
        <Text style={styles.subtitle}>Teach your assistant what to tell customers.</Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : error || !businessId ? (
          <Text style={styles.error}>{error ?? "Something went wrong."}</Text>
        ) : (
          <View>
            <KnowledgeManager businessId={businessId} />
            <DeliveryZonesManager businessId={businessId} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: "700", color: colors.text, letterSpacing: -0.5 },
  subtitle: { marginTop: 2, fontSize: 15, color: colors.textMuted },
  loader: { marginTop: 40 },
  error: { marginTop: 32, fontSize: 14, color: colors.danger, textAlign: "center" },
});
