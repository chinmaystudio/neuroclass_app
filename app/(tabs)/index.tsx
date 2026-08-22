import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Card, EmptyState, LoadingState, Pill, PrimaryButton, ScreenTitle } from "@/components/neuroclass-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatDate, listClassrooms } from "@/lib/neuroclass-data";
import { useNeuroClassAuth } from "@/lib/neuroclass-auth";
import type { Assessment, Classroom } from "@/lib/neuroclass-types";
import { supabase } from "@/lib/supabase";
import { ScreenContainer } from "@/components/screen-container";

export default function HomeScreen() {
  const colors = useColors();
  const { user, profile, role } = useNeuroClassAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!user || !role) {
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const nextClassrooms = await listClassrooms(user.id, role);
      setClassrooms(nextClassrooms);
      const ids = nextClassrooms.map((item) => item.id);
      if (ids.length === 0) {
        setAssessments([]);
      } else {
        const { data, error: testsError } = await supabase.from("tests").select("*").in("classroom_id", ids).order("created_at", { ascending: false }).limit(8);
        if (testsError) throw testsError;
        const visible = role === "student" ? (data ?? []).filter((test) => test.status === "live" || test.status === "published") : data ?? [];
        setAssessments(visible as Assessment[]);
      }
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load your classroom activity.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, user]);

  useEffect(() => { void load(); }, [load]);

  const greeting = useMemo(() => {
    const name = profile?.displayName?.split(" ")[0];
    return name ? `Hello, ${name}` : "Hello";
  }, [profile?.displayName]);

  if (loading) return <LoadingState />;

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle eyebrow={role === "teacher" ? "Instructor workspace" : "Student workspace"} title={greeting} subtitle={role === "teacher" ? "Your classes, assessments, and attendance sessions." : "Stay current with your classes and assessments."} />

        <Card emphasized>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>{role === "teacher" ? "NeuroClass teaching hub" : "NeuroClass learning hub"}</Text>
              <Text style={styles.heroTitle}>{classrooms.length} {classrooms.length === 1 ? "class" : "classes"} in your workspace</Text>
              <Text style={styles.heroDetail}>{role === "teacher" ? "Open a class to manage your roster or start an attendance session." : "Open a class to review attendance and continue learning."}</Text>
            </View>
            <View style={styles.heroMark}><Text style={styles.heroMarkText}>N</Text></View>
          </View>
          <PrimaryButton label={role === "teacher" ? "Manage classes" : "View my classes"} onPress={() => router.push("/(tabs)/classes")} tone="secondary" />
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent classes</Text>
          <Pressable onPress={() => router.push("/(tabs)/classes")} style={({ pressed }) => pressed ? { opacity: 0.65 } : undefined}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
          </Pressable>
        </View>
        {classrooms.length === 0 ? (
          <EmptyState
            title={role === "teacher" ? "Create your first classroom" : "Join your first classroom"}
            detail={role === "teacher" ? "Set up a class, share its code, and manage the same shared NeuroClass records from mobile." : "Ask your instructor for a classroom code to connect your account."}
            action={<PrimaryButton label={role === "teacher" ? "Create a classroom" : "Join a classroom"} onPress={() => router.push("/(tabs)/classes")} />}
          />
        ) : (
          <View style={styles.stack}>
            {classrooms.slice(0, 3).map((classroom) => <ClassroomRow key={classroom.id} classroom={classroom} />)}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{role === "teacher" ? "Assessment activity" : "Available assessments"}</Text>
        </View>
        {assessments.length === 0 ? (
          <Card><Text style={[styles.mutedDetail, { color: colors.muted }]}>{role === "teacher" ? "Assessments you create in the connected test portal will appear here." : "New assessments will appear here when your instructor publishes them."}</Text></Card>
        ) : (
          <View style={styles.stack}>
            {assessments.slice(0, 3).map((assessment) => <AssessmentRow key={assessment.id} assessment={assessment} />)}
          </View>
        )}
        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function ClassroomRow({ classroom }: { classroom: Classroom }) {
  const colors = useColors();
  return (
    <Pressable onPress={() => router.push({ pathname: "/classroom/[id]", params: { id: classroom.id } })} style={({ pressed }) => [pressed ? styles.rowPressed : null]}>
      <Card>
        <View style={styles.rowTop}>
          <View style={[styles.classIcon, { backgroundColor: `${colors.primary}14` }]}><IconSymbol name="book.closed.fill" size={21} color={colors.primary} /></View>
          <View style={styles.flex}><Text numberOfLines={1} style={[styles.rowTitle, { color: colors.foreground }]}>{classroom.name}</Text><Text numberOfLines={1} style={[styles.rowDetail, { color: colors.muted }]}>{classroom.subject || "General studies"}</Text></View>
          <IconSymbol name="chevron.right" size={22} color={colors.muted} />
        </View>
        <View style={styles.metaRow}><Pill label={`Code ${classroom.code}`} tone="primary" /><Text style={[styles.metaText, { color: colors.muted }]}>{classroom.students ?? 0} enrolled</Text></View>
      </Card>
    </Pressable>
  );
}

function AssessmentRow({ assessment }: { assessment: Assessment }) {
  const colors = useColors();
  const live = assessment.status === "live";
  return (
    <Pressable onPress={() => router.push({ pathname: "/assessment/[id]", params: { id: assessment.id } })} style={({ pressed }) => [pressed ? styles.rowPressed : null]}>
      <Card>
        <View style={styles.rowTop}>
          <View style={[styles.classIcon, { backgroundColor: live ? `${colors.success}16` : `${colors.primary}14` }]}><IconSymbol name="doc.text.fill" size={21} color={live ? colors.success : colors.primary} /></View>
          <View style={styles.flex}><Text numberOfLines={1} style={[styles.rowTitle, { color: colors.foreground }]}>{assessment.title}</Text><Text numberOfLines={1} style={[styles.rowDetail, { color: colors.muted }]}>{assessment.subject || "Assessment"} · {assessment.duration_mins ?? 45} min</Text></View>
          <Pill label={assessment.status} tone={live ? "success" : "primary"} />
        </View>
        <Text style={[styles.assessmentSchedule, { color: colors.muted }]}>{assessment.scheduled_start ? `Starts ${formatDate(assessment.scheduled_start)}` : "Schedule set by instructor"}</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: 20, paddingBottom: 32, gap: 14 },
  heroTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  heroCopy: { flex: 1 },
  heroKicker: { color: "#E0E7FF", fontSize: 11, fontWeight: "800", letterSpacing: 0.7, textTransform: "uppercase" },
  heroTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", lineHeight: 28, marginTop: 5 },
  heroDetail: { color: "#EEF2FF", fontSize: 13, lineHeight: 19, marginTop: 7 },
  heroMark: { width: 54, height: 54, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  heroMarkText: { color: "#FFFFFF", fontSize: 27, fontWeight: "900" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 9 },
  sectionTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.2 },
  seeAll: { fontSize: 13, fontWeight: "800" },
  stack: { gap: 10 },
  rowPressed: { opacity: 0.78 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  classIcon: { width: 42, height: 42, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  flex: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: "800" },
  rowDetail: { fontSize: 13, marginTop: 3 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 3 },
  metaText: { fontSize: 12, fontWeight: "600" },
  assessmentSchedule: { fontSize: 12, marginLeft: 54, marginTop: -2 },
  mutedDetail: { fontSize: 14, lineHeight: 21 },
  error: { fontSize: 13, lineHeight: 19, textAlign: "center", paddingHorizontal: 10 },
});
