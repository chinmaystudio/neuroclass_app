import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Card, EmptyState, LoadingState, Pill, PrimaryButton, uiStyles } from "@/components/neuroclass-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { listAssignmentSubmissions } from "@/lib/neuroclass-assignments";
import { formatDateTime } from "@/lib/neuroclass-data";
import { gradeSubmission } from "@/lib/neuroclass-tutor";
import type { Assignment, AssignmentSubmission } from "@/lib/neuroclass-types";

type StudentEntry = {
  student: { id: string; name: string; email: string | null; rollNumber: string | null };
  submission: AssignmentSubmission | null;
};

function statusTone(status: string): "neutral" | "success" | "warning" | "danger" | "primary" {
  switch (status) {
    case "returned":
      return "success";
    case "submitted":
      return "primary";
    case "draft":
      return "warning";
    default:
      return "neutral";
  }
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function GradeForm({ submission, totalMarks, onGraded }: { submission: AssignmentSubmission; totalMarks: number; onGraded: () => Promise<void> }) {
  const colors = useColors();
  const [score, setScore] = useState(
    submission.finalScore !== null && submission.finalScore !== undefined ? String(submission.finalScore) : "",
  );
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  const [waiveLatePenalty, setWaiveLatePenalty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyGraded = submission.status === "evaluated" || submission.status === "returned";

  const save = async () => {
    const parsed = Number(score);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > totalMarks) {
      setError(`Enter a score between 0 and ${totalMarks}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await gradeSubmission(submission.id, {
        score: parsed,
        feedback: feedback.trim() ? feedback.trim() : null,
        returnToStudent: true,
        waiveLatePenalty: submission.isLate ? waiveLatePenalty : false,
      });
      await onGraded();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The grade could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.gradeForm}>
      {submission.textResponse ? (
        <View>
          <Text style={[styles.detailLabel, { color: colors.muted }]}>Text response</Text>
          <Text style={[styles.detail, { color: colors.foreground }]}>{submission.textResponse}</Text>
        </View>
      ) : null}
      {submission.code ? (
        <View>
          <Text style={[styles.detailLabel, { color: colors.muted }]}>Code · {submission.code.language}</Text>
          <View style={[styles.codeBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.codeText, { color: colors.foreground }]}>{submission.code.source}</Text>
          </View>
        </View>
      ) : null}
      {submission.files.length > 0 ? (
        <View>
          <Text style={[styles.detailLabel, { color: colors.muted }]}>Files</Text>
          {submission.files.map((file) => (
            <Text key={file.id} style={[styles.detail, { color: colors.foreground }]}>
              {file.name} · {formatBytes(file.size)}
            </Text>
          ))}
        </View>
      ) : null}
      {!submission.textResponse && !submission.code && submission.files.length === 0 ? (
        <Text style={[styles.detail, { color: colors.muted }]}>No content was attached to this submission.</Text>
      ) : null}

      {submission.status === "draft" ? (
        <Text style={[styles.detail, { color: colors.warning }]}>This is still a draft — the student has not submitted yet, so it cannot be graded.</Text>
      ) : (
        <>
          <View>
            <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>
              Score (out of {totalMarks}){alreadyGraded ? " · already graded, saving updates it" : ""}
            </Text>
            <TextInput
              value={score}
              onChangeText={setScore}
              keyboardType="numeric"
              placeholder="e.g. 85"
              placeholderTextColor={colors.muted}
              style={[uiStyles.input, styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground }]}
            />
          </View>
          <View>
            <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Feedback (optional)</Text>
            <TextInput
              value={feedback}
              onChangeText={setFeedback}
              multiline
              placeholder="What should the student know about this grade?"
              placeholderTextColor={colors.muted}
              style={[styles.textarea, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground }]}
            />
          </View>
          {submission.isLate ? (
            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={[styles.switchTitle, { color: colors.foreground }]}>Waive late penalty</Text>
                <Text style={[styles.hint, { color: colors.muted }]}>This submission was late. Waiving keeps the full score as the final score.</Text>
              </View>
              <Switch value={waiveLatePenalty} onValueChange={setWaiveLatePenalty} trackColor={{ false: colors.border, true: `${colors.primary}99` }} thumbColor={waiveLatePenalty ? colors.primary : "#FFFFFF"} />
            </View>
          ) : null}
          {error ? <Text style={[styles.detail, { color: colors.error }]}>{error}</Text> : null}
          <PrimaryButton label="Save grade & return to student" onPress={() => void save()} loading={busy} />
        </>
      )}
    </View>
  );
}

export default function AssignmentGradeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [entries, setEntries] = useState<StudentEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const list = await listAssignmentSubmissions(id);
      setAssignment(list.assignment);
      setEntries(list.students ?? []);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Submissions could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  const handleGraded = useCallback(async () => {
    setNotice("Grade saved and returned to the student. It is now visible on the web and in the student's app.");
    await load();
  }, [load]);

  if (loading) return <LoadingState label="Loading submissions…" />;
  if (!assignment)
    return (
      <ScreenContainer className="px-5">
        <EmptyState title="Assignment unavailable" detail={error || "This assignment could not be loaded."} action={<PrimaryButton label="Go back" onPress={() => router.back()} />} />
      </ScreenContainer>
    );

  const gradedCount = entries.filter((entry) => entry.submission && (entry.submission.status === "evaluated" || entry.submission.status === "returned")).length;
  const submittedCount = entries.filter((entry) => entry.submission && entry.submission.status !== "draft").length;

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
        </Pressable>
        <Pill label={assignment.status} tone={assignment.status === "published" ? "success" : "primary"} />
        <Text style={[styles.title, { color: colors.foreground }]}>{assignment.title}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>
          {assignment.totalMarks} marks · {submittedCount} submitted · {gradedCount} graded
          {assignment.dueAt ? ` · Due ${formatDateTime(assignment.dueAt)}` : ""}
        </Text>

        {notice ? (
          <Card>
            <Text style={[styles.detail, { color: colors.success }]}>{notice}</Text>
          </Card>
        ) : null}
        {error ? (
          <Card>
            <Text style={[styles.detail, { color: colors.error }]}>{error}</Text>
          </Card>
        ) : null}

        {entries.length === 0 ? (
          <EmptyState title="No students yet" detail="Students who join this classroom will appear here with their submissions." />
        ) : (
          <View style={styles.stack}>
            {entries.map((entry) => {
              const submission = entry.submission;
              const expanded = expandedId === entry.student.id;
              return (
                <Card key={entry.student.id}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!submission}
                    onPress={() => setExpandedId(expanded ? null : entry.student.id)}
                    style={[styles.row, !submission ? styles.dimmed : null]}
                  >
                    <View style={styles.copy}>
                      <Text style={[styles.itemTitle, { color: colors.foreground }]}>{entry.student.name}</Text>
                      <Text style={[styles.itemDetail, { color: colors.muted }]}>
                        {entry.student.rollNumber ? `Roll ${entry.student.rollNumber} · ` : ""}
                        {entry.student.email || "No email"}
                        {submission?.submittedAt ? ` · Submitted ${formatDateTime(submission.submittedAt)}` : ""}
                      </Text>
                    </View>
                    <View style={styles.pills}>
                      <Pill label={submission ? submission.status : "not submitted"} tone={submission ? statusTone(submission.status) : "neutral"} />
                      {submission?.isLate ? <Pill label="Late" tone="danger" /> : null}
                    </View>
                  </Pressable>
                  {submission?.finalScore !== null && submission?.finalScore !== undefined ? (
                    <Text style={[styles.itemDetail, { color: colors.muted }]}>
                      Score: {submission.finalScore} / {assignment.totalMarks}
                      {submission.feedback ? ` · Feedback: ${submission.feedback}` : ""}
                    </Text>
                  ) : null}
                  {expanded && submission ? (
                    <GradeForm
                      key={`${submission.id}-${submission.updatedAt}-${submission.status}`}
                      submission={submission}
                      totalMarks={assignment.totalMarks}
                      onGraded={handleGraded}
                    />
                  ) : null}
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: 18, paddingBottom: 36, gap: 14 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, lineHeight: 34, letterSpacing: -0.6, fontWeight: "900" },
  meta: { fontSize: 14, marginTop: -8 },
  detail: { fontSize: 14, lineHeight: 21 },
  detailLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 4 },
  stack: { gap: 10 },
  row: { flexDirection: "row", gap: 11, alignItems: "center" },
  dimmed: { opacity: 0.55 },
  copy: { flex: 1, minWidth: 0 },
  pills: { gap: 6, alignItems: "flex-end" },
  itemTitle: { fontSize: 15, fontWeight: "800" },
  itemDetail: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  gradeForm: { gap: 14, marginTop: 4 },
  codeBox: { borderWidth: 1, borderRadius: 12, padding: 12 },
  codeText: { fontSize: 13, lineHeight: 19, fontFamily: "monospace" },
  input: { borderWidth: 1 },
  textarea: { borderWidth: 1, borderRadius: 14, minHeight: 84, padding: 14, fontSize: 16, textAlignVertical: "top" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  switchCopy: { flex: 1, minWidth: 0 },
  switchTitle: { fontSize: 15, fontWeight: "800" },
  hint: { fontSize: 12, lineHeight: 18, marginTop: 4 },
});
