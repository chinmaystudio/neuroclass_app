import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { LoadingState, PrimaryButton } from "@/components/neuroclass-ui";
import { useColors } from "@/hooks/use-colors";
import { useNeuroClassAuth } from "@/lib/neuroclass-auth";

export const BIOMETRIC_LOCK_KEY = "neuroclass.biometric-lock.enabled";

export function SessionPrivacyGuard({ children }: { children: React.ReactNode }) {
  const { user } = useNeuroClassAuth();
  const colors = useColors();
  const [enabled, setEnabled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const backgroundAt = useRef<number | null>(null);

  const unlock = async () => {
    if (Platform.OS === "web") { setLocked(false); return; }
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) {
      setLocked(false);
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock NeuroClass", fallbackLabel: "Use device passcode" });
    if (result.success) setLocked(false);
  };

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(BIOMETRIC_LOCK_KEY).then((value) => {
      if (active) { setEnabled(value === "true"); setChecking(false); }
    });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        backgroundAt.current = Date.now();
        return;
      }
      if (state === "active" && enabled && backgroundAt.current && Date.now() - backgroundAt.current > 30_000) {
        setLocked(true);
        backgroundAt.current = null;
      }
    });
    return () => subscription.remove();
  }, [enabled]);

  if (checking) return <LoadingState label="Preparing your private workspace…" />;
  if (!locked) return <>{children}</>;
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.lockCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>NEUROCLASS PRIVACY</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Your workspace is locked</Text>
        <Text style={[styles.detail, { color: colors.muted }]}>Authenticate with your device to return to your existing NeuroClass session.</Text>
        <PrimaryButton label="Unlock NeuroClass" onPress={() => void unlock()} />
        <Pressable onPress={() => setLocked(false)}><Text style={[styles.link, { color: colors.muted }]}>Continue without biometric lock</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  lockCard: { width: "100%", maxWidth: 430, borderWidth: 1, borderRadius: 24, padding: 22, gap: 12, alignItems: "stretch" },
  eyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 1, textAlign: "center" },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "900", textAlign: "center" },
  detail: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  link: { fontSize: 13, textAlign: "center", paddingTop: 4 },
});

