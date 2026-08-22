import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Card, EmptyState, LoadingState, Pill, ScreenTitle } from "@/components/neuroclass-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { getStudentPerformance, listClassrooms } from "@/lib/neuroclass-data";
import { useNeuroClassAuth } from "@/lib/neuroclass-auth";
import type { Classroom, StudentPerformance } from "@/lib/neuroclass-types";
import { ScreenContainer } from "@/components/screen-container";

export default function WorkspaceScreen() {
  const colors = useColors();
  const { user, role } = useNeuroClassAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [performance, setPerformance] = useState<StudentPerformance | null>(null);
  const [classes, setClasses] = useState<Classroom[]>([]);

  const load = useCallback(async (refresh = false) => {
    if (!user || !role) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      if (role === "student") setPerformance(await getStudentPerformance(user.id));
      else setClasses(await listClassrooms(user.id, "teacher"));
      setNotice(null);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Workspace data could not be loaded."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [role, user]);

  useEffect(() => { void load(); }, [load]);
  if (loading) return <LoadingState label="Loading your learning workspace…" />;

  if (role === "teacher") return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}><ScreenTitle eyebrow="Teacher command center" title="Insights" subtitle="Open a classroom to review its shared learning signals, attendance, test designer, materials, and roster." />{notice ? <Card><Text style={[styles.notice, { color: colors.error }]}>{notice}</Text></Card> : null}{classes.length === 0 ? <EmptyState title="No classrooms yet" detail="Create a classroom from the Classes tab to begin managing attendance, materials, assessments, and learning signals." /> : <View style={styles.stack}>{classes.map((item) => <Pressable key={item.id} onPress={() => router.push({ pathname: "/classroom/[id]", params: { id: item.id } })} style={({ pressed }) => pressed ? { opacity: 0.72 } : undefined}><Card><View style={styles.row}><View style={[styles.icon, { backgroundColor: `${colors.primary}14` }]}><IconSymbol name="chart.bar.fill" size={22} color={colors.primary} /></View><View style={styles.copy}><Text style={[styles.itemTitle, { color: colors.foreground }]}>{item.name}</Text><Text style={[styles.itemMeta, { color: colors.muted }]}>{item.subject || "General studies"} · classroom command center</Text></View><IconSymbol name="chevron.right" size={20} color={colors.muted} /></View></Card></Pressable>)}</View>}</ScrollView></ScreenContainer>;

  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}><ScreenTitle eyebrow="Personal learning command center" title="Progress" subtitle="Results and performance are read from the same shared NeuroClass academic records." />{notice ? <Card><Text style={[styles.notice, { color: colors.error }]}>{notice}</Text></Card> : null}<View style={styles.metricGrid}><Metric label="Attempts" value={String(performance?.totalAttempts ?? 0)} /><Metric label="Average" value={performance?.averagePercentage === null || performance?.averagePercentage === undefined ? "—" : `${performance.averagePercentage}%`} /><Metric label="Best" value={performance?.highestPercentage === null || performance?.highestPercentage === undefined ? "—" : `${performance.highestPercentage}%`} /></View><Text style={[styles.section, { color: colors.foreground }]}>Assessment results</Text>{performance?.completedSubmissions.length ? <View style={styles.stack}>{performance.completedSubmissions.map((submission) => <Pressable key={submission.id} onPress={() => router.push(`/result/${submission.id}` as never)} style={({ pressed }) => pressed ? { opacity: 0.72 } : undefined}><Card><View style={styles.row}><View style={[styles.icon, { backgroundColor: `${colors.success}16` }]}><IconSymbol name="checkmark.circle.fill" size={22} color={colors.success} /></View><View style={styles.copy}><Text style={[styles.itemTitle, { color: colors.foreground }]}>{submission.grade || "Submitted assessment"}</Text><Text style={[styles.itemMeta, { color: colors.muted }]}>{new Date(submission.submitted_at).toLocaleDateString()} · {submission.marks_obtained ?? "—"}/{submission.total_marks ?? "—"} marks</Text></View><Pill label={submission.percentage === null ? "Pending" : `${Math.round(submission.percentage)}%`} tone={submission.percentage === null ? "warning" : "success"} /></View></Card></Pressable>)}</View> : <EmptyState title="No results published" detail="Submitted assessments and instructor-reviewed results will appear here when available." />}</ScrollView></ScreenContainer>;
}

function Metric({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return <Card><Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text><Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text></Card>;
}

const styles = StyleSheet.create({ scroll: { paddingVertical: 20, paddingBottom: 32, gap: 13 }, stack: { gap: 10 }, metricGrid: { flexDirection: "row", gap: 9 }, metricValue: { fontSize: 22, fontWeight: "900" }, metricLabel: { fontSize: 11, fontWeight: "700", marginTop: 4 }, section: { fontSize: 18, fontWeight: "900", marginTop: 4 }, row: { flexDirection: "row", gap: 11, alignItems: "center" }, icon: { width: 43, height: 43, borderRadius: 14, alignItems: "center", justifyContent: "center" }, copy: { flex: 1, minWidth: 0 }, itemTitle: { fontSize: 15, fontWeight: "800" }, itemMeta: { fontSize: 12, lineHeight: 18, marginTop: 2 }, notice: { fontSize: 13, lineHeight: 20, fontWeight: "700" } });
