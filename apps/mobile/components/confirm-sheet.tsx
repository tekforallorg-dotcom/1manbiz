import { Modal, View, Text, Pressable, ActivityIndicator } from "react-native";

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Themed confirmation sheet. our replacement for the OS Alert.alert, styled in
// the 1Man.Biz design language (Terminal Pro). Slides up from the bottom over a
// dimmed scrim. Use for any destructive or state-changing confirm so the UI
// stays consistent across the app instead of falling back to iOS/Android chrome.
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel = "Back",
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      {/* Scrim. tap to dismiss (disabled while a transition is in flight) */}
      <Pressable
        onPress={pending ? undefined : onCancel}
        className="flex-1 bg-black/40 justify-end"
      >
        {/* Sheet. stop propagation so taps inside don't dismiss */}
        <Pressable onPress={() => {}} className="bg-background rounded-t-3xl px-6 pt-6 pb-10">
          <View className="items-center mb-1">
            <View className="w-10 h-1 rounded-full bg-gray-200 mb-5" />
          </View>

          <Text className="text-text text-xl font-bold">{title}</Text>
          {body ? <Text className="text-textMuted text-base mt-2 leading-6">{body}</Text> : null}

          <View className="mt-6 gap-3">
            <Pressable
              onPress={onConfirm}
              disabled={pending}
              className={
                "rounded-2xl py-4 items-center active:opacity-80 " +
                (destructive ? "bg-red-600" : "bg-primary")
              }
            >
              {pending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-white text-base font-semibold">{confirmLabel}</Text>
              )}
            </Pressable>

            <Pressable
              onPress={onCancel}
              disabled={pending}
              className="rounded-2xl py-4 items-center active:opacity-60"
            >
              <Text className="text-textMuted text-base font-medium">{cancelLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
