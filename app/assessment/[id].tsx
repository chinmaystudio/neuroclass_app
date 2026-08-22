import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Card, EmptyState, LoadingState, Pill, PrimaryButton } from "@/components/neuroclass-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatDateTime, getAssessment, getStudentRecord, normalizeQuestions } from "@/lib/neuroclass-data";
import { useNeuroClassAuth } from "@/lib/neuroclass-auth";
import type { Assessment, StudentRecord } from "@/lib/neuroclass-types";
import { ScreenContainer } from "@/components/screen-container";

export default function AssessmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { user, role } = useNeuroClassAuth();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      const next = await getAssessment(id);
      setAssessment(next);
      if (role === "student" && next.classroom_id) setStudent(await getStudentRecord(user.id, next.classroom_id));
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Could not load this assessment."); }
    finally { setLoading(false); }
  }, [id, role, user]);
  useEffect(() => { void load(); }, [load]);

  const questions = useMemo(() => normalizeQuestions(assessment?.questions), [assessment?.questions]);
  if (loading) return <LoadingState label="Loading assessment…" />;
  if (!assessment) return <ScreenContainer className="px-5"><EmptyState title="Assessment unavailable" detail={error || "This assessment could not be loaded."} action={<PrimaryButton label="Go back" onPress={() => router.back()} />} /></ScreenContainer>;
  const isAvailable = assessment.status === "live" || assessment.status === "published";
  const start = () => {
    if (!student) { Alert.alert("Enrollment required", "You need to be enrolled in this classroom before starting this assessment."); return; }
    router.push({ pathname: "/test/[id]", params: { id: assessment.id } });
  };
  return (
    <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.surface, borderColor: colors.border }]}><IconSymbol name="arrow.left" size={20} color={colors.foreground} /></Pressable>
      <View style={[styles.icon, { backgroundColor: `${colors.primary}14` }]}><IconSymbol name="doc.text.fill" size={30} color={colors.primary} /></View>
      <Pill label={assessment.status} tone={assessment.status === "live" ? "success" : "primary"} />
      <Text style={[styles.title, { color: colors.foreground }]}>{assessment.title}</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>{assessment.subject || "Assessment"}</Text>
      <Card><View style={styles.statRow}><Stat icon="clock.fill" label="Duration" value={`${assessment.duration_mins ?? 45} min`} /><Stat icon="doc.text.fill" label="Questions" value={`${questions.length || "—"}`} /><Stat icon="sparkles" label="Marks" value={`${assessment.total_marks ?? 0}`} /></View></Card>
      <Card><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Assessment information</Text><Text style={[styles.detail, { color: colors.muted }]}>{assessment.scheduled_start ? `Scheduled from ${formatDateTime(assessment.scheduled_start)}.` : "Your instructor controls the availability of this assessment."}</Text>{assessment.proctoring_enabled ? <Text style={[styles.proctoring, { color: colors.warning }]}>Integrity monitoring is enabled. Follow all instructions from your instructor.</Text> : null}</Card>
      {role === "student" ? <>{!isAvailable ? <Card><Text style={[styles.detail, { color: colors.muted }]}>This assessment is not currently available. It will unlock when your instructor publishes or starts it.</Text></Card> : questions.length === 0 ? <Card><Text style={[styles.detail, { color: colors.muted }]}>The assessment record is synchronized, but its question set is managed in the connected test portal. Check with your instructor if this should be available now.</Text></Card> : <PrimaryButton label="Start assessment" onPress={start} />}</> : <Card><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Teacher view</Text><Text style={[styles.detail, { color: colors.muted }]}>Assessment authoring, publication, and advanced proctoring are managed in the secure connected test portal. This mobile view keeps the shared classroom status visible.</Text></Card>}
    </ScrollView></ScreenContainer>
  );
}

function Stat({ icon, label, value }: { icon: "clock.fill" | "doc.text.fill" | "sparkles"; label: string; value: string }) {
  const colors = useColors();
  return <View style={styles.stat}><IconSymbol name={icon} size={18} color={colors.primary} /><Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text><Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: 18, paddingBottom: 32, gap: 14 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  icon: { width: 64, height: 64, borderRadius: 21, alignItems: "center", justifyContent: "center", marginTop: 5 },
  title: { fontSize: 30, lineHeight: 36, letterSpacing: -0.7, fontWeight: "900" },
  subtitle: { fontSize: 15, marginTop: -9 },
  statRow: { flexDirection: "row", justifyContent: "space-around" },
  stat: { alignItems: "center", flex: 1, gap: 3 },
  statValue: { fontSize: 16, fontWeight: "900", marginTop: 2 },
  statLabel: { fontSize: 11, fontWeight: "700" },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  detail: { fontSize: 14, lineHeight: 21 },
  proctoring: { fontSize: 13, lineHeight: 19, fontWeight: "700" },
});

