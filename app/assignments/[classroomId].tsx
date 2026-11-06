import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Card, EmptyState, LoadingState, Pill, PrimaryButton, ScreenTitle } from "@/components/neuroclass-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useNeuroClassAuth } from "@/lib/neuroclass-auth";
import { listAssignments } from "@/lib/neuroclass-assignments";
import { formatDateTime } from "@/lib/neuroclass-data";
import type { Assignment } from "@/lib/neuroclass-types";

export default function AssignmentsScreen() {
  const { classroomId } = useLocalSearchParams<{ classroomId: string }>();
  const colors = useColors();
  const { role } = useNeuroClassAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const load = useCallback(
    async (refresh = false) => {
      if (!classroomId) return;
      if (refresh) setRefreshing(true);
      else setLoading(true);
      try {
        setAssignments(await listAssignments(classroomId));
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Assignments could not be loaded.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [classroomId],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState label="Loading assignments…" />;

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
        </Pressable>
        <ScreenTitle
          eyebrow="Same assignments as the web app"
          title="Assignments"
          subtitle={
            role === "teacher"
              ? "These are the live assignments from the shared NeuroClass database. Open one to see who has submitted."
              : "These are your classroom's published assignments from the shared NeuroClass database."
          }
        />
        {role === "teacher" ? (
          <PrimaryButton
            label="New assignment"
            onPress={() => router.push({ pathname: "/assignment-create/[classroomId]", params: { classroomId } } as never)}
          />
        ) : null}
        {error ? (
          <EmptyState title="Assignments unavailable" detail={error} action={<PrimaryButton label="Try again" onPress={() => void load()} />} />
        ) : assignments.length === 0 ? (
          <EmptyState
            title="No assignments yet"
            detail={
              role === "teacher"
                ? "Create the first one here — it will appear in the web app too, from the same shared database."
                : "Your teacher has not published an assignment for this class yet."
            }
          />
        ) : (
          <View style={styles.stack}>
            {assignments.map((assignment) => (
              <Pressable
                key={assignment.id}
                onPress={() => router.push({ pathname: "/assignment/[id]", params: { id: assignment.id } })}
                style={({ pressed }) => (pressed ? { opacity: 0.76 } : undefined)}
              >
                <Card>
                  <View style={styles.row}>
                    <View style={[styles.icon, { backgroundColor: `${colors.primary}14` }]}>
                      <IconSymbol name="doc.text.fill" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.copy}>
                      <Text style={[styles.itemTitle, { color: colors.foreground }]}>{assignment.title}</Text>
                      <Text style={[styles.itemDetail, { color: colors.muted }]}>
                        {assignment.assignmentType} · {assignment.totalMarks} marks
                        {assignment.dueAt ? ` · Due ${formatDateTime(assignment.dueAt)}` : ""}
                      </Text>
                    </View>
                    <Pill
                      label={
                        role === "teacher"
                          ? assignment.status
                          : (assignment.myStatus ?? "not_started").replace("_", " ")
                      }
                      tone={
                        assignment.myStatus === "returned" || assignment.status === "published"
                          ? "success"
                          : assignment.myStatus === "missing"
                            ? "danger"
                            : "primary"
                      }
                    />
                  </View>
                  {role === "teacher" && assignment.stats ? (
                    <Text style={[styles.stats, { color: colors.muted }]}>
                      {assignment.stats.submitted} submitted · {assignment.stats.late} late · {assignment.stats.pending} pending
                    </Text>
                  ) : null}
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: 18, paddingBottom: 32, gap: 14 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stack: { gap: 10 },
  row: { flexDirection: "row", gap: 11, alignItems: "center" },
  icon: { width: 43, height: 43, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: 15, fontWeight: "800" },
  itemDetail: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  stats: { fontSize: 12, fontWeight: "700", marginTop: 10 },
});
