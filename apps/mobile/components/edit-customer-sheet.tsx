import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, TextInput, ActivityIndicator } from "react-native";

export interface EditCustomerSheetProps {
  visible: boolean;
  initialName: string;
  initialNotes: string;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (name: string, notes: string) => void;
}

// Edit a customer's display name and notes. Plain Modal, matches ConfirmSheet.
export function EditCustomerSheet({
  visible,
  initialName,
  initialNotes,
  saving,
  error,
  onCancel,
  onSave,
}: EditCustomerSheetProps) {
  const [name, setName] = useState(initialName);
  const [notes, setNotes] = useState(initialNotes);

  useEffect(() => {
    if (visible) { setName(initialName); setNotes(initialNotes); }
  }, [visible, initialName, initialNotes]);

  const handleCancel = () => { if (!saving) onCancel(); };
  const handleSave = () => { if (!saving) onSave(name, notes); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <Pressable onPress={handleCancel} className="flex-1 bg-black/40 justify-end">
        <Pressable onPress={() => {}} className="bg-background rounded-t-3xl px-6 pt-6 pb-10">
          <View className="items-center mb-1">
            <View className="w-10 h-1 rounded-full bg-gray-200 mb-5" />
          </View>
          <Text className="text-text text-lg font-semibold mb-4">Edit customer</Text>

          <Text className="text-textMuted text-xs uppercase tracking-wider mb-1">Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Customer name"
            placeholderTextColor="#9CA3AF"
            className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base mb-4"
            editable={!saving}
          />

          <Text className="text-textMuted text-xs uppercase tracking-wider mb-1">Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. prefers Lekki delivery, VIP"
            placeholderTextColor="#9CA3AF"
            multiline
            className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
            style={{ minHeight: 88, textAlignVertical: "top" }}
            editable={!saving}
          />

          {error ? <Text className="text-red-600 text-sm mt-3">{error}</Text> : null}

          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="mt-5 bg-primary rounded-2xl py-4 items-center active:opacity-80 flex-row justify-center"
          >
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white text-base font-semibold">Save changes</Text>}
          </Pressable>
          <Pressable onPress={handleCancel} disabled={saving} className="mt-3 py-4 items-center active:opacity-60">
            <Text className="text-textMuted text-base font-medium">Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
