import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Card, EmptyState, LoadingState, Pill, PrimaryButton, ScreenTitle, uiStyles } from "@/components/neuroclass-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { formatDateTime } from "@/lib/neuroclass-data";
import {
  QUESTION_TYPE_LABELS,
  getAttemptReview,
  gradeAttempt,
  type AttemptReview,
  type ReviewQuestion,
} from "@/lib/neuroclass-tests";

type Colors = ReturnType<typeof useColors>;

/** Renders a stored student response readably for each question type. */
function ResponseView({ question, colors }: { question: ReviewQuestion; colors: Colors }) {
  const response = question.answer?.response;
  if (response === null || response === undefined) {
    return <Text style={[styles.detail, { color: colors.muted }]}>No response recorded.</Text>;
  }
  const record = typeof response === "object" ? (response as Record<string, unknown>) : null;

  if (question.type === "coding") {
    const code = record && typeof record.source === "string" ? record.source : "";
    const language = record && typeof record.language === "string" ? record.language : "";
    return (
      <View style={styles.gap}>
        {language ? <Pill label={language} tone="primary" /> : null}
        <Text style={[styles.code, { color: colors.foreground, backgroundColor: `${colors.muted}14` }]} selectable>
          {code || "(empty submission)"}
        </Text>
      </View>
    );
  }
  if (record && Array.isArray(record.optionIds)) {
    const chosen = question.options.filter((option) => (record.optionIds as string[]).includes(option.id));
    if (chosen.length === 0) return <Text style={[styles.detail, { color: colors.muted }]}>No option selected.</Text>;
    return (
      <View style={styles.gap}>
        {chosen.map((option) => (
          <Text key={option.id} style={[styles.detail, { color: colors.foreground }]}>
            • {option.text}
            {option.isCorrect ? "  ✓ correct option" : ""}
          </Text>
        ))}
      </View>
    );
  }
  if (record && typeof record.text === "string") {
    return (
      <Text style={[styles.detail, { color: colors.foreground }]} selectable>
        {record.text || "(blank)"}
      </Text>
    );
  }
  if (record && (typeof record.value === "number" || typeof record.value === "string")) {
    return (
      <Text style={[styles.detail, { color: colors.foreground }]} selectable>
        {String(record.value)}
      </Text>
    );
  }
  if (record && Array.isArray(record.files)) {
    return (
      <Text style={[styles.detail, { color: colors.foreground }]}>
        {(record.files as { name?: string }[]).map((file) => file.name ?? "file").join(", ") || "No files"}
      </Text>
    );
  }
  return (
    <Text style={[styles.detail, { color: colors.muted }]} selectable>
      {typeof response === "string" ? response : JSON.stringify(response)}
    </Text>
  );
}

export default function AttemptReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<AttemptReview | null>(null);
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const payload = await getAttemptReview(id);
      setReview(payload);
      const scores: Record<string, string> = {};
      const feedback: Record<string, string> = {};
      for (const question of payload.questions) {
        if (question.answer?.manualScore !== null && question.answer?.manualScore !== undefined) {
          scores[question.id] = String(question.answer.manualScore);
        }
        if (question.answer?.feedback) feedback[question.id] = question.answer.feedback;
      }
      setScoreDrafts(scores);
      setFeedbackDrafts(feedback);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "This attempt could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  const saveGrades = async () => {
    if (!id || !review) return;
    const grades = review.questions
      .filter((question) => scoreDrafts[question.id] !== undefined || feedbackDrafts[question.id])
      .map((question) => {
        const raw = scoreDrafts[question.id];
        const parsed = raw === undefined || raw.trim() === "" ? null : Number(raw);
        return {
          questionId: question.id,
          manualScore: parsed !== null && Number.isFinite(parsed) ? parsed : null,
          feedback: feedbackDrafts[question.id]?.trim() ? feedbackDrafts[question.id].trim() : null,
          marks: question.marks,
          negativeMarks: question.negativeMarks,
        };
      });
    for (const grade of grades) {
      if (grade.manualScore !== null && (grade.manualScore > grade.marks || grade.manualScore < -grade.negativeMarks)) {
        Alert.alert("Check a score", `Manual scores must be between ${-grade.negativeMarks} and ${grade.marks} for that question.`);
        return;
      }
    }
    if (grades.length === 0) {
      Alert.alert("Nothing to save", "Enter a manual score or feedback for at least one question first.");
      return;
    }
    setSaving(true);
    try {
      const outcome = await gradeAttempt(
        id,
        grades.map(({ questionId, manualScore, feedback }) => ({ questionId, manualScore, feedback })),
        true,
      );
      setNotice(
        outcome.pendingManual
          ? `Grades saved. Score so far: ${outcome.score} / ${outcome.max} (${outcome.percentage}%). Some questions still need review.`
          : `Grading complete. Final score: ${outcome.score} / ${outcome.max} (${outcome.percentage}%).`,
      );
      await load();
    } catch (nextError) {
      Alert.alert("Could not save grades", nextError instanceof Error ? nextError.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading attempt…" />;
  if (!review)
    return (
      <ScreenContainer className="px-5" containerClassName="bg-background">
        <EmptyState title="Attempt unavailable" detail={error || "This attempt could not be loaded."} action={<PrimaryButton label="Go back" onPress={() => router.back()} />} />
      </ScreenContainer>
    );

  const { attempt, student, test, questions } = review;
  const rollNumber = student?.rollNumber ?? student?.roll_number ?? null;
  const proctoringEvents = Array.isArray(review.proctoring?.events) ? review.proctoring.events : [];
  const gradable = attempt.status !== "in_progress" && attempt.status !== "calibrating";

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
        </Pressable>
        <ScreenTitle
          eyebrow="Attempt review"
          title={student?.name ?? "Student"}
          subtitle={`${test.title}${rollNumber ? ` · Roll ${rollNumber}` : ""}${student?.email ? ` · ${student.email}` : ""}`}
          action={
            <Pill
              label={attempt.status.replace(/_/g, " ")}
              tone={attempt.status === "evaluated" ? "success" : attempt.status === "flagged" ? "danger" : "warning"}
            />
          }
        />
        {notice ? (
          <Card>
            <Text style={[styles.detail, { color: colors.success }]}>{notice}</Text>
          </Card>
        ) : null}

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Summary</Text>
          <Text style={[styles.detail, { color: colors.muted }]}>
            Score: {attempt.score !== null && attempt.score !== undefined ? `${attempt.score} / ${attempt.maxScore ?? test.totalMarks}` : "not scored yet"}
            {attempt.percentage !== null && attempt.percentage !== undefined ? ` (${attempt.percentage}%)` : ""}
          </Text>
          <Text style={[styles.detail, { color: colors.muted }]}>
            {attempt.startedAt ? `Started ${formatDateTime(attempt.startedAt)}` : ""}
            {attempt.submittedAt ? ` · Submitted ${formatDateTime(attempt.submittedAt)}` : ""}
            {attempt.evaluatedAt ? ` · Evaluated ${formatDateTime(attempt.evaluatedAt)}` : ""}
          </Text>
          {attempt.integrityScore !== null && attempt.integrityScore !== undefined ? (
            <Text style={[styles.detail, { color: colors.muted }]}>
              Integrity score: {attempt.integrityScore}
              {attempt.riskLevel ? ` · Risk: ${attempt.riskLevel}` : ""}
              {attempt.warningCount ? ` · ${attempt.warningCount} warning(s)` : ""}
            </Text>
          ) : null}
          {attempt.identityStatus ? <Text style={[styles.detail, { color: colors.muted }]}>Identity status: {attempt.identityStatus}</Text> : null}
          {attempt.submissionSource ? <Text style={[styles.detail, { color: colors.muted }]}>Submitted via: {attempt.submissionSource}</Text> : null}
          {proctoringEvents.length > 0 ? (
            <Text style={[styles.detail, { color: colors.muted }]}>Proctoring events recorded: {proctoringEvents.length} (review them in detail on the web app).</Text>
          ) : null}
        </Card>

        {questions.map((question, index) => {
          const answer = question.answer;
          return (
            <Card key={question.id}>
              <View style={styles.rowBetween}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Q{index + 1} · {QUESTION_TYPE_LABELS[question.type] ?? question.type}
                </Text>
                <Pill
                  label={
                    answer
                      ? `${answer.awardedMarks ?? "—"} / ${question.marks}${answer.needsManualReview ? " · needs review" : ""}`
                      : `0 / ${question.marks} · no answer`
                  }
                  tone={answer?.needsManualReview ? "warning" : "primary"}
                />
              </View>
              <Text style={[styles.detail, { color: colors.foreground }]} selectable>
                {question.prompt}
              </Text>
              <Text style={[styles.itemDetail, { color: colors.muted }]}>Student response</Text>
              <ResponseView question={question} colors={colors} />
              {question.type === "mcq" || question.type === "multiple_select" || question.type === "true_false" ? (
                <Text style={[styles.itemDetail, { color: colors.muted }]}>
                  Correct: {question.options.filter((option) => option.isCorrect).map((option) => option.text).join(", ") || "—"}
                </Text>
              ) : null}
              {question.type === "numerical" ? (
                <Text style={[styles.itemDetail, { color: colors.muted }]}>
                  Correct answer: {question.numericAnswer ?? "—"}
                  {question.numericTolerance ? ` (±${question.numericTolerance})` : ""}
                </Text>
              ) : null}
              {(question.type === "short_answer" || question.type === "fill_blank") && question.acceptedAnswers.length > 0 ? (
                <Text style={[styles.itemDetail, { color: colors.muted }]}>Accepted: {question.acceptedAnswers.join(", ")}</Text>
              ) : null}
              {question.modelAnswer ? (
                <Text style={[styles.itemDetail, { color: colors.muted }]}>Model answer: {question.modelAnswer}</Text>
              ) : null}
              {answer ? (
                <Text style={[styles.itemDetail, { color: colors.muted }]}>
                  Auto score: {answer.autoScore ?? "—"} · Manual score: {answer.manualScore ?? "—"} · Awarded: {answer.awardedMarks ?? "—"}
                </Text>
              ) : null}
              {gradable ? (
                <View style={styles.gap}>
                  <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Manual score (−{question.negativeMarks} to {question.marks})</Text>
                  <TextInput
                    value={scoreDrafts[question.id] ?? ""}
                    onChangeText={(text) => setScoreDrafts((current) => ({ ...current, [question.id]: text }))}
                    keyboardType="decimal-pad"
                    placeholder={answer?.autoScore !== null && answer?.autoScore !== undefined ? `Auto: ${answer.autoScore}` : "Enter score"}
                    placeholderTextColor={colors.muted}
                    style={[uiStyles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground }]}
                  />
                  <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Feedback (optional)</Text>
                  <TextInput
                    value={feedbackDrafts[question.id] ?? ""}
                    onChangeText={(text) => setFeedbackDrafts((current) => ({ ...current, [question.id]: text }))}
                    placeholder="Feedback for the student…"
                    placeholderTextColor={colors.muted}
                    multiline
                    style={[uiStyles.input, styles.multiline, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground }]}
                  />
                </View>
              ) : null}
            </Card>
          );
        })}

        {gradable ? <PrimaryButton label="Save grades & finalize" onPress={() => void saveGrades()} loading={saving} /> : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: 18, paddingBottom: 32, gap: 14 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  gap: { gap: 8 },
  detail: { fontSize: 14, lineHeight: 21 },
  itemDetail: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  code: { fontFamily: "monospace", fontSize: 13, lineHeight: 19, padding: 12, borderRadius: 12 },
  multiline: { minHeight: 76, paddingTop: 12, textAlignVertical: "top" },
});
