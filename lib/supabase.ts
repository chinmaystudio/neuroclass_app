import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SUPABASE_URL = "https://hdjtgyvdlxwntfriqhff.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_t2cJNXXRJV_ZmOKyKEAHjA_81pd2cbl";
const SESSION_STORAGE_KEY = "neuroclass.supabase.session";
const hasBrowserStorage = Platform.OS === "web" && typeof window !== "undefined";

const secureStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === "web") return hasBrowserStorage ? AsyncStorage.getItem(key) : null;
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === "web") {
      if (hasBrowserStorage) await AsyncStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === "web") {
      if (hasBrowserStorage) await AsyncStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: secureStorage,
    storageKey: SESSION_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const neuroClassApiBaseUrl = "https://neuroclass-swart.vercel.app";
