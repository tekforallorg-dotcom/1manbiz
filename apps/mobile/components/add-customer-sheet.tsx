import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, TextInput, ActivityIndicator } from "react-native";

export interface AddCustomerSheetProps {
  visible: boolean;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (name: string, phone: string) => void;
}

// Add a customer manually (walk-in). Plain Modal, matches ConfirmSheet styling.
// Name + phone; the caller runs createCustomer, which validates and normalizes.
export function AddCustomerSheet({ visible, saving, error, onCancel, onSave }: AddCustomerSheetProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!visible) { setName(""); setPhone(""); }
  }, [visible]);

  const handleCancel = () => { if (!saving) onCancel(); };
  const handleSave = () => { if (!saving) onSave(name, phone); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <Pressable onPress={handleCancel} className="flex-1 bg-black/40 justify-end">
        <Pressable onPress={() => {}} className="bg-background rounded-t-3xl px-6 pt-6 pb-10">
          <View className="items-center mb-1">
            <View className="w-10 h-1 rounded-full bg-gray-200 mb-5" />
          </View>
          <Text className="text-text text-lg font-semibold mb-4">Add customer</Text>

          <Text className="text-textMuted text-xs uppercase tracking-wider mb-1">Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Customer name"
            placeholderTextColor="#9CA3AF"
            className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base mb-4"
            autoFocus
            editable={!saving}
          />

          <Text className="text-textMuted text-xs uppercase tracking-wider mb-1">Phone</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="e.g. 0803 123 4567"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
            editable={!saving}
          />

          {error ? <Text className="text-red-600 text-sm mt-3">{error}</Text> : null}

          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="mt-5 bg-primary rounded-2xl py-4 items-center active:opacity-80 flex-row justify-center"
          >
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white text-base font-semibold">Save customer</Text>}
          </Pressable>
          <Pressable onPress={handleCancel} disabled={saving} className="mt-3 py-4 items-center active:opacity-60">
            <Text className="text-textMuted text-base font-medium">Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
