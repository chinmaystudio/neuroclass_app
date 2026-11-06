import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";

import { Card, EmptyState, LoadingState, OutlineButton, Pill, PrimaryButton } from "@/components/neuroclass-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatDateTime, getClassroomOverview } from "@/lib/neuroclass-data";
import { newIdempotencyKey, neuroClassApi } from "@/lib/neuroclass-api";
import { useNeuroClassAuth } from "@/lib/neuroclass-auth";
import type { AttendanceSession, ClassroomOverview } from "@/lib/neuroclass-types";
import { ScreenContainer } from "@/components/screen-container";
import { ClassroomResources } from "@/components/classroom-resources";
import { supabase } from "@/lib/supabase";

type SecureSessionResponse = { session: AttendanceSession; pin: string; warning?: string };
type ActiveSessionResponse = { session: AttendanceSession | null };

export default function ClassroomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { user, role } = useNeuroClassAuth();
  const [overview, setOverview] = useState<ClassroomOverview | null>(null);
  const [activeStudentSession, setActiveStudentSession] = useState<AttendanceSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!id || !user || !role) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const nextOverview = await getClassroomOverview(id, user.id, role);
      setOverview(nextOverview);
      if (role === "student") {
        try {
          const active = await neuroClassApi<ActiveSessionResponse>(`/api/attendance/active?classroomId=${encodeURIComponent(id)}`);
          setActiveStudentSession(active.session);
        } catch {
          setActiveStudentSession(null);
        }
      }
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load this classroom.");
    } finally { setLoading(false); setRefreshing(false); }
  }, [id, role, user]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`neuroclass-mobile-classroom-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tests", filter: `classroom_id=eq.${id}` }, () => void load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_sessions", filter: `classroom_id=eq.${id}` }, () => void load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance", filter: `classroom_id=eq.${id}` }, () => void load(true))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id, load]);

  const teacherOpenSession = useMemo(() => overview?.sessions.find((session) => session.status === "open") ?? null, [overview?.sessions]);
  const openSession = async () => {
    if (!overview) return;
    setBusy(true);
    try {
      const payload = await neuroClassApi<SecureSessionResponse>("/api/attendance/session", {
        method: "POST",
        body: { classroomId: overview.classroom.id, title: `${overview.classroom.name} attendance`, durationMinutes: 90 },
      });
      Alert.alert("Attendance session ready", `Share this six-digit PIN only with students who are present:\n\n${payload.pin}\n\nThe session remains open for up to 90 minutes.`);
      await load(true);
    } catch (error) { Alert.alert("Could not open attendance", error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  };

  const closeSession = async () => {
    if (!teacherOpenSession) return;
    setBusy(true);
    try {
      const payload = await neuroClassApi<{ report?: { presentCount: number; rosterCount: number } }>("/api/attendance/session", { method: "PATCH", body: { sessionId: teacherOpenSession.id } });
      const report = payload.report;
      Alert.alert("Attendance session closed", report ? `${report.presentCount} of ${report.rosterCount} students were recorded.` : "The secure session has been closed.");
      await load(true);
    } catch (error) { Alert.alert("Could not close attendance", error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  };

  const verifyAttendance = async () => {
    if (!activeStudentSession || !pin.trim()) return;
    setBusy(true);
    try {
      await neuroClassApi("/api/attendance/verify", { method: "POST", idempotencyKey: newIdempotencyKey(), body: { sessionId: activeStudentSession.id, pin: pin.trim() } });
      setPin("");
      setNotice("Attendance verified for this live classroom session.");
      await load(true);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Attendance verification failed."); }
    finally { setBusy(false); }
  };

  const openTestDesigner = async () => {
    if (!overview) return;
    setBusy(true);
    try {
      const result = await neuroClassApi<{ handoffToken: string }>("/api/test-portal/handoff", { method: "POST", body: { classroomId: overview.classroom.id } });
      const portal = `https://test-creation-qwlp.onrender.com/api/auth/handoff?token=${encodeURIComponent(result.handoffToken)}&redirect=${encodeURIComponent(`/classroom/${overview.classroom.id}`)}`;
      await WebBrowser.openBrowserAsync(portal);
    } catch (error) { Alert.alert("Could not open the test designer", error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  };

  if (loading) return <LoadingState label="Opening classroom…" />;
  if (!overview) return <ScreenContainer className="px-5"><EmptyState title="Classroom unavailable" detail={notice || "This classroom could not be opened."} action={<PrimaryButton label="Go back" onPress={() => router.back()} />} /></ScreenContainer>;

  const visibleAssessments = role === "student" ? overview.assessments.filter((assessment) => assessment.status === "live" || assessment.status === "published") : overview.assessments;
  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />} showsVerticalScrollIndicator={false}>
        <View style={styles.topNav}><Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.surface, borderColor: colors.border }]}><IconSymbol name="arrow.left" size={20} color={colors.foreground} /></Pressable><Pill label={role === "teacher" ? "Teacher view" : "Student view"} tone="primary" /></View>
        <Text style={[styles.className, { color: colors.foreground }]}>{overview.classroom.name}</Text>
        <Text style={[styles.subject, { color: colors.muted }]}>{overview.classroom.subject || "General studies"} · Class code <Text style={{ color: colors.primary, fontWeight: "800" }}>{overview.classroom.code}</Text></Text>

        {role === "teacher" ? <TeacherAttendanceCard activeSession={teacherOpenSession} onOpen={() => void openSession()} onClose={() => void closeSession()} onScan={() => router.push(`/attendance-scan/${overview.classroom.id}` as never)} busy={busy} /> : <StudentAttendanceCard activeSession={activeStudentSession} pin={pin} setPin={setPin} onVerify={() => void verifyAttendance()} busy={busy} notice={notice} />}

        <SectionHeading title={role === "teacher" ? "Assessments" : "Your assessments"} action={<OutlineButton label={role === "teacher" ? "Manage tests" : "All tests"} onPress={() => router.push({ pathname: "/tests/[classroomId]", params: { classroomId: overview.classroom.id } } as never)} />} />
        {visibleAssessments.length === 0 ? <EmptyState title="No assessments yet" detail={role === "teacher" ? "Create a test natively in Manage tests — full question editor and AI generation included — or open the web test designer below." : "Your instructor has not published an assessment for this class yet."} /> : <View style={styles.stack}>{visibleAssessments.map((assessment) => <Pressable key={assessment.id} onPress={() => router.push({ pathname: "/assessment/[id]", params: { id: assessment.id } })} style={({ pressed }) => pressed ? { opacity: 0.76 } : undefined}><Card><View style={styles.itemRow}><View style={[styles.itemIcon, { backgroundColor: `${colors.primary}14` }]}><IconSymbol name="doc.text.fill" size={20} color={colors.primary} /></View><View style={styles.itemCopy}><Text style={[styles.itemTitle, { color: colors.foreground }]}>{assessment.title}</Text><Text style={[styles.itemDetail, { color: colors.muted }]}>{assessment.duration_mins ?? 45} min · {assessment.total_marks ?? 0} marks</Text></View><Pill label={assessment.status} tone={assessment.status === "live" ? "success" : "primary"} /></View></Card></Pressable>)}</View>}
        {role === "teacher" ? <OutlineButton label="Open web test designer" onPress={() => void openTestDesigner()} disabled={busy} /> : null}

        {role === "teacher" ? <><SectionHeading title={`Roster · ${overview.roster.length}`} /><Card>{overview.roster.length === 0 ? <Text style={[styles.emptyText, { color: colors.muted }]}>Share the classroom code to let students join from the NeuroClass app.</Text> : <View style={styles.stack}>{overview.roster.slice(0, 12).map((student) => <View key={student.id} style={styles.rosterRow}><View style={[styles.studentAvatar, { backgroundColor: `${colors.primary}14` }]}><Text style={[styles.studentInitial, { color: colors.primary }]}>{student.name.slice(0, 1).toUpperCase()}</Text></View><View style={styles.itemCopy}><Text style={[styles.itemTitle, { color: colors.foreground }]}>{student.name}</Text><Text style={[styles.itemDetail, { color: colors.muted }]}>{student.email || "No email"}{student.roll_number ? ` · ${student.roll_number}` : ""}</Text></View><Pill label={student.face_registration_status === "REGISTERED" ? "Ready" : "Pending"} tone={student.face_registration_status === "REGISTERED" ? "success" : "warning"} /></View>)}</View>}</Card></> : <><SectionHeading title="Recent attendance" /><Card>{overview.attendance.length === 0 ? <Text style={[styles.emptyText, { color: colors.muted }]}>Your verified attendance for this classroom will appear here.</Text> : <View style={styles.stack}>{overview.attendance.slice(0, 8).map((record) => <View key={record.id} style={styles.attendanceRow}><View><Text style={[styles.itemTitle, { color: colors.foreground }]}>{record.status || "Recorded"}</Text><Text style={[styles.itemDetail, { color: colors.muted }]}>{formatDateTime(record.verified_at)}</Text></View><Pill label={record.verified_method?.includes("PIN") ? "PIN verified" : "Recorded"} tone="success" /></View>)}</View>}</Card>{overview.studentRecord?.face_registration_status !== "REGISTERED" ? <PrimaryButton label="Register face securely" onPress={() => router.push(`/face-registration/${overview.classroom.id}` as never)} /> : null}</>}
        <SectionHeading title="Assignments" action={<OutlineButton label="Open assignments" onPress={() => router.push({ pathname: "/assignments/[classroomId]", params: { classroomId: overview.classroom.id } } as never)} />} />
        <Card><Text style={[styles.emptyText, { color: colors.muted }]}>Assignments are shared with the NeuroClass web app — teachers and students see the same assignments, submissions and grades from the same database.</Text></Card>
        <ClassroomResources classroomId={overview.classroom.id} role={role === "teacher" ? "teacher" : "student"} />
        <SectionHeading title="AI tutor" action={<OutlineButton label="Open tutor chat" onPress={() => router.push({ pathname: "/tutor/[classroomId]", params: { classroomId: overview.classroom.id } } as never)} />} />
        <Card><Text style={[styles.emptyText, { color: colors.muted }]}>Ask questions grounded in this classroom's materials. The tutor answers from the same shared knowledge base as the web app, with sources and confidence shown on every answer.</Text></Card>
      </ScrollView>
    </ScreenContainer>
  );
}

function SectionHeading({ title, action }: { title: string; action?: React.ReactNode }) {
  const colors = useColors();
  return <View style={styles.sectionHeading}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>{action}</View>;
}

function TeacherAttendanceCard({ activeSession, onOpen, onClose, onScan, busy }: { activeSession: AttendanceSession | null; onOpen: () => void; onClose: () => void; onScan: () => void; busy: boolean }) {
  return <Card emphasized><View style={styles.attendanceHeader}><View><Text style={styles.attendanceKicker}>Teacher attendance</Text><Text style={styles.attendanceTitle}>{activeSession ? "Live session is open" : "Ready to take attendance"}</Text><Text style={styles.attendanceDetail}>{activeSession ? `Started ${formatDateTime(activeSession.starts_at)}. Use an optional camera frame for server-authoritative review.` : "Open a PIN-protected session for students who are present."}</Text></View><IconSymbol name="checkmark.circle.fill" size={34} color="#FFFFFF" /></View>{activeSession ? <View style={styles.stack}><PrimaryButton label="Capture attendance frame" tone="secondary" onPress={onScan} disabled={busy} /><OutlineButton label="Close attendance session" onPress={onClose} disabled={busy} /></View> : <PrimaryButton label="Open attendance session" tone="secondary" onPress={onOpen} loading={busy} />}</Card>;
}

function StudentAttendanceCard({ activeSession, pin, setPin, onVerify, busy, notice }: { activeSession: AttendanceSession | null; pin: string; setPin: (value: string) => void; onVerify: () => void; busy: boolean; notice: string | null }) {
  const colors = useColors();
  if (!activeSession) return <Card><View style={styles.noSession}><IconSymbol name="clock.fill" size={22} color={colors.muted} /><View style={styles.itemCopy}><Text style={[styles.itemTitle, { color: colors.foreground }]}>No live attendance session</Text><Text style={[styles.itemDetail, { color: colors.muted }]}>Your instructor can open a session for this classroom when attendance is available.</Text></View></View>{notice ? <Text style={[styles.notice, { color: colors.error }]}>{notice}</Text> : null}</Card>;
  return <Card emphasized><Text style={styles.attendanceKicker}>Live attendance</Text><Text style={styles.attendanceTitle}>{activeSession.title}</Text><Text style={styles.attendanceDetail}>Enter the six-digit PIN shown by your instructor. This verifies your attendance securely.</Text><TextInput value={pin} onChangeText={(value) => setPin(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" placeholder="000000" placeholderTextColor="#C7D2FE" style={styles.pinInput} maxLength={6} /><PrimaryButton label="Verify attendance" tone="secondary" onPress={onVerify} loading={busy} disabled={pin.length !== 6} />{notice ? <Text style={styles.whiteNotice}>{notice}</Text> : null}</Card>;
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: 18, paddingBottom: 32, gap: 14 },
  topNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  className: { fontSize: 28, fontWeight: "900", letterSpacing: -0.6, marginTop: 2 },
  subject: { fontSize: 14, lineHeight: 20, marginTop: -8 },
  attendanceHeader: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  attendanceKicker: { color: "#E0E7FF", fontSize: 11, fontWeight: "900", letterSpacing: 0.75, textTransform: "uppercase" },
  attendanceTitle: { color: "#FFFFFF", fontSize: 21, lineHeight: 27, fontWeight: "900", marginTop: 4 },
  attendanceDetail: { color: "#EEF2FF", fontSize: 13, lineHeight: 19, maxWidth: 270, marginTop: 5 },
  pinInput: { height: 51, backgroundColor: "rgba(255,255,255,0.14)", color: "#FFFFFF", borderColor: "rgba(255,255,255,0.25)", borderWidth: 1, borderRadius: 14, textAlign: "center", fontSize: 24, fontWeight: "900", letterSpacing: 7, paddingHorizontal: 10 },
  whiteNotice: { color: "#FFFFFF", fontSize: 12, lineHeight: 18 },
  notice: { fontSize: 12, lineHeight: 18 },
  noSession: { flexDirection: "row", gap: 12, alignItems: "center" },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 3 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  stack: { gap: 10 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  itemIcon: { width: 42, height: 42, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  itemCopy: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: 15, fontWeight: "800" },
  itemDetail: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  emptyText: { fontSize: 13, lineHeight: 20 },
  rosterRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  studentAvatar: { width: 37, height: 37, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  studentInitial: { fontSize: 15, fontWeight: "900" },
  attendanceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
});
