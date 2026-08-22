import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useKeepAwake } from "expo-keep-awake";
import { router, useLocalSearchParams } from "expo-router";

import { Card, LoadingState, Pill, PrimaryButton } from "@/components/neuroclass-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { createAttempt, getAssessment, getInProgressAttempt, getStudentRecord, normalizeQuestions, saveAttemptAnswers, submitAttempt } from "@/lib/neuroclass-data";
import { useNeuroClassAuth } from "@/lib/neuroclass-auth";
import type { Assessment, StudentRecord } from "@/lib/neuroclass-types";
import { ScreenContainer } from "@/components/screen-container";

export default function TestRunnerScreen() {
  useKeepAwake("neuroclass-assessment", { suppressDeactivateWarnings: true });
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { user } = useNeuroClassAuth();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const questions = useMemo(() => normalizeQuestions(assessment?.questions), [assessment?.questions]);
  const load = useCallback(async () => {
    if (!id || !user) return;
    try {
      const nextAssessment = await getAssessment(id);
      if (!nextAssessment.classroom_id) throw new Error("This assessment is not linked to a classroom.");
      const nextStudent = await getStudentRecord(user.id, nextAssessment.classroom_id);
      if (!nextStudent) throw new Error("You are not enrolled in the classroom for this assessment.");
      let attempt = await getInProgressAttempt(nextAssessment.id, nextStudent.id);
      if (!attempt) attempt = await createAttempt(nextAssessment.id, nextStudent.id);
      const restored = attempt.answers && typeof attempt.answers === "object" && !Array.isArray(attempt.answers) ? attempt.answers as Record<string, string> : {};
      const localDraft = await AsyncStorage.getItem(`neuroclass.attempt.${attempt.id}.answers`);
      const localAnswers = localDraft ? JSON.parse(localDraft) as Record<string, string> : {};
      setAssessment(nextAssessment); setStudent(nextStudent); setAttemptId(attempt.id); setAnswers({ ...restored, ...localAnswers });
      const elapsed = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
      setRemaining(Math.max(0, (nextAssessment.duration_mins ?? 45) * 60 - elapsed));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not start this assessment."); }
    finally { setLoading(false); }
  }, [id, user]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (remaining === null || remaining <= 0 || submitting) return;
    const timer = setInterval(() => setRemaining((value) => value === null ? null : Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [remaining, submitting]);

  const question = questions[questionIndex];
  const setAnswer = (value: string) => {
    if (!question || !attemptId) return;
    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    void AsyncStorage.setItem(`neuroclass.attempt.${attemptId}.answers`, JSON.stringify(next));
    void saveAttemptAnswers(attemptId, next).catch((error) => setMessage(error instanceof Error ? error.message : "Your answer is safely kept on this device and will sync when you reconnect."));
  };
  const submit = () => {
    if (!assessment || !student || !attemptId) return;
    Alert.alert("Submit assessment?", "You will not be able to change your answers after submission.", [{ text: "Keep working", style: "cancel" }, { text: "Submit", style: "destructive", onPress: () => void finishSubmission() }]);
  };
  const finishSubmission = async () => {
    if (!assessment || !student || !attemptId) return;
    setSubmitting(true);
    try {
      await submitAttempt({ attemptId, testId: assessment.id, student, answers, totalMarks: assessment.total_marks ?? 0 });
      await AsyncStorage.removeItem(`neuroclass.attempt.${attemptId}.answers`);
      Alert.alert("Assessment submitted", "Your responses are now in the shared NeuroClass workspace and await review.", [{ text: "Done", onPress: () => router.replace("/(tabs)") }]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not submit your assessment."); }
    finally { setSubmitting(false); }
  };

  if (loading) return <LoadingState label="Preparing your assessment…" />;
  if (!assessment || !student || !attemptId || !question) return <ScreenContainer className="px-5"><View style={styles.unavailable}><Text style={[styles.unavailableTitle, { color: colors.foreground }]}>Assessment unavailable</Text><Text style={[styles.unavailableDetail, { color: colors.muted }]}>{message || "There are no mobile-ready questions for this assessment."}</Text><PrimaryButton label="Return to classes" onPress={() => router.replace("/(tabs)/classes")} /></View></ScreenContainer>;
  const completed = Object.keys(answers).filter((key) => answers[key].trim()).length;
  return (
    <ScreenContainer className="px-5" edges={["top", "left", "right", "bottom"]} containerClassName="bg-background"><View style={styles.root}>
      <View style={styles.header}><Pressable accessibilityLabel="Exit assessment" onPress={() => Alert.alert("Leave assessment?", "Your current answers are saved, and you can resume this assessment later.", [{ text: "Continue", style: "cancel" }, { text: "Leave", style: "destructive", onPress: () => router.back() }])} style={[styles.exit, { backgroundColor: colors.surface, borderColor: colors.border }]}><IconSymbol name="arrow.left" size={20} color={colors.foreground} /></Pressable><View style={styles.headerCopy}><Text numberOfLines={1} style={[styles.testTitle, { color: colors.foreground }]}>{assessment.title}</Text><Text style={[styles.testMeta, { color: colors.muted }]}>Question {questionIndex + 1} of {questions.length}</Text></View><Pill label={formatTime(remaining)} tone={remaining !== null && remaining < 300 ? "danger" : "primary"} /></View>
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}><View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${((questionIndex + 1) / questions.length) * 100}%` }]} /></View>
      {assessment.proctoring_enabled ? <View style={[styles.proctorNotice, { backgroundColor: `${colors.warning}12`, borderColor: `${colors.warning}55` }]}><Text style={[styles.proctorTitle, { color: colors.warning }]}>Proctored assessment</Text><Text style={[styles.proctorDetail, { color: colors.muted }]}>Keep NeuroClass in the foreground. The mobile app never calls the proctoring AI directly and does not claim browser-only tab or window monitoring; review remains under the existing secure NeuroClass workflow.</Text></View> : null}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}><Card><Text style={[styles.questionLabel, { color: colors.primary }]}>QUESTION {questionIndex + 1} · {question.marks} MARK{question.marks === 1 ? "" : "S"}</Text><Text style={[styles.prompt, { color: colors.foreground }]}>{question.prompt}</Text>{question.type === "multiple_choice" ? <View style={styles.optionList}>{question.options.map((option, index) => { const selected = answers[question.id] === option; return <Pressable key={`${question.id}-${index}`} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setAnswer(option)} style={[styles.option, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? `${colors.primary}10` : colors.surface }]}><View style={[styles.radio, { borderColor: selected ? colors.primary : colors.muted, backgroundColor: selected ? colors.primary : "transparent" }]}>{selected ? <View style={styles.radioDot} /> : null}</View><Text style={[styles.optionText, { color: colors.foreground }]}>{option}</Text></Pressable>; })}</View> : <TextInput value={answers[question.id] || ""} onChangeText={setAnswer} multiline placeholder="Write your response…" placeholderTextColor={colors.muted} style={[styles.textAnswer, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />}</Card>
      {message ? <Text style={[styles.message, { color: colors.error }]}>{message}</Text> : null}</ScrollView>
      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}><Text style={[styles.saved, { color: colors.muted }]}>{completed} of {questions.length} answered</Text><View style={styles.controls}>{questionIndex > 0 ? <Pressable onPress={() => setQuestionIndex((value) => value - 1)} style={[styles.navButton, { borderColor: colors.border, backgroundColor: colors.surface }]}><Text style={[styles.navText, { color: colors.foreground }]}>Back</Text></Pressable> : <View style={styles.navSpacer} />}{questionIndex < questions.length - 1 ? <Pressable onPress={() => setQuestionIndex((value) => value + 1)} style={[styles.navButton, { borderColor: colors.primary, backgroundColor: colors.primary }]}><Text style={[styles.navText, { color: "#FFFFFF" }]}>Next</Text></Pressable> : <View style={styles.submitWrap}><PrimaryButton label="Submit" onPress={submit} loading={submitting} /></View>}</View></View>
    </View></ScreenContainer>
  );
}

function formatTime(seconds: number | null): string {
  if (seconds === null) return "--:--";
  const minutes = Math.floor(seconds / 60); const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  exit: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  testTitle: { fontSize: 16, fontWeight: "900" },
  testMeta: { fontSize: 12, marginTop: 1 },
  progressTrack: { height: 5, borderRadius: 5, overflow: "hidden" },
  progressFill: { height: 5, borderRadius: 5 },
  proctorNotice: { borderWidth: 1, borderRadius: 13, padding: 10, gap: 3, marginTop: 11 },
  proctorTitle: { fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.55 },
  proctorDetail: { fontSize: 12, lineHeight: 17 },
  content: { paddingVertical: 18, gap: 10 },
  questionLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 0.7 },
  prompt: { fontSize: 19, lineHeight: 27, fontWeight: "700" },
  optionList: { gap: 10, marginTop: 4 },
  option: { minHeight: 54, borderWidth: 1, borderRadius: 15, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 11 },
  radio: { width: 21, height: 21, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FFFFFF" },
  optionText: { fontSize: 15, lineHeight: 21, flex: 1 },
  textAnswer: { minHeight: 150, borderWidth: 1, borderRadius: 15, padding: 14, fontSize: 16, lineHeight: 23, textAlignVertical: "top", marginTop: 4 },
  message: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  footer: { borderTopWidth: 1, paddingTop: 10, paddingBottom: 4, gap: 8 },
  saved: { fontSize: 12, fontWeight: "600", textAlign: "center" },
  controls: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  navButton: { minWidth: 92, height: 48, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  navText: { fontSize: 15, fontWeight: "800" },
  navSpacer: { width: 92 },
  submitWrap: { minWidth: 112, flex: 1, maxWidth: 160 },
  unavailable: { flex: 1, justifyContent: "center", gap: 12 },
  unavailableTitle: { fontSize: 24, fontWeight: "900", textAlign: "center" },
  unavailableDetail: { fontSize: 14, lineHeight: 21, textAlign: "center" },
});
