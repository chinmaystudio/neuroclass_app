import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { useEffect, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { Card, OutlineButton, Pill, PrimaryButton, ScreenTitle } from "@/components/neuroclass-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useNeuroClassAuth } from "@/lib/neuroclass-auth";
import { ScreenContainer } from "@/components/screen-container";
import { BIOMETRIC_LOCK_KEY } from "@/components/session-privacy-guard";

export default function ProfileScreen() {
  const colors = useColors();
  const { profile, role, error, signOut, refreshProfile } = useNeuroClassAuth();
  const [biometricLock, setBiometricLock] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  useEffect(() => { void (async () => { if (Platform.OS === "web") return; const [saved, hardware, enrolled] = await Promise.all([AsyncStorage.getItem(BIOMETRIC_LOCK_KEY), LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]); setBiometricLock(saved === "true"); setBiometricsAvailable(hardware && enrolled); })(); }, []);
  const changeBiometricLock = async (enabled: boolean) => {
    if (enabled && Platform.OS !== "web") {
      if (!biometricsAvailable) { Alert.alert("Biometric unlock unavailable", "Enroll Face ID, Touch ID, or a fingerprint in your device settings first."); return; }
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Enable NeuroClass app lock", fallbackLabel: "Use device passcode" });
      if (!result.success) return;
    }
    await AsyncStorage.setItem(BIOMETRIC_LOCK_KEY, String(enabled)); setBiometricLock(enabled);
  };
  const logout = async () => {
    try { await signOut(); }
    catch (nextError) { Alert.alert("Could not sign out", nextError instanceof Error ? nextError.message : "Please try again."); }
  };
  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenTitle eyebrow="Account" title="Profile" subtitle="Your shared NeuroClass identity and connection status." />
        <Card><View style={styles.identity}><View style={[styles.avatar, { backgroundColor: `${colors.primary}18` }]}><Text style={[styles.avatarText, { color: colors.primary }]}>{profile?.displayName?.slice(0, 1).toUpperCase() || "N"}</Text></View><View style={styles.identityCopy}><Text style={[styles.name, { color: colors.foreground }]}>{profile?.displayName || "NeuroClass member"}</Text><Text style={[styles.email, { color: colors.muted }]}>{profile?.email || "No email available"}</Text><Pill label={role === "teacher" ? "Teacher account" : role === "student" ? "Student account" : "Role awaiting setup"} tone={role ? "primary" : "warning"} /></View></View></Card>
        <Text style={[styles.label, { color: colors.muted }]}>Ecosystem connection</Text>
        <Card><View style={styles.statusRow}><View style={[styles.statusIcon, { backgroundColor: `${colors.success}18` }]}><IconSymbol name="checkmark.circle.fill" size={22} color={colors.success} /></View><View style={styles.statusCopy}><Text style={[styles.statusTitle, { color: colors.foreground }]}>Shared Supabase profile</Text><Text style={[styles.statusDetail, { color: colors.muted }]}>Your account, classrooms, and academic records connect to the existing NeuroClass workspace.</Text></View></View><OutlineButton label="Refresh profile" onPress={() => void refreshProfile()} /></Card>
        {error ? <Card><Text style={[styles.errorTitle, { color: colors.error }]}>Connection notice</Text><Text style={[styles.statusDetail, { color: colors.muted }]}>{error}</Text></Card> : null}
        <Text style={[styles.label, { color: colors.muted }]}>Privacy and settings</Text>
        <Card><View style={styles.settingRow}><View style={styles.statusCopy}><Text style={[styles.statusTitle, { color: colors.foreground }]}>Biometric app lock</Text><Text style={[styles.statusDetail, { color: colors.muted }]}>{Platform.OS === "web" ? "Available in native iOS and Android builds." : biometricsAvailable ? "Require device authentication after NeuroClass has been in the background." : "No enrolled device biometrics were detected."}</Text></View><Switch value={biometricLock} disabled={Platform.OS === "web" || !biometricsAvailable} onValueChange={(value) => void changeBiometricLock(value)} trackColor={{ false: colors.border, true: `${colors.primary}99` }} thumbColor={biometricLock ? colors.primary : "#FFFFFF"} /></View></Card>
        <Text style={[styles.label, { color: colors.muted }]}>Session</Text>
        <PrimaryButton label="Sign out securely" tone="danger" onPress={() => void logout()} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: 20, paddingBottom: 32, gap: 13 },
  identity: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 26, fontWeight: "900" },
  identityCopy: { flex: 1, gap: 4 },
  name: { fontSize: 18, fontWeight: "900" },
  email: { fontSize: 13 },
  label: { fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 7 },
  statusRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  statusIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  statusCopy: { flex: 1, gap: 3 },
  statusTitle: { fontSize: 15, fontWeight: "800" },
  statusDetail: { fontSize: 13, lineHeight: 19 },
  settingRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  errorTitle: { fontSize: 15, fontWeight: "800" },
});
