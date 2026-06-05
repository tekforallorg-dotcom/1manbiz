import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "@1manbiz/design";

import { supabase } from "../lib/supabase";
import { formatNairaFromKobo, parseNairaToKobo } from "../lib/money";

type DeliveryZone = { id: string; label: string; fee_kobo: number; note: string | null };

export function DeliveryZonesManager({ businessId }: { businessId: string }) {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newFee, setNewFee] = useState("");
  const [newNote, setNewNote] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editFee, setEditFee] = useState("");
  const [editNote, setEditNote] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const { data, error: err } = await supabase
      .from("delivery_zones")
      .select("id, label, fee_kobo, note")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (err) {
      setError("Could not load delivery areas.");
    } else {
      setZones((data ?? []) as DeliveryZone[]);
    }
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const resetAdd = () => {
    setAdding(false);
    setNewLabel("");
    setNewFee("");
    setNewNote("");
  };

  const addZone = async () => {
    const label = newLabel.trim();
    const feeKobo = parseNairaToKobo(newFee);
    if (!label || feeKobo === null) {
      setError("Enter an area and a valid fee.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase
      .from("delivery_zones")
      .insert({ business_id: businessId, label, fee_kobo: feeKobo, note: newNote.trim() || null });
    setBusy(false);
    if (err) {
      setError("Could not add. Try again.");
      return;
    }
    resetAdd();
    await load();
  };

  const startEdit = (zone: DeliveryZone) => {
    setEditingId(zone.id);
    setEditLabel(zone.label);
    setEditFee(String(zone.fee_kobo / 100));
    setEditNote(zone.note ?? "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const label = editLabel.trim();
    const feeKobo = parseNairaToKobo(editFee);
    if (!label || feeKobo === null) {
      setError("Enter an area and a valid fee.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase
      .from("delivery_zones")
      .update({ label, fee_kobo: feeKobo, note: editNote.trim() || null })
      .eq("id", editingId);
    setBusy(false);
    if (err) {
      setError("Could not save. Try again.");
      return;
    }
    setEditingId(null);
    await load();
  };

  const archiveZone = async (id: string) => {
    setBusy(true);
    const { error: err } = await supabase
      .from("delivery_zones")
      .update({ active: false })
      .eq("id", id);
    setBusy(false);
    if (err) {
      setError("Could not remove. Try again.");
      return;
    }
    await load();
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>DELIVERY AREAS</Text>
      <Text style={styles.sectionSubtitle}>
        Where you deliver and what you charge. BizBot quotes these fees.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <View style={styles.list}>
          {zones.length === 0 && !adding ? (
            <Text style={styles.empty}>No delivery areas yet.</Text>
          ) : null}

          {zones.map((zone) =>
            editingId === zone.id ? (
              <View key={zone.id} style={styles.card}>
                <TextInput
                  style={styles.input}
                  value={editLabel}
                  onChangeText={setEditLabel}
                  placeholder="Area (e.g. Lagos - Mainland)"
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  style={styles.input}
                  value={editFee}
                  onChangeText={setEditFee}
                  placeholder="Fee in naira (e.g. 3500)"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={styles.input}
                  value={editNote}
                  onChangeText={setEditNote}
                  placeholder="Note (optional, e.g. 1-2 days)"
                  placeholderTextColor={colors.textMuted}
                />
                <View style={styles.btnRow}>
                  <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setEditingId(null)} disabled={busy}>
                    <Text style={styles.btnGhostText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[styles.btn, styles.btnPrimary]} onPress={saveEdit} disabled={busy}>
                    <Text style={styles.btnPrimaryText}>Save</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View key={zone.id} style={styles.card}>
                <View style={styles.zoneHead}>
                  <Text style={styles.cardTitle}>{zone.label}</Text>
                  <Text style={styles.fee}>{formatNairaFromKobo(zone.fee_kobo)}</Text>
                </View>
                {zone.note ? <Text style={styles.cardBody}>{zone.note}</Text> : null}
                <View style={styles.btnRow}>
                  <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => startEdit(zone)} disabled={busy}>
                    <Text style={styles.btnGhostText}>Edit</Text>
                  </Pressable>
                  <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => archiveZone(zone.id)} disabled={busy}>
                    <Text style={styles.btnDangerText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ),
          )}

          {adding ? (
            <View style={styles.card}>
              <TextInput
                style={styles.input}
                value={newLabel}
                onChangeText={setNewLabel}
                placeholder="Area (e.g. Lagos - Mainland)"
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={styles.input}
                value={newFee}
                onChangeText={setNewFee}
                placeholder="Fee in naira (e.g. 3500)"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={styles.input}
                value={newNote}
                onChangeText={setNewNote}
                placeholder="Note (optional, e.g. 1-2 days)"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.btnRow}>
                <Pressable style={[styles.btn, styles.btnGhost]} onPress={resetAdd} disabled={busy}>
                  <Text style={styles.btnGhostText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.btnPrimary]} onPress={addZone} disabled={busy}>
                  <Text style={styles.btnPrimaryText}>Save</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={[styles.btn, styles.btnAdd]} onPress={() => setAdding(true)} disabled={busy}>
              <Text style={styles.btnAddText}>+ Add area</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 13, fontWeight: "700", letterSpacing: 1, color: colors.textMuted },
  sectionSubtitle: { marginTop: 4, fontSize: 14, color: colors.textMuted },
  error: { marginTop: 12, fontSize: 13, color: colors.danger },
  loader: { marginTop: 20 },
  list: { marginTop: 14, gap: 10 },
  empty: { fontSize: 14, color: colors.textMuted, paddingVertical: 8 },
  card: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  zoneHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  fee: { fontSize: 15, fontWeight: "700", color: colors.text, marginLeft: 12 },
  cardBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  btnRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 2 },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  btnGhost: { backgroundColor: colors.surfaceMuted },
  btnGhostText: { color: colors.text, fontSize: 14, fontWeight: "500" },
  btnDangerText: { color: colors.danger, fontSize: 14, fontWeight: "500" },
  btnAdd: { backgroundColor: colors.text, alignSelf: "flex-start", paddingHorizontal: 18 },
  btnAddText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
});
