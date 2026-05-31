import { useEffect, useState, useMemo } from "react";
import {
  View, Text, Modal, Pressable, TextInput, ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UserPlus } from "lucide-react-native";
import { listCustomers, createCustomer, type Customer } from "../lib/customers";
import { PickerSearchBar } from "./picker-search-bar";

interface Props {
  visible: boolean;
  businessId: string | null;
  onSelect: (customer: Customer) => void;
  onClose: () => void;
}

export function CustomerPicker({ visible, businessId, onSelect, onClose }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !businessId) return;
    setLoading(true);
    setQuery("");
    setCreating(false);
    setNewName("");
    setNewPhone("");
    listCustomers(businessId)
      .then(setCustomers)
      .finally(() => setLoading(false));
  }, [visible, businessId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return customers;
    const q = query.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone_e164.includes(q),
    );
  }, [customers, query]);

  const handleCreate = async () => {
    if (!businessId) return;
    setSaving(true);
    const result = await createCustomer(businessId, newName, newPhone);
    setSaving(false);
    if (result.error || !result.customer) {
      Alert.alert("Could not add customer", result.error ?? "Please try again.");
      return;
    }
    onSelect(result.customer);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <View className="px-6 pt-2 pb-3 flex-row items-center justify-between">
          <Pressable onPress={onClose} hitSlop={12}>
            <Text className="text-textMuted text-base">Cancel</Text>
          </Pressable>
          <Text className="text-text text-base font-semibold">
            {creating ? "New customer" : "Select customer"}
          </Text>
          <View className="w-16" />
        </View>

        {creating ? (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12 }}>
            <Text className="text-textMuted text-xs uppercase tracking-wider mb-2">Name</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Customer name"
              placeholderTextColor="#9CA3AF"
              autoFocus
              className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
            />
            <Text className="text-textMuted text-xs uppercase tracking-wider mb-2 mt-4">Phone</Text>
            <TextInput
              value={newPhone}
              onChangeText={setNewPhone}
              placeholder="2348012345678"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
            />
            <Pressable
              onPress={handleCreate}
              disabled={saving}
              style={{ backgroundColor: "#00D26A" }}
              className="rounded-2xl py-4 items-center active:opacity-80 mt-6"
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ color: "#FFFFFF" }} className="text-base font-semibold">
                  Add customer
                </Text>
              )}
            </Pressable>
            <Pressable onPress={() => setCreating(false)} className="py-3 mt-2 items-center">
              <Text className="text-textMuted text-sm">Back to list</Text>
            </Pressable>
          </ScrollView>
        ) : (
          <>
            <PickerSearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Search name or phone"
            />
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 }}>
              <Pressable
                onPress={() => setCreating(true)}
                className="flex-row items-center bg-white border border-gray-200 rounded-2xl p-4 mb-3 active:opacity-60"
              >
                <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3">
                  <UserPlus size={20} color="#00D26A" />
                </View>
                <Text className="text-text text-base font-semibold">New customer</Text>
              </Pressable>

              {loading ? (
                <ActivityIndicator color="#9CA3AF" />
              ) : filtered.length === 0 ? (
                <Text className="text-textMuted text-sm">
                  {query ? "No customers match." : "No customers yet."}
                </Text>
              ) : (
                <View className="gap-2">
                  {filtered.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => onSelect(c)}
                      className="bg-white border border-gray-200 rounded-2xl p-4 active:opacity-60"
                    >
                      <Text className="text-text text-base font-medium">{c.name}</Text>
                      <Text className="text-textMuted text-sm mt-0.5">+{c.phone_e164}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}
