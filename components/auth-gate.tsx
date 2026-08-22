import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import { useNeuroClassAuth } from "@/lib/neuroclass-auth";
import type { AppRole } from "@/lib/neuroclass-types";
import { Card, LoadingState, PrimaryButton, uiStyles } from "@/components/neuroclass-ui";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useNeuroClassAuth();
  if (loading) return <LoadingState label="Restoring your secure NeuroClass session…" />;
  if (!user) return <AuthScreen />;
  return <>{children}</>;
}

function AuthScreen() {
  const colors = useColors();
  const { signIn, signUp, requestPasswordReset } = useNeuroClassAuth();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AppRole>("student");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Complete your sign-in", "Enter your email address and password to continue.");
      return;
    }
    if (mode === "signUp" && !name.trim()) {
      Alert.alert("Tell us your name", "A display name is required for your shared NeuroClass profile.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signIn") {
        await signIn(email, password);
      } else {
        await signUp({ email, password, name, phone, role });
        setNotice("Your account has been created. If email confirmation is enabled, confirm your address, then sign in.");
      }
    } catch (error) {
      Alert.alert("NeuroClass could not continue", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandLockup}>
          <View style={[styles.logo, { backgroundColor: colors.primary }]}><Text style={styles.logoText}>N</Text></View>
          <Text style={[styles.brand, { color: colors.foreground }]}>NeuroClass</Text>
          <Text style={[styles.tagline, { color: colors.muted }]}>Your classroom, connected.</Text>
        </View>

        <Card>
          <View style={styles.switcher}>
            {(["signIn", "signUp"] as const).map((option) => (
              <Pressable key={option} onPress={() => { setMode(option); setNotice(null); }} style={[styles.switch, mode === option ? { backgroundColor: colors.primary } : null]}>
                <Text style={[styles.switchText, { color: mode === option ? "#FFFFFF" : colors.muted }]}>{option === "signIn" ? "Sign in" : "Create account"}</Text>
              </Pressable>
            ))}
          </View>

          {mode === "signUp" ? <>
              <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Full name</Text>
              <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.muted} style={[uiStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]} />
            </> : null}
          <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>{mode === "signIn" ? "Continue as" : "I am joining as"}</Text>
          <View style={styles.roleRow}>
            {(["student", "teacher"] as const).map((option) => (
              <Pressable key={option} onPress={() => setRole(option)} style={[styles.roleOption, { borderColor: role === option ? colors.primary : colors.border, backgroundColor: role === option ? `${colors.primary}14` : colors.background }]}>
                <Text style={[styles.roleOptionTitle, { color: colors.foreground }]}>{option === "student" ? "Student" : "Teacher"}</Text>
                <Text style={[styles.roleOptionDetail, { color: colors.muted }]}>{option === "student" ? "Join and learn" : "Create and manage"}</Text>
              </Pressable>
            ))}
          </View>
          {mode === "signIn" ? <Text style={[styles.roleSafety, { color: colors.muted }]}>Your stored NeuroClass profile—not this selection—determines your actual access after sign-in.</Text> : null}

          <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Email address</Text>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={colors.muted} style={[uiStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]} />
          {mode === "signUp" ? <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Mobile number <Text style={{ color: colors.muted, fontWeight: "500" }}>(optional)</Text></Text> : null}
          {mode === "signUp" ? <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Mobile number" placeholderTextColor={colors.muted} style={[uiStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]} /> : null}
          <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Password</Text>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 6 characters" placeholderTextColor={colors.muted} style={[uiStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]} />
          {notice ? <Text style={[styles.notice, { color: colors.success, backgroundColor: `${colors.success}14` }]}>{notice}</Text> : null}
          <PrimaryButton label={mode === "signIn" ? "Continue to NeuroClass" : "Create NeuroClass account"} onPress={submit} loading={busy} />
          {mode === "signIn" ? <Pressable disabled={busy} onPress={() => void (async () => { try { await requestPasswordReset(email); setNotice("If this email belongs to a NeuroClass account, a secure password-reset link has been sent."); } catch (error) { Alert.alert("Password reset", error instanceof Error ? error.message : "Please try again."); } })()}><Text style={[styles.forgot, { color: colors.primary }]}>Forgot password?</Text></Pressable> : null}
        </Card>
        <Text style={[styles.footer, { color: colors.muted }]}>Sign in with the same Supabase account used across the NeuroClass ecosystem.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 22, paddingVertical: 36, gap: 22 },
  brandLockup: { alignItems: "center", gap: 4, marginBottom: 4 },
  logo: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  logoText: { color: "#FFFFFF", fontWeight: "900", fontSize: 28 },
  brand: { fontSize: 30, fontWeight: "900", letterSpacing: -0.6 },
  tagline: { fontSize: 15 },
  switcher: { flexDirection: "row", borderRadius: 13, padding: 3, backgroundColor: "rgba(101, 112, 133, 0.10)", marginBottom: 8 },
  switch: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  switchText: { fontSize: 14, fontWeight: "800" },
  roleRow: { flexDirection: "row", gap: 9, marginBottom: 4 },
  roleOption: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12 },
  roleOptionTitle: { fontSize: 15, fontWeight: "800" },
  roleOptionDetail: { fontSize: 12, marginTop: 2 },
  roleSafety: { fontSize: 11, lineHeight: 16, marginTop: -2 },
  notice: { borderRadius: 12, padding: 11, fontSize: 13, lineHeight: 18 },
  forgot: { fontSize: 13, textAlign: "center", fontWeight: "800", paddingTop: 2 },
  footer: { textAlign: "center", fontSize: 12, lineHeight: 18, paddingHorizontal: 16 },
});
