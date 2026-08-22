import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";

type ButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone?: "primary" | "secondary" | "danger";
};

export function PrimaryButton({ label, onPress, loading, disabled, tone = "primary" }: ButtonProps) {
  const colors = useColors();
  const background = tone === "danger" ? colors.error : tone === "secondary" ? colors.surface : colors.primary;
  const text = tone === "secondary" ? colors.foreground : "#FFFFFF";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, borderColor: tone === "secondary" ? colors.border : background },
        pressed && !disabled && !loading ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      {loading ? <ActivityIndicator color={text} /> : <Text style={[styles.buttonLabel, { color: text }]}>{label}</Text>}
    </Pressable>
  );
}

export function OutlineButton({ label, onPress, disabled }: Pick<ButtonProps, "label" | "onPress" | "disabled">) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.outlineButton,
        { borderColor: colors.border, backgroundColor: colors.surface },
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      <Text style={[styles.outlineLabel, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, emphasized = false }: { children: ReactNode; emphasized?: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: emphasized ? colors.primary : colors.surface, borderColor: emphasized ? colors.primary : colors.border }]}>
      {children}
    </View>
  );
}

export function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" | "danger" | "primary" }) {
  const colors = useColors();
  const palette = {
    neutral: { background: colors.surface, text: colors.muted, border: colors.border },
    success: { background: `${colors.success}20`, text: colors.success, border: `${colors.success}44` },
    warning: { background: `${colors.warning}20`, text: colors.warning, border: `${colors.warning}44` },
    danger: { background: `${colors.error}18`, text: colors.error, border: `${colors.error}44` },
    primary: { background: `${colors.primary}18`, text: colors.primary, border: `${colors.primary}44` },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <Text numberOfLines={1} style={[styles.pillLabel, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

export function ScreenTitle({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.screenTitle}>
      <View style={styles.titleCopy}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text> : null}
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
      </View>
      {action ? <View>{action}</View> : null}
    </View>
  );
}

export function LoadingState({ label = "Loading your NeuroClass workspace…" }: { label?: string }) {
  const colors = useColors();
  return (
    <View style={styles.loadingState}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={[styles.loadingLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.emptyState, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.emptyDetail, { color: colors.muted }]}>{detail}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  fieldLabel: { fontSize: 13, fontWeight: "700", marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 14, minHeight: 50, paddingHorizontal: 14, fontSize: 16 },
  sectionLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  smallText: { fontSize: 13, lineHeight: 19 },
});

const styles = StyleSheet.create({
  button: { minHeight: 50, paddingHorizontal: 18, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  buttonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  buttonDisabled: { opacity: 0.48 },
  buttonLabel: { fontSize: 15, fontWeight: "800" },
  outlineButton: { minHeight: 46, paddingHorizontal: 14, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  outlineLabel: { fontSize: 14, fontWeight: "700" },
  card: { padding: 16, borderRadius: 20, borderWidth: 1, gap: 10, shadowColor: "#152043", shadowOpacity: 0.04, shadowOffset: { width: 0, height: 7 }, shadowRadius: 14, elevation: 1 },
  pill: { alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  pillLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },
  screenTitle: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 },
  titleCopy: { flex: 1 },
  eyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 5 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "800", letterSpacing: -0.6 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  loadingLabel: { fontSize: 14, textAlign: "center" },
  emptyState: { padding: 24, borderRadius: 20, borderWidth: 1, alignItems: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  emptyDetail: { fontSize: 14, textAlign: "center", lineHeight: 21, marginTop: 7 },
  emptyAction: { alignSelf: "stretch", marginTop: 18 },
});
