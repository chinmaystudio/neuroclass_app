import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Card, EmptyState, LoadingState, Pill, ScreenTitle } from "@/components/neuroclass-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatDateTime, getClassroomOverview, listClassrooms } from "@/lib/neuroclass-data";
import { useNeuroClassAuth } from "@/lib/neuroclass-auth";
import type { AttendanceRecord, Classroom } from "@/lib/neuroclass-types";
import { ScreenContainer } from "@/components/screen-container";

type ClassAttendance = { classroom: Classroom; records: AttendanceRecord[]; openSessions: number };

export default function AttendanceScreen() {
  const colors = useColors();
  const { user, role } = useNeuroClassAuth();
  const [items, setItems] = useState<ClassAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!user || !role) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const classrooms = await listClassrooms(user.id, role);
      const overview = await Promise.all(classrooms.map((classroom) => getClassroomOverview(classroom.id, user.id, role)));
      setItems(overview.map((item) => ({ classroom: item.classroom, records: item.attendance, openSessions: item.sessions.filter((session) => session.status === "open").length })));
    } catch (error) { Alert.alert("Could not load attendance", error instanceof Error ? error.message : "Please try again."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [role, user]);

  useEffect(() => { void load(); }, [load]);
  if (loading) return <LoadingState label="Loading attendance…" />;

  const totalPresent = items.flatMap((item) => item.records).filter((record) => record.status === "Present" || record.status === "Late").length;
  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />} showsVerticalScrollIndicator={false}>
        <ScreenTitle eyebrow="Class participation" title="Attendance" subtitle={role === "teacher" ? "Open teacher-authorized sessions from a classroom and monitor participation." : "View your verified attendance and open any live class session."} />
        <Card emphasized><View style={styles.summary}><View><Text style={styles.summaryEyebrow}>Recorded attendance</Text><Text style={styles.summaryValue}>{totalPresent}</Text><Text style={styles.summaryDetail}>{role === "teacher" ? "present records in your recent classroom data" : "verified classroom check-ins"}</Text></View><View style={styles.summaryIcon}><IconSymbol name="checkmark.circle.fill" size={34} color="#FFFFFF" /></View></View></Card>
        {items.length === 0 ? <EmptyState title="No attendance to display" detail="Join or create a classroom first. Attendance activity will synchronize here from the same NeuroClass database." /> : <View style={styles.list}>{items.map((item) => <AttendanceCard key={item.classroom.id} item={item} role={role ?? "student"} />)}</View>}
      </ScrollView>
    </ScreenContainer>
  );
}

function AttendanceCard({ item, role }: { item: ClassAttendance; role: "teacher" | "student" }) {
  const colors = useColors();
  const latest = item.records[0];
  return (
    <Pressable onPress={() => router.push({ pathname: "/classroom/[id]", params: { id: item.classroom.id } })} style={({ pressed }) => pressed ? { opacity: 0.75 } : undefined}>
      <Card>
        <View style={styles.cardTop}><View style={[styles.attendanceIcon, { backgroundColor: item.openSessions > 0 ? `${colors.success}18` : `${colors.primary}14` }]}><IconSymbol name="checkmark.circle.fill" size={23} color={item.openSessions > 0 ? colors.success : colors.primary} /></View><View style={styles.cardCopy}><Text numberOfLines={1} style={[styles.className, { color: colors.foreground }]}>{item.classroom.name}</Text><Text style={[styles.classSubject, { color: colors.muted }]}>{item.classroom.subject || "General studies"}</Text></View>{item.openSessions > 0 ? <Pill label="Live session" tone="success" /> : <Pill label={`${item.records.length} records`} tone="neutral" />}</View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.latestLabel, { color: colors.muted }]}>{latest ? `${latest.status || "Recorded"} · ${formatDateTime(latest.verified_at)}` : role === "teacher" ? "No attendance has been recorded yet." : "No verified attendance records yet."}</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: 20, paddingBottom: 32, gap: 14 },
  summary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryEyebrow: { color: "#E0E7FF", fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" },
  summaryValue: { color: "#FFFFFF", fontSize: 36, lineHeight: 42, fontWeight: "900", marginTop: 3 },
  summaryDetail: { color: "#EEF2FF", fontSize: 13, maxWidth: 225, lineHeight: 19 },
  summaryIcon: { width: 58, height: 58, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "rgba(255,255,255,0.17)" },
  list: { gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  attendanceIcon: { width: 45, height: 45, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  cardCopy: { flex: 1, minWidth: 0 },
  className: { fontSize: 16, fontWeight: "800" },
  classSubject: { fontSize: 13, marginTop: 2 },
  divider: { height: 1, marginVertical: 3 },
  latestLabel: { fontSize: 13, lineHeight: 18 },
});
