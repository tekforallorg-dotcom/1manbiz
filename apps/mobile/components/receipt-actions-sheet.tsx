import { Modal, View, Text, Pressable, ActivityIndicator } from "react-native";
import { Share2, ExternalLink, Send } from "lucide-react-native";
import { colors as designColors } from "@1manbiz/design";

export interface ReceiptActionsSheetProps {
  visible: boolean;
  title?: string;
  resending?: boolean;
  onResend: () => void;
  onShare: () => void;
  onView: () => void;
  onClose: () => void;
}

// Bottom action sheet for a single receipt. Plain Modal (no gesture/reanimated
// deps), styled to match ConfirmSheet. Opened from the receipts list on a long
// press for quick actions without navigating into the detail.
export function ReceiptActionsSheet({
  visible,
  title = "Receipt",
  resending = false,
  onResend,
  onShare,
  onView,
  onClose,
}: ReceiptActionsSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={resending ? undefined : onClose} className="flex-1 bg-black/40 justify-end">
        <Pressable onPress={() => {}} className="bg-background rounded-t-3xl px-6 pt-6 pb-10">
          <View className="items-center mb-1">
            <View className="w-10 h-1 rounded-full bg-gray-200 mb-5" />
          </View>
          <Text className="text-text text-lg font-semibold mb-4">{title}</Text>

          <Pressable
            onPress={onResend}
            disabled={resending}
            className="bg-primary rounded-2xl py-4 items-center active:opacity-80 flex-row justify-center"
          >
            {resending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Send size={18} color="#FFFFFF" strokeWidth={2} />
                <Text className="text-white text-base font-semibold ml-2">Resend to customer</Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={onShare}
            className="mt-3 bg-white border border-gray-200 rounded-2xl py-4 items-center active:opacity-60 flex-row justify-center"
          >
            <Share2 size={18} color={designColors.text} strokeWidth={2} />
            <Text className="text-text text-base font-semibold ml-2">Share link</Text>
          </Pressable>

          <Pressable
            onPress={onView}
            className="mt-3 bg-white border border-gray-200 rounded-2xl py-4 items-center active:opacity-60 flex-row justify-center"
          >
            <ExternalLink size={18} color={designColors.text} strokeWidth={2} />
            <Text className="text-text text-base font-semibold ml-2">View web receipt</Text>
          </Pressable>

          <Pressable onPress={onClose} disabled={resending} className="mt-3 py-4 items-center active:opacity-60">
            <Text className="text-textMuted text-base font-medium">Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
