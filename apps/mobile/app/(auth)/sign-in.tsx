import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@1manbiz/design";
import { Wordmark } from "../../components/wordmark";
import { supabase } from "../../lib/supabase";

function mapAuthError(message: string): string {
  if (message.includes("Invalid login credentials")) return "Email or password is incorrect";
  if (message.includes("Email not confirmed")) return "Please confirm your email first";
  if (message.toLowerCase().includes("rate limit")) return "Too many attempts, please wait a moment";
  return "Sign in failed, please try again";
}

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = email.length > 0 && password.length > 0 && !loading;

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) setError(mapAuthError(authError.message));
    } catch (err) {
      console.error("[sign-in] unexpected error:", err);
      setError("Sign in failed, please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <SafeAreaView className="flex-1">
        <View className="flex-1 justify-center px-6">
          <View className="items-center mb-12">
            <Wordmark />
          </View>

          <Text className="text-foreground text-3xl font-semibold">Welcome back</Text>
          <Text className="text-text-muted text-base mt-2">Sign in to your business</Text>

          <View className="mt-8">
            <TextInput
              accessibilityLabel="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              className="border border-text-muted rounded-lg px-4 py-3 text-foreground text-base"
            />
            <TextInput
              accessibilityLabel="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              className="border border-text-muted rounded-lg px-4 py-3 text-foreground text-base mt-3"
            />
            <View className="min-h-5 mt-2">
              {error ? <Text className="text-red-600 text-sm">{error}</Text> : null}
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={onSubmit}
            className={`bg-brand-primary rounded-lg py-3 items-center mt-6 ${canSubmit ? "" : "opacity-50"}`}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text className="text-background text-base font-semibold">Sign in</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
