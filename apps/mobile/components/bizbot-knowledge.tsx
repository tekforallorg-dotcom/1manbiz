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

type KnowledgeItem = { id: string; title: string; content: string };

export function KnowledgeManager({ businessId }: { businessId: string }) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const { data, error: err } = await supabase
      .from("knowledge_items")
      .select("id, title, content")
      .eq("business_id", businessId)
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (err) {
      setError("Could not load knowledge.");
    } else {
      setItems((data ?? []) as KnowledgeItem[]);
    }
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const resetAdd = () => {
    setAdding(false);
    setNewTitle("");
    setNewContent("");
  };

  const addItem = async () => {
    const title = newTitle.trim();
    const content = newContent.trim();
    if (!title || !content) return;
    setBusy(true);
    const { error: err } = await supabase
      .from("knowledge_items")
      .insert({ business_id: businessId, title, content });
    setBusy(false);
    if (err) {
      setError("Could not add. Try again.");
      return;
    }
    resetAdd();
    await load();
  };

  const startEdit = (item: KnowledgeItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const title = editTitle.trim();
    const content = editContent.trim();
    if (!title || !content) return;
    setBusy(true);
    const { error: err } = await supabase
      .from("knowledge_items")
      .update({ title, content })
      .eq("id", editingId);
    setBusy(false);
    if (err) {
      setError("Could not save. Try again.");
      return;
    }
    setEditingId(null);
    await load();
  };

  const archiveItem = async (id: string) => {
    setBusy(true);
    const { error: err } = await supabase
      .from("knowledge_items")
      .update({ status: "archived" })
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
      <Text style={styles.sectionTitle}>Knowledge</Text>
      <Text style={styles.sectionSubtitle}>
        Facts BizBot uses to answer customers - refunds, hours, policies.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <View style={styles.list}>
          {items.length === 0 && !adding ? (
            <Text style={styles.empty}>No knowledge yet.</Text>
          ) : null}

          {items.map((item) =>
            editingId === item.id ? (
              <View key={item.id} style={styles.card}>
                <TextInput
                  style={styles.input}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Title"
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  style={[styles.input, styles.multiline]}
                  value={editContent}
                  onChangeText={setEditContent}
                  placeholder="What should BizBot know?"
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
                <View style={styles.btnRow}>
                  <Pressable
                    style={[styles.btn, styles.btnGhost]}
                    onPress={() => setEditingId(null)}
                    disabled={busy}
                  >
                    <Text style={styles.btnGhostText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btn, styles.btnPrimary]}
                    onPress={saveEdit}
                    disabled={busy}
                  >
                    <Text style={styles.btnPrimaryText}>Save</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View key={item.id} style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBody}>{item.content}</Text>
                <View style={styles.btnRow}>
                  <Pressable
                    style={[styles.btn, styles.btnGhost]}
                    onPress={() => startEdit(item)}
                    disabled={busy}
                  >
                    <Text style={styles.btnGhostText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btn, styles.btnGhost]}
                    onPress={() => archiveItem(item.id)}
                    disabled={busy}
                  >
                    <Text style={styles.btnDangerText}>Archive</Text>
                  </Pressable>
                </View>
              </View>
            ),
          )}

          {adding ? (
            <View style={styles.card}>
              <TextInput
                style={styles.input}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="Title (e.g. Refund policy)"
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={[styles.input, styles.multiline]}
                value={newContent}
                onChangeText={setNewContent}
                placeholder="What should BizBot know?"
                placeholderTextColor={colors.textMuted}
                multiline
              />
              <View style={styles.btnRow}>
                <Pressable
                  style={[styles.btn, styles.btnGhost]}
                  onPress={resetAdd}
                  disabled={busy}
                >
                  <Text style={styles.btnGhostText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={addItem}
                  disabled={busy}
                >
                  <Text style={styles.btnPrimaryText}>Save</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={[styles.btn, styles.btnAdd]}
              onPress={() => setAdding(true)}
              disabled={busy}
            >
              <Text style={styles.btnAddText}>+ Add knowledge</Text>
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
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
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
  multiline: { minHeight: 72, textAlignVertical: "top" },
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
