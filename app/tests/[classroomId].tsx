import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Card, EmptyState, LoadingState, OutlineButton, Pill, PrimaryButton, ScreenTitle } from "@/components/neuroclass-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useNeuroClassAuth } from "@/lib/neuroclass-auth";
import { formatDateTime } from "@/lib/neuroclass-data";
import {
  closeTest,
  deleteTest,
  duplicateTest,
  listClassroomTests,
  publishTest,
  releaseTestResults,
  reopenTest,
  unpublishTest,
  type StudentTestListItem,
  type TeacherTestListItem,
  type TestStatus,
} from "@/lib/neuroclass-tests";

function statusTone(status: TestStatus): "success" | "warning" | "danger" | "primary" | "neutral" {
  if (status === "published") return "success";
  if (status === "closed") return "warning";
  if (status === "archived") return "danger";
  return "primary";
}

export default function TestsScreen() {
  const { classroomId } = useLocalSearchParams<{ classroomId: string }>();
  const colors = useColors();
  const { role: authRole } = useNeuroClassAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"teacher" | "student" | null>(null);
  const [teacherTests, setTeacherTests] = useState<TeacherTestListItem[]>([]);
  const [studentTests, setStudentTests] = useState<StudentTestListItem[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (!classroomId) return;
      if (refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const payload = await listClassroomTests(classroomId);
        setRole(payload.role);
        if (payload.role === "teacher") setTeacherTests(payload.tests);
        else setStudentTests(payload.tests);
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Tests could not be loaded.");
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

  const runAction = async (test: TeacherTestListItem, action: string, work: () => Promise<unknown>, successMessage?: string) => {
    setBusyKey(`${test.id}:${action}`);
    try {
      await work();
      if (successMessage) Alert.alert("Done", successMessage);
      await load();
    } catch (nextError) {
      Alert.alert("That did not work", nextError instanceof Error ? nextError.message : "Please try again.");
    } finally {
      setBusyKey(null);
    }
  };

  const confirmDelete = (test: TeacherTestListItem) => {
    Alert.alert("Delete this test?", `"${test.title}" and its questions will be permanently removed. Only draft tests without attempts can be deleted.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void runAction(test, "delete", () => deleteTest(test.id), "The test was deleted."),
      },
    ]);
  };

  if (loading) return <LoadingState label="Loading tests…" />;

  const isTeacher = (role ?? authRole) === "teacher";
  const isEmpty = isTeacher ? teacherTests.length === 0 : studentTests.length === 0;

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
          eyebrow="Same tests as the web app"
          title="Tests"
          subtitle={
            isTeacher
              ? "Create, publish and grade tests against the shared NeuroClass database — everything syncs with the web app."
              : "Published tests for this classroom from the shared NeuroClass database."
          }
        />
        {isTeacher ? (
          <PrimaryButton
            label="Create test"
            onPress={() => router.push({ pathname: "/test-editor/[id]", params: { id: "new", classroomId: classroomId ?? "" } } as never)}
          />
        ) : null}
        {error ? (
          <EmptyState title="Tests unavailable" detail={error} action={<PrimaryButton label="Try again" onPress={() => void load()} />} />
        ) : isEmpty ? (
          <EmptyState
            title="No tests yet"
            detail={
              isTeacher
                ? "Create your first test here, or on the NeuroClass web app — it will appear in both places."
                : "Your teacher has not published a test for this class yet."
            }
          />
        ) : (
          <View style={styles.stack}>
            {isTeacher
              ? teacherTests.map((test) => (
                  <Card key={test.id}>
                    <View style={styles.row}>
                      <View style={[styles.icon, { backgroundColor: `${colors.primary}14` }]}>
                        <IconSymbol name="doc.text.fill" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.copy}>
                        <Text style={[styles.itemTitle, { color: colors.foreground }]}>{test.title}</Text>
                        <Text style={[styles.itemDetail, { color: colors.muted }]}>
                          {test.subject ? `${test.subject} · ` : ""}
                          {test.questionCount ?? 0} questions · {test.totalMarks} marks · {test.durationMinutes} min
                          {test.examMode === "coding" ? " · Coding" : ""}
                        </Text>
                        <Text style={[styles.itemDetail, { color: colors.muted }]}>
                          {test.stats.submitted} submitted · {test.stats.active} in progress · {test.stats.pendingReview} awaiting review
                        </Text>
                        {test.scheduledStart ? (
                          <Text style={[styles.itemDetail, { color: colors.muted }]}>Opens {formatDateTime(test.scheduledStart)}</Text>
                        ) : null}
                      </View>
                      <Pill label={test.status} tone={statusTone(test.status)} />
                    </View>
                    <View style={styles.actions}>
                      <OutlineButton label="Edit" onPress={() => router.push({ pathname: "/test-editor/[id]", params: { id: test.id } } as never)} />
                      <OutlineButton label="Results" onPress={() => router.push({ pathname: "/test-results/[id]", params: { id: test.id } } as never)} />
                    </View>
                    <View style={styles.actions}>
                      {test.status === "draft" ? (
                        <OutlineButton
                          label={busyKey === `${test.id}:publish` ? "Publishing…" : "Publish"}
                          disabled={busyKey !== null}
                          onPress={() => void runAction(test, "publish", () => publishTest(test.id, {}), "The test is published. Students can see it now.")}
                        />
                      ) : null}
                      {test.status === "published" ? (
                        <>
                          <OutlineButton
                            label={busyKey === `${test.id}:unpublish` ? "Working…" : "Unpublish"}
                            disabled={busyKey !== null}
                            onPress={() => void runAction(test, "unpublish", () => unpublishTest(test.id))}
                          />
                          <OutlineButton
                            label={busyKey === `${test.id}:close` ? "Working…" : "Close"}
                            disabled={busyKey !== null}
                            onPress={() => void runAction(test, "close", () => closeTest(test.id), "The test is closed to new attempts.")}
                          />
                        </>
                      ) : null}
                      {test.status === "closed" ? (
                        <OutlineButton
                          label={busyKey === `${test.id}:reopen` ? "Working…" : "Reopen"}
                          disabled={busyKey !== null}
                          onPress={() => void runAction(test, "reopen", () => reopenTest(test.id), "The test is published again.")}
                        />
                      ) : null}
                      <OutlineButton
                        label={busyKey === `${test.id}:duplicate` ? "Copying…" : "Duplicate"}
                        disabled={busyKey !== null}
                        onPress={() => void runAction(test, "duplicate", () => duplicateTest(test.id), "A draft copy was created.")}
                      />
                      <OutlineButton
                        label="Delete"
                        disabled={busyKey !== null}
                        onPress={() => confirmDelete(test)}
                      />
                    </View>
                    {test.status !== "draft" ? (
                      <View style={styles.actions}>
                        <OutlineButton
                          label={
                            busyKey === `${test.id}:release`
                              ? "Working…"
                              : test.resultsReleased
                                ? "Results released — tap to withhold"
                                : "Release results to students"
                          }
                          disabled={busyKey !== null}
                          onPress={() =>
                            void runAction(
                              test,
                              "release",
                              () => releaseTestResults(test.id, !test.resultsReleased),
                              test.resultsReleased ? "Results are hidden from students again." : "Students can now see their results.",
                            )
                          }
                        />
                      </View>
                    ) : null}
                  </Card>
                ))
              : studentTests.map((test) => (
                  <Pressable
                    key={test.id}
                    onPress={() => router.push({ pathname: "/assessment/[id]", params: { id: test.id } })}
                    style={({ pressed }) => (pressed ? { opacity: 0.76 } : undefined)}
                  >
                    <Card>
                      <View style={styles.row}>
                        <View style={[styles.icon, { backgroundColor: `${colors.primary}14` }]}>
                          <IconSymbol name="doc.text.fill" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.copy}>
                          <Text style={[styles.itemTitle, { color: colors.foreground }]}>{test.title}</Text>
                          <Text style={[styles.itemDetail, { color: colors.muted }]}>
                            {test.subject ? `${test.subject} · ` : ""}
                            {test.totalMarks} marks · {test.durationMinutes} min
                            {test.examMode === "coding" ? " · Coding" : ""}
                            {test.proctored ? " · Proctored" : ""}
                          </Text>
                          {test.availability === "scheduled" && test.scheduledStart ? (
                            <Text style={[styles.itemDetail, { color: colors.muted }]}>Opens {formatDateTime(test.scheduledStart)}</Text>
                          ) : null}
                          {test.result ? (
                            <Text style={[styles.itemDetail, { color: colors.foreground }]}>
                              Your score: {test.result.score ?? "—"} / {test.result.maxScore ?? test.totalMarks}
                              {test.result.percentage !== null && test.result.percentage !== undefined ? ` (${test.result.percentage}%)` : ""}
                            </Text>
                          ) : test.myStatus ? (
                            <Text style={[styles.itemDetail, { color: colors.muted }]}>Status: {test.myStatus.replace(/_/g, " ")}</Text>
                          ) : null}
                        </View>
                        <Pill
                          label={test.availability}
                          tone={test.availability === "active" ? "success" : test.availability === "scheduled" ? "primary" : "warning"}
                        />
                      </View>
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
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
});
