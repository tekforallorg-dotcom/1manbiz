import { useCallback, useState } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, Switch, ActivityIndicator, Alert, Image, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

import { useSession } from "../../../lib/session";
import { getActiveBusinessId } from "../../../lib/business";
import { supabase } from "../../../lib/supabase";
import { getBusinessLogoUrl } from "../../../lib/image";
import { pickAndUploadBusinessLogo } from "../../../lib/logo-upload";
import { generateOwnerLinkCode } from "../../../lib/owner-link";

type AiMode = "off" | "assisted" | "semi" | "autonomous";
type AiTone = "friendly" | "formal" | "playful";

const MODE_OPTIONS: { value: AiMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "assisted", label: "Assisted" },
  { value: "semi", label: "Semi" },
  { value: "autonomous", label: "Auto" },
];
const MODE_HELP: Record<AiMode, string> = {
  off: "BizBot stays silent. You handle every reply.",
  assisted: "BizBot writes a draft for every chat. You review and send.",
  semi: "BizBot sends routine replies and drafts the tricky ones for you.",
  autonomous: "BizBot replies on its own when it is confident.",
};
const TONE_OPTIONS: { value: AiTone; label: string }[] = [
  { value: "friendly", label: "Friendly" },
  { value: "formal", label: "Formal" },
  { value: "playful", label: "Playful" },
];

type FulfillmentMode = "delivery" | "pickup" | "both";
const FULFILLMENT_OPTIONS: { value: FulfillmentMode; label: string }[] = [
  { value: "delivery", label: "Delivery" },
  { value: "pickup", label: "Pickup" },
  { value: "both", label: "Both" },
];

type BizRow = {
  name: string;
  tagline: string | null;
  whatsapp_number: string | null;
  ai_mode: AiMode;
  ai_tone: AiTone;
  ai_language: string;
  catalogue_active: boolean;
  ai_sends_payment_link: boolean;
  address: string | null;
  fulfillment_mode: FulfillmentMode;
  logo_path: string | null;
};

export default function SettingsScreen() {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [mode, setMode] = useState<AiMode>("assisted");
  const [tone, setTone] = useState<AiTone>("friendly");
  const [language, setLanguage] = useState("");
  const [catalogueActive, setCatalogueActive] = useState(true);
  const [autopay, setAutopay] = useState(false);
  const [fulfillment, setFulfillment] = useState<FulfillmentMode>("both");
  const [address, setAddress] = useState("");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkedPhone, setLinkedPhone] = useState<string | null>(null);
  const [linkWaLink, setLinkWaLink] = useState<string | null>(null);
  const pickupEnabled = fulfillment === "pickup" || fulfillment === "both";

  const makeLinkCode = async () => {
    setLinkBusy(true);
    const result = await generateOwnerLinkCode();
    setLinkBusy(false);
    if (result.ok) {
      setLinkCode(result.code);
      setLinkedPhone(result.alreadyLinked ? result.linkedPhone : null);
      setLinkWaLink(result.waLink);
    } else {
      Alert.alert("Manage by WhatsApp", result.error);
    }
  };

  const openWaLink = async () => {
    if (!linkWaLink) return;
    try {
      const ok = await Linking.canOpenURL(linkWaLink);
      if (ok) {
        await Linking.openURL(linkWaLink);
      } else {
        Alert.alert("Manage by WhatsApp", "Could not open WhatsApp. Send the code shown above to your shop instead.");
      }
    } catch {
      Alert.alert("Manage by WhatsApp", "Could not open WhatsApp. Send the code shown above to your shop instead.");
    }
  };

  const load = useCallback(async () => {
    if (!userId) return;
    const id = await getActiveBusinessId(userId);
    if (!id) { setBusinessId(null); return; }
    setBusinessId(id);
    const { data } = await supabase
      .from("businesses")
      .select("name, tagline, whatsapp_number, ai_mode, ai_tone, ai_language, catalogue_active, ai_sends_payment_link, address, fulfillment_mode, logo_path")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      const b = data as BizRow;
      setName(b.name ?? "");
      setTagline(b.tagline ?? "");
      setWhatsapp(b.whatsapp_number ?? "");
      setMode(b.ai_mode);
      setTone(b.ai_tone);
      setLanguage(b.ai_language ?? "");
      setCatalogueActive(b.catalogue_active);
      setAutopay(b.ai_sends_payment_link ?? false);
      setFulfillment(b.fulfillment_mode ?? "both");
      setAddress(b.address ?? "");
      setLogoPath(b.logo_path ?? null);
      setLogoPreview(null);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load()
        .catch((err) => console.error("[settings] load error:", err))
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [load]),
  );

  const save = async () => {
    if (!businessId) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Settings", "Business name cannot be empty.");
      return;
    }
    const trimmedAddress = address.trim();
    if ((fulfillment === "pickup" || fulfillment === "both") && !trimmedAddress) {
      Alert.alert(
        "Settings",
        "Add your store address so pickup customers know where to come.",
      );
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("businesses")
      .update({
        name: trimmedName,
        tagline: tagline.trim() || null,
        ai_mode: mode,
        ai_tone: tone,
        ai_language: language.trim() || "English",
        catalogue_active: catalogueActive,
        ai_sends_payment_link: autopay,
        fulfillment_mode: fulfillment,
        address: trimmedAddress || null,
        logo_path: logoPath,
      })
      .eq("id", businessId);
    setSaving(false);
    Alert.alert("Settings", error ? "Could not save. Please try again." : "Saved.");
  };

  const changeLogo = async () => {
    if (!businessId) return;
    setUploadingLogo(true);
    const result = await pickAndUploadBusinessLogo(businessId);
    setUploadingLogo(false);
    if (result.status === "ok") {
      setLogoPath(result.path);
      setLogoPreview(result.localUri);
    } else if (result.status === "error") {
      Alert.alert("Logo", result.message);
    }
  };

  const signOut = () => {
    supabase.auth.signOut().catch((err) => console.error("[settings] sign out error:", err));
  };

  const logoUri = logoPreview ?? getBusinessLogoUrl(logoPath);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-6 pt-4 pb-3">
        <Text className="text-text text-3xl font-bold">Settings</Text>
        <Text className="text-textMuted text-base mt-1">Your business and BizBot</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#9CA3AF" />
        </View>
      ) : !businessId ? (
        <View className="px-6 pt-8">
          <Text className="text-text text-base font-medium">No business found</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-textMuted text-xs uppercase tracking-wider mt-2">BizBot mode</Text>
          <View className="flex-row mt-2 bg-gray-100 rounded-2xl p-1">
            {MODE_OPTIONS.map((opt) => {
              const active = mode === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setMode(opt.value)}
                  className={"flex-1 py-2.5 rounded-xl items-center active:opacity-80 " + (active ? "bg-primary" : "")}
                >
                  <Text className={"text-sm font-medium " + (active ? "text-white" : "text-textMuted")}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text className="text-textMuted text-sm mt-2">{MODE_HELP[mode]}</Text>

          <View className="mt-3 bg-white border border-gray-200 rounded-2xl px-4 py-3 flex-row items-center justify-between">
            <View className="flex-1 mr-3">
              <Text
                className={
                  "text-base font-medium " +
                  (mode === "autonomous" ? "text-text" : "text-textMuted")
                }
              >
                Send payment links
              </Text>
              <Text className="text-textMuted text-xs mt-0.5">
                {mode === "autonomous"
                  ? "BizBot sends a secure payment link when it confirms an order."
                  : "Turn on Auto mode to let BizBot send payment links."}
              </Text>
            </View>
            <Switch
              value={autopay}
              onValueChange={setAutopay}
              disabled={mode !== "autonomous"}
              trackColor={{ true: "#00D26A", false: "#D1D5DB" }}
            />
          </View>

          <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">Tone</Text>
          <View className="flex-row mt-2 bg-gray-100 rounded-2xl p-1">
            {TONE_OPTIONS.map((opt) => {
              const active = tone === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setTone(opt.value)}
                  className={"flex-1 py-2.5 rounded-xl items-center active:opacity-80 " + (active ? "bg-primary" : "")}
                >
                  <Text className={"text-sm font-medium " + (active ? "text-white" : "text-textMuted")}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">Language</Text>
          <TextInput
            value={language}
            onChangeText={setLanguage}
            placeholder="e.g. English"
            placeholderTextColor="#9CA3AF"
            className="mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
          />

          <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">Business logo</Text>
          <View className="mt-2 bg-white border border-gray-200 rounded-2xl p-4 flex-row items-center">
            <View className="w-20 h-20 rounded-2xl bg-gray-100 overflow-hidden items-center justify-center mr-4">
              {logoUri ? (
                <Image source={{ uri: logoUri }} className="w-20 h-20" resizeMode="cover" />
              ) : (
                <Text className="text-textMuted text-2xl font-bold">
                  {name.trim().charAt(0).toUpperCase() || "?"}
                </Text>
              )}
            </View>
            <View className="flex-1">
              <Pressable
                onPress={changeLogo}
                disabled={uploadingLogo}
                className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 items-center active:opacity-60 flex-row justify-center"
              >
                {uploadingLogo ? (
                  <ActivityIndicator color="#9CA3AF" />
                ) : (
                  <Text className="text-text text-sm font-semibold">{logoUri ? "Change logo" : "Upload logo"}</Text>
                )}
              </Pressable>
              <Text className="text-textMuted text-xs mt-2">Square image works best. Saved when you tap Save changes.</Text>
            </View>
          </View>

          <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">Business name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Business name"
            placeholderTextColor="#9CA3AF"
            className="mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
          />

          <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">Tagline</Text>
          <TextInput
            value={tagline}
            onChangeText={setTagline}
            placeholder="Short tagline (optional)"
            placeholderTextColor="#9CA3AF"
            className="mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
          />

          <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">WhatsApp number</Text>
          <View className="mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-3">
            <Text className="text-text text-base">{whatsapp || "Not connected"}</Text>
            <Text className="text-textMuted text-xs mt-1">Manage your WhatsApp connection on the web dashboard.</Text>
          </View>

          <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">Fulfillment</Text>
          <Text className="text-textMuted text-sm mt-1">How customers receive their orders.</Text>
          <View className="flex-row mt-2 bg-gray-100 rounded-2xl p-1">
            {FULFILLMENT_OPTIONS.map((opt) => {
              const active = fulfillment === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setFulfillment(opt.value)}
                  className={"flex-1 py-2.5 rounded-xl items-center active:opacity-80 " + (active ? "bg-primary" : "")}
                >
                  <Text className={"text-sm font-medium " + (active ? "text-white" : "text-textMuted")}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">
            Store address {pickupEnabled ? "(required for pickup)" : "(optional)"}
          </Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="e.g. 12 Admiralty Way, Lekki Phase 1, Lagos"
            placeholderTextColor="#9CA3AF"
            multiline
            className="mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-text text-base"
          />

          <Text className="text-textMuted text-xs uppercase tracking-wider mt-6">Manage by WhatsApp</Text>
          <Text className="text-textMuted text-sm mt-1">
            Run your shop from your own WhatsApp: ask for sales and stock, restock by message or photo. Generate a code, then send it from your personal number to your shop&apos;s WhatsApp.
          </Text>
          <View className="mt-2 bg-white border border-gray-200 rounded-2xl p-4">
            {linkedPhone ? (
              <Text className="text-text text-sm mb-3">
                Linked to <Text className="font-semibold">{linkedPhone}</Text>. Generating a new code does not unlink; send UNLINK from that number to detach.
              </Text>
            ) : null}
            {linkCode ? (
              <View className="bg-gray-100 rounded-xl px-4 py-3 mb-3">
                <Text className="text-textMuted text-xs">Send this to your shop on WhatsApp</Text>
                <Text className="text-text text-2xl font-bold tracking-widest mt-1">{"LINK " + linkCode}</Text>
                <Text className="text-textMuted text-xs mt-2">Expires in 15 minutes and works once.</Text>
              </View>
            ) : null}
            {linkCode && linkWaLink ? (
              <Pressable
                onPress={openWaLink}
                className="bg-primary rounded-xl px-4 py-3 items-center active:opacity-80 mb-3"
              >
                <Text className="text-white text-sm font-semibold">Open WhatsApp to link</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={makeLinkCode}
              disabled={linkBusy}
              className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 items-center active:opacity-60 flex-row justify-center"
            >
              {linkBusy ? (
                <ActivityIndicator color="#9CA3AF" />
              ) : (
                <Text className="text-text text-sm font-semibold">{linkCode ? "Generate a new code" : "Generate link code"}</Text>
              )}
            </Pressable>
          </View>

          <View className="mt-6 bg-white border border-gray-200 rounded-2xl px-4 py-3 flex-row items-center justify-between">
            <View className="flex-1 mr-3">
              <Text className="text-text text-base font-medium">Catalogue active</Text>
              <Text className="text-textMuted text-xs mt-0.5">Show your public catalogue to customers.</Text>
            </View>
            <Switch
              value={catalogueActive}
              onValueChange={setCatalogueActive}
              trackColor={{ true: "#00D26A", false: "#D1D5DB" }}
            />
          </View>

          <Pressable
            onPress={save}
            disabled={saving}
            className="mt-8 bg-primary rounded-2xl py-4 items-center active:opacity-80"
          >
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white text-base font-semibold">Save changes</Text>}
          </Pressable>

          <Pressable
            onPress={signOut}
            className="mt-3 bg-white border border-gray-200 rounded-2xl py-4 items-center active:opacity-60"
          >
            <Text className="text-red-600 text-base font-semibold">Sign out</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
