import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from "react";
import { View, Text, Pressable, Animated, Easing, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, AlertCircle, Info } from "lucide-react-native";
import { colors } from "@1manbiz/design";

// Internal, branded replacement for the native OS Alert popup.
// - notify({ type, title?, message }) shows an auto-dismissing toast.
// - confirm({ title, message?, destructive?, onConfirm }) shows a modal dialog.
// Mounted once at the app root; consumed anywhere via useNotifier().
// Uses RN core Animated (no Reanimated). Outline-on-white with a deep-green /
// danger accent, matching the app system. Floating, so it carries a shadow.

type ToastType = "success" | "error" | "info";
type NotifyInput = { type?: ToastType; title?: string; message: string };
type ConfirmOpts = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
};
type NotifierApi = { notify: (t: NotifyInput) => void; confirm: (o: ConfirmOpts) => void };
type Toast = { id: number; type: ToastType; title?: string; message: string };

const SHADOW = {
  shadowColor: "#0B0B0B",
  shadowOpacity: 0.12,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
} as const;

const NotifierContext = createContext<NotifierApi | null>(null);

export function useNotifier(): NotifierApi {
  const ctx = useContext(NotifierContext);
  if (!ctx) throw new Error("useNotifier must be used within NotifierProvider");
  return ctx;
}

export function NotifierProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOpts | null>(null);
  const [busy, setBusy] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const hideToast = useCallback(() => {
    Animated.timing(anim, {
      toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setToast(null);
    });
  }, [anim]);

  const notify = useCallback((t: NotifyInput) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: ++seq.current, type: t.type ?? "info", title: t.title, message: t.message });
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
    timer.current = setTimeout(hideToast, t.type === "error" ? 4500 : 3000);
  }, [anim, hideToast]);

  const confirm = useCallback((o: ConfirmOpts) => setConfirmOpts(o), []);
  const closeConfirm = useCallback(() => { if (!busy) setConfirmOpts(null); }, [busy]);
  const runConfirm = useCallback(async () => {
    if (!confirmOpts) return;
    try { setBusy(true); await confirmOpts.onConfirm(); }
    finally { setBusy(false); setConfirmOpts(null); }
  }, [confirmOpts]);

  const accent =
    toast?.type === "success" ? colors.primary :
    toast?.type === "error" ? colors.danger : colors.textMuted;
  const Icon =
    toast?.type === "success" ? CheckCircle2 :
    toast?.type === "error" ? AlertCircle : Info;

  return (
    <NotifierContext.Provider value={{ notify, confirm }}>
      {children}

      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: "absolute", left: 16, right: 16, top: insets.top + 8, zIndex: 1000,
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
          }}
        >
          <Pressable
            onPress={hideToast}
            className="flex-row items-start bg-white rounded-2xl border border-border px-4 py-3"
            style={SHADOW}
          >
            <Icon size={20} color={accent} strokeWidth={2.25} />
            <View className="flex-1 ml-3">
              {toast.title ? <Text className="text-text font-semibold text-sm">{toast.title}</Text> : null}
              <Text className="text-textMuted text-sm leading-5">{toast.message}</Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}

      <Modal visible={!!confirmOpts} transparent animationType="fade" onRequestClose={closeConfirm}>
        <Pressable onPress={closeConfirm} className="flex-1 bg-black/40 items-center justify-center px-8">
          <Pressable onPress={() => {}} className="w-full bg-white rounded-3xl border border-border p-5" style={SHADOW}>
            <Text className="text-text font-bold text-lg">{confirmOpts?.title}</Text>
            {confirmOpts?.message ? (
              <Text className="text-textMuted text-sm leading-5 mt-1.5">{confirmOpts.message}</Text>
            ) : null}
            <View className="flex-row gap-3 mt-5">
              <Pressable
                onPress={closeConfirm}
                disabled={busy}
                className="flex-1 items-center justify-center rounded-full border border-borderStrong py-3 active:opacity-70"
              >
                <Text className="text-text font-semibold text-sm">{confirmOpts?.cancelLabel ?? "Cancel"}</Text>
              </Pressable>
              <Pressable
                onPress={runConfirm}
                disabled={busy}
                className={"flex-1 items-center justify-center rounded-full py-3 active:opacity-80 " + (confirmOpts?.destructive ? "bg-danger" : "bg-primary")}
              >
                <Text className="text-white font-semibold text-sm">{busy ? "Working..." : (confirmOpts?.confirmLabel ?? "Confirm")}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </NotifierContext.Provider>
  );
}
