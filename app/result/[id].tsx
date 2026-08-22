import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Card, EmptyState, LoadingState, Pill } from "@/components/neuroclass-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { listStudentSubmissions } from "@/lib/neuroclass-data";
import { useNeuroClassAuth } from "@/lib/neuroclass-auth";
import type { AssessmentSubmission } from "@/lib/neuroclass-types";
import { ScreenContainer } from "@/components/screen-container";

export default function ResultDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useNeuroClassAuth();
  const colors = useColors();
  const [result, setResult] = useState<AssessmentSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void (async () => { if (!user) return; try { setResult((await listStudentSubmissions(user.id)).find((item) => item.id === id) ?? null); } finally { setLoading(false); } })(); }, [id, user]);
  if (loading) return <LoadingState label="Loading result…" />;
  if (!result) return <ScreenContainer className="px-5"><EmptyState title="Result unavailable" detail="This result is not available for your signed-in NeuroClass identity." /></ScreenContainer>;
  const violations = Array.isArray(result.proctoring_violations) ? result.proctoring_violations.length : 0;
  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={styles.scroll}><Pressable onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.surface, borderColor: colors.border }]}><IconSymbol name="arrow.left" size={20} color={colors.foreground} /></Pressable><Text style={[styles.eyebrow, { color: colors.primary }]}>SHARED ASSESSMENT RESULT</Text><Text style={[styles.title, { color: colors.foreground }]}>{result.grade || "Assessment result"}</Text><Card emphasized><Text style={styles.score}>{result.percentage === null ? "Pending" : `${Math.round(result.percentage)}%`}</Text><Text style={styles.scoreDetail}>{result.marks_obtained ?? "—"} of {result.total_marks ?? "—"} marks</Text></Card><Card><View style={styles.row}><Text style={[styles.label, { color: colors.muted }]}>Submitted</Text><Text style={[styles.value, { color: colors.foreground }]}>{new Date(result.submitted_at).toLocaleString()}</Text></View><View style={styles.row}><Text style={[styles.label, { color: colors.muted }]}>Proctoring status</Text><Pill label={violations ? `${violations} review event${violations === 1 ? "" : "s"}` : "No server events"} tone={violations ? "warning" : "success"} /></View>{result.feedback ? <View style={[styles.feedback, { borderColor: colors.border }]}><Text style={[styles.label, { color: colors.muted }]}>Instructor feedback</Text><Text style={[styles.feedbackText, { color: colors.foreground }]}>{result.feedback}</Text></View> : null}</Card></ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ scroll: { paddingVertical: 18, paddingBottom: 32, gap: 14 }, back: { width: 42, height: 42, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" }, eyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 0.85 }, title: { fontSize: 28, lineHeight: 34, fontWeight: "900" }, score: { color: "#FFFFFF", fontSize: 42, fontWeight: "900", textAlign: "center" }, scoreDetail: { color: "#E0E7FF", fontSize: 14, fontWeight: "700", textAlign: "center" }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 14 }, label: { fontSize: 12, fontWeight: "800" }, value: { fontSize: 13, fontWeight: "700", textAlign: "right", flex: 1 }, feedback: { gap: 6, borderTopWidth: 1, paddingTop: 12 }, feedbackText: { fontSize: 14, lineHeight: 21 } });

