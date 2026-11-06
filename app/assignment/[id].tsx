import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Card, EmptyState, LoadingState, OutlineButton, Pill, PrimaryButton } from "@/components/neuroclass-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useNeuroClassAuth } from "@/lib/neuroclass-auth";
import {
  getAssignment,
  getMySubmission,
  listAssignmentSubmissions,
  saveAssignmentDraft,
  submitAssignment,
} from "@/lib/neuroclass-assignments";
import { formatDateTime } from "@/lib/neuroclass-data";
import type { Assignment, AssignmentSubmission } from "@/lib/neuroclass-types";

type TeacherEntry = {
  student: { id: string; name: string; email: string | null; rollNumber: string | null };
  submission: AssignmentSubmission | null;
};

export default function AssignmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { role } = useNeuroClassAuth();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(null);
  const [entries, setEntries] = useState<TeacherEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !role) return;
    setLoading(true);
    try {
      if (role === "teacher") {
        const [detail, list] = await Promise.all([getAssignment(id), listAssignmentSubmissions(id)]);
        setAssignment(detail);
        setEntries(list.students ?? []);
      } else {
        const mine = await getMySubmission(id);
        setAssignment(mine.assignment);
        setSubmission(mine.submission);
        setDraft(mine.submission?.textResponse ?? "");
      }
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "This assignment could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id, role]);
  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState label="Loading assignment…" />;
  if (!assignment)
    return (
      <ScreenContainer className="px-5">
        <EmptyState title="Assignment unavailable" detail={error || "This assignment could not be loaded."} action={<PrimaryButton label="Go back" onPress={() => router.back()} />} />
      </ScreenContainer>
    );

  const editable = role === "student" && assignment.status === "published" && submission?.status !== "returned" && submission?.status !== "evaluated";

  const save = async () => {
    setBusy(true);
    try {
      await saveAssignmentDraft(assignment.id, draft);
      setNotice("Draft saved to the shared NeuroClass database.");
    } catch (nextError) {
      Alert.alert("Could not save", nextError instanceof Error ? nextError.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      await saveAssignmentDraft(assignment.id, draft);
      const result = await submitAssignment(assignment.id);
      setNotice(result.alreadySubmitted ? "This assignment was already submitted." : "Submitted. Your teacher can now see it on the web and in this app.");
      await load();
    } catch (nextError) {
      Alert.alert("Could not submit", nextError instanceof Error ? nextError.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
        </Pressable>
        <Pill label={assignment.status} tone={assignment.status === "published" ? "success" : "primary"} />
        <Text style={[styles.title, { color: colors.foreground }]}>{assignment.title}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>
          {assignment.assignmentType} · {assignment.totalMarks} marks
          {assignment.dueAt ? ` · Due ${formatDateTime(assignment.dueAt)}` : ""}
        </Text>
        {assignment.description ? (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About this assignment</Text>
            <Text style={[styles.detail, { color: colors.muted }]}>{assignment.description}</Text>
          </Card>
        ) : null}
        {assignment.instructions ? (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Instructions</Text>
            <Text style={[styles.detail, { color: colors.muted }]}>{assignment.instructions}</Text>
          </Card>
        ) : null}
        {notice ? (
          <Card>
            <Text style={[styles.detail, { color: colors.success }]}>{notice}</Text>
          </Card>
        ) : null}

        {role === "teacher" ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Submissions · {entries.length} students</Text>
            {entries.length === 0 ? (
              <EmptyState title="No roster yet" detail="Students who join this classroom will be listed here with their submission status." />
            ) : (
              <View style={styles.stack}>
                {entries.map((entry) => (
                  <Card key={entry.student.id}>
                    <View style={styles.row}>
                      <View style={styles.copy}>
                        <Text style={[styles.itemTitle, { color: colors.foreground }]}>{entry.student.name}</Text>
                        <Text style={[styles.itemDetail, { color: colors.muted }]}>
                          {entry.student.email || "No email"}
                          {entry.submission?.submittedAt ? ` · ${formatDateTime(entry.submission.submittedAt)}` : ""}
                        </Text>
                      </View>
                      <Pill
                        label={entry.submission ? entry.submission.status : "not started"}
                        tone={entry.submission && entry.submission.status !== "draft" ? "success" : "warning"}
                      />
                    </View>
                    {entry.submission?.finalScore !== null && entry.submission?.finalScore !== undefined ? (
                      <Text style={[styles.itemDetail, { color: colors.muted }]}>Score: {entry.submission.finalScore}</Text>
                    ) : null}
                  </Card>
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your work</Text>
            {submission && submission.status !== "draft" ? (
              <Card>
                <Text style={[styles.detail, { color: colors.muted }]}>
                  Status: {submission.status}
                  {submission.submittedAt ? ` · Submitted ${formatDateTime(submission.submittedAt)}` : ""}
                  {submission.isLate ? " · Late" : ""}
                </Text>
                {submission.finalScore !== null && submission.finalScore !== undefined ? (
                  <Text style={[styles.detail, { color: colors.foreground }]}>Score: {submission.finalScore}</Text>
                ) : null}
                {submission.feedback ? <Text style={[styles.detail, { color: colors.muted }]}>Feedback: {submission.feedback}</Text> : null}
              </Card>
            ) : null}
            {assignment.assignmentType === "coding" || assignment.assignmentType === "file" || assignment.assignmentType === "document" ? (
              <Card>
                <Text style={[styles.detail, { color: colors.muted }]}>
                  This is a {assignment.assignmentType} assignment. File uploads and the coding workspace are handled on the NeuroClass web app for now; your text note below is still saved to the same submission.
                </Text>
              </Card>
            ) : null}
            <TextInput
              value={draft}
              onChangeText={setDraft}
              editable={editable && !busy}
              multiline
              placeholder="Write your answer here…"
              placeholderTextColor={colors.muted}
              style={[styles.editor, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground }]}
            />
            {editable ? (
              <View style={styles.actions}>
                <OutlineButton label="Save draft" onPress={() => void save()} disabled={busy} />
                <PrimaryButton label="Submit assignment" onPress={() => void submit()} loading={busy} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: 18, paddingBottom: 32, gap: 14 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, lineHeight: 34, letterSpacing: -0.6, fontWeight: "900" },
  meta: { fontSize: 14, marginTop: -8 },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
  detail: { fontSize: 14, lineHeight: 21 },
  stack: { gap: 10 },
  row: { flexDirection: "row", gap: 11, alignItems: "center" },
  copy: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: 15, fontWeight: "800" },
  itemDetail: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  editor: { borderWidth: 1, borderRadius: 14, minHeight: 160, padding: 14, fontSize: 16, textAlignVertical: "top" },
  actions: { gap: 10 },
});
