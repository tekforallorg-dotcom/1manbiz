import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

// SecureStore has a ~2KB per-item limit; Supabase session JWTs exceed it.
// We chunk by 2000 bytes and write each as `${key}.${i}`.
const CHUNK_SIZE = 2000;

const storage = {
  async getItem(key: string): Promise<string | null> {
    const chunks: string[] = [];
    let i = 0;
    while (true) {
      const chunk = await SecureStore.getItemAsync(`${key}.${i}`);
      if (chunk === null) break;
      chunks.push(chunk);
      i++;
    }
    return chunks.length > 0 ? chunks.join("") : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await Promise.all(
      chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}.${i}`, chunk)),
    );
    let j = chunks.length;
    while (true) {
      const stale = await SecureStore.getItemAsync(`${key}.${j}`);
      if (stale === null) break;
      await SecureStore.deleteItemAsync(`${key}.${j}`);
      j++;
    }
  },
  async removeItem(key: string): Promise<void> {
    let i = 0;
    while (true) {
      const existing = await SecureStore.getItemAsync(`${key}.${i}`);
      if (existing === null) break;
      await SecureStore.deleteItemAsync(`${key}.${i}`);
      i++;
    }
  },
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set in apps/mobile/.env",
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
