import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Card, EmptyState, LoadingState, OutlineButton, Pill, PrimaryButton, ScreenTitle, uiStyles } from "@/components/neuroclass-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  CODING_LANGUAGE_IDS,
  CODING_LANGUAGE_LABELS,
  DEFAULT_TEST_CONFIG,
  DEFAULT_TEST_SECURITY,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  createTest,
  generateTestWithAi,
  getTeacherTest,
  mapGeneratedQuestions,
  publishTest,
  replaceTestQuestions,
  updateTestMeta,
  validateQuestion,
  type EditableQuestion,
  type ExamMode,
  type QuestionInput,
  type QuestionType,
  type TestConfig,
  type TestMetaInput,
  type TestSecurity,
  type TestStatus,
} from "@/lib/neuroclass-tests";

type Colors = ReturnType<typeof useColors>;

function FieldLabel({ children, colors }: { children: React.ReactNode; colors: Colors }) {
  return <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>{children}</Text>;
}

function TextField({
  colors,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  editable = true,
}: {
  colors: Colors;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "decimal-pad";
  editable?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      editable={editable}
      multiline={multiline}
      keyboardType={keyboardType ?? "default"}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      style={[
        uiStyles.input,
        multiline ? styles.multiline : null,
        { borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground },
      ]}
    />
  );
}

function ToggleRow({
  colors,
  label,
  detail,
  value,
  onValueChange,
  disabled,
}: {
  colors: Colors;
  label: string;
  detail?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.copy}>
        <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
        {detail ? <Text style={[styles.itemDetail, { color: colors.muted }]}>{detail}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ true: colors.primary, false: colors.border }} />
    </View>
  );
}

function Chip({
  colors,
  label,
  selected,
  onPress,
  disabled,
}: {
  colors: Colors;
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chip,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? `${colors.primary}18` : colors.surface,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text style={[styles.chipLabel, { color: selected ? colors.primary : colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

function blankQuestion(type: QuestionType = "mcq"): QuestionInput {
  const base: QuestionInput = {
    type,
    prompt: "",
    options: [],
    marks: 1,
    negativeMarks: 0,
    explanation: "",
    acceptedAnswers: [],
    caseSensitive: false,
    numericAnswer: null,
    numericTolerance: 0,
    partialCredit: false,
    modelAnswer: "",
    coding: null,
    testCases: [],
  };
  if (type === "mcq" || type === "multiple_select") {
    base.options = [
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
    ];
  }
  if (type === "true_false") {
    base.options = [
      { text: "True", isCorrect: true },
      { text: "False", isCorrect: false },
    ];
  }
  if (type === "coding") {
    base.coding = { languages: ["python"], starterCode: {}, timeLimitMs: 3000, memoryLimitMb: 256 };
    base.testCases = [{ input: "", expectedOutput: "", isHidden: false, weight: 1 }];
  }
  return base;
}

function withType(question: QuestionInput, type: QuestionType): QuestionInput {
  const seeded = blankQuestion(type);
  return {
    ...question,
    type,
    options: type === "mcq" || type === "multiple_select" || type === "true_false" ? (question.options.length >= 2 ? question.options : seeded.options) : [],
    coding: type === "coding" ? (question.coding ?? seeded.coding) : null,
    testCases: type === "coding" ? (question.testCases?.length ? question.testCases : seeded.testCases) : [],
  };
}

function toInput(question: EditableQuestion): QuestionInput {
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    options: question.options.map((option) => ({ id: option.id, text: option.text, isCorrect: option.isCorrect })),
    marks: question.marks,
    negativeMarks: question.negativeMarks,
    explanation: question.explanation ?? "",
    acceptedAnswers: question.acceptedAnswers ?? [],
    caseSensitive: question.caseSensitive,
    numericAnswer: question.numericAnswer,
    numericTolerance: question.numericTolerance,
    partialCredit: question.partialCredit,
    modelAnswer: question.modelAnswer ?? "",
    coding: question.coding,
    testCases: question.testCases ?? [],
  };
}

function QuestionEditor({
  colors,
  question,
  index,
  total,
  locked,
  onChange,
  onRemove,
  onMove,
}: {
  colors: Colors;
  question: QuestionInput;
  index: number;
  total: number;
  locked: boolean;
  onChange: (next: QuestionInput) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const set = (patch: Partial<QuestionInput>) => onChange({ ...question, ...patch });
  const coding = question.coding ?? { languages: ["python"], starterCode: {}, timeLimitMs: 3000, memoryLimitMb: 256 };
  const starterLanguage = coding.languages[0] ?? "python";
  const editable = !locked;

  const setOptionText = (optionIndex: number, text: string) =>
    set({ options: question.options.map((option, i) => (i === optionIndex ? { ...option, text } : option)) });
  const setOptionCorrect = (optionIndex: number, isCorrect: boolean) => {
    if (question.type === "mcq") {
      set({ options: question.options.map((option, i) => ({ ...option, isCorrect: i === optionIndex ? isCorrect : false })) });
    } else {
      set({ options: question.options.map((option, i) => (i === optionIndex ? { ...option, isCorrect } : option)) });
    }
  };

  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={[styles.questionHeading, { color: colors.foreground }]}>Question {index + 1}</Text>
        <View style={styles.rowGap}>
          <OutlineButton label="↑" onPress={() => onMove(-1)} disabled={!editable || index === 0} />
          <OutlineButton label="↓" onPress={() => onMove(1)} disabled={!editable || index === total - 1} />
          <OutlineButton label="Remove" onPress={onRemove} disabled={!editable} />
        </View>
      </View>

      <FieldLabel colors={colors}>Question type</FieldLabel>
      <View style={styles.chips}>
        {QUESTION_TYPES.map((type) => (
          <Chip key={type} colors={colors} label={QUESTION_TYPE_LABELS[type]} selected={question.type === type} disabled={!editable} onPress={() => onChange(withType(question, type))} />
        ))}
      </View>

      <FieldLabel colors={colors}>Prompt</FieldLabel>
      <TextField colors={colors} value={question.prompt} onChangeText={(text) => set({ prompt: text })} placeholder="Write the question…" multiline editable={editable} />

      <View style={styles.twoCol}>
        <View style={styles.flex1}>
          <FieldLabel colors={colors}>Marks</FieldLabel>
          <TextField colors={colors} value={String(question.marks)} onChangeText={(text) => set({ marks: Number(text) || 0 })} keyboardType="decimal-pad" editable={editable} />
        </View>
        <View style={styles.flex1}>
          <FieldLabel colors={colors}>Negative marks</FieldLabel>
          <TextField colors={colors} value={String(question.negativeMarks)} onChangeText={(text) => set({ negativeMarks: Number(text) || 0 })} keyboardType="decimal-pad" editable={editable} />
        </View>
      </View>

      {(question.type === "mcq" || question.type === "multiple_select") && (
        <View style={styles.gap}>
          <FieldLabel colors={colors}>Options — tap “Correct” for the right answer{question.type === "multiple_select" ? "s" : ""}</FieldLabel>
          {question.options.map((option, optionIndex) => (
            <View key={optionIndex} style={styles.optionRow}>
              <View style={styles.flex1}>
                <TextField colors={colors} value={option.text} onChangeText={(text) => setOptionText(optionIndex, text)} placeholder={`Option ${optionIndex + 1}`} editable={editable} />
              </View>
              <Chip colors={colors} label={option.isCorrect ? "✓ Correct" : "Correct"} selected={option.isCorrect} disabled={!editable} onPress={() => setOptionCorrect(optionIndex, !option.isCorrect)} />
              <OutlineButton label="✕" disabled={!editable || question.options.length <= 2} onPress={() => set({ options: question.options.filter((_, i) => i !== optionIndex) })} />
            </View>
          ))}
          <OutlineButton label="Add option" disabled={!editable || question.options.length >= 12} onPress={() => set({ options: [...question.options, { text: "", isCorrect: false }] })} />
          {question.type === "multiple_select" ? (
            <ToggleRow colors={colors} label="Partial credit" detail="Award proportional marks for partially correct selections." value={Boolean(question.partialCredit)} disabled={!editable} onValueChange={(next) => set({ partialCredit: next })} />
          ) : null}
        </View>
      )}

      {question.type === "true_false" && (
        <View style={styles.gap}>
          <FieldLabel colors={colors}>The statement is…</FieldLabel>
          <View style={styles.chips}>
            <Chip
              colors={colors}
              label="True"
              selected={question.options.find((option) => option.text === "True")?.isCorrect ?? false}
              disabled={!editable}
              onPress={() =>
                set({
                  options: [
                    { text: "True", isCorrect: true },
                    { text: "False", isCorrect: false },
                  ],
                })
              }
            />
            <Chip
              colors={colors}
              label="False"
              selected={question.options.find((option) => option.text === "False")?.isCorrect ?? false}
              disabled={!editable}
              onPress={() =>
                set({
                  options: [
                    { text: "True", isCorrect: false },
                    { text: "False", isCorrect: true },
                  ],
                })
              }
            />
          </View>
        </View>
      )}

      {question.type === "numerical" && (
        <View style={styles.twoCol}>
          <View style={styles.flex1}>
            <FieldLabel colors={colors}>Correct answer</FieldLabel>
            <TextField
              colors={colors}
              value={question.numericAnswer === null || question.numericAnswer === undefined ? "" : String(question.numericAnswer)}
              onChangeText={(text) => set({ numericAnswer: text.trim() === "" ? null : Number(text) })}
              keyboardType="decimal-pad"
              placeholder="e.g. 42"
              editable={editable}
            />
          </View>
          <View style={styles.flex1}>
            <FieldLabel colors={colors}>Tolerance (±)</FieldLabel>
            <TextField colors={colors} value={String(question.numericTolerance ?? 0)} onChangeText={(text) => set({ numericTolerance: Number(text) || 0 })} keyboardType="decimal-pad" editable={editable} />
          </View>
        </View>
      )}

      {(question.type === "short_answer" || question.type === "fill_blank") && (
        <View style={styles.gap}>
          <FieldLabel colors={colors}>Accepted answers (one per line, or comma separated)</FieldLabel>
          <TextField
            colors={colors}
            value={(question.acceptedAnswers ?? []).join("\n")}
            onChangeText={(text) => set({ acceptedAnswers: text.split(/[\n,]/).map((answer) => answer.trim()).filter(Boolean) })}
            placeholder={"Paris\nparis, France"}
            multiline
            editable={editable}
          />
          <ToggleRow colors={colors} label="Case sensitive" value={Boolean(question.caseSensitive)} disabled={!editable} onValueChange={(next) => set({ caseSensitive: next })} />
        </View>
      )}

      {(question.type === "long_answer" || question.type === "file_upload") && (
        <View style={styles.gap}>
          <FieldLabel colors={colors}>Model answer (optional, shown to you when grading)</FieldLabel>
          <TextField colors={colors} value={question.modelAnswer ?? ""} onChangeText={(text) => set({ modelAnswer: text })} placeholder="What a full-marks answer looks like…" multiline editable={editable} />
        </View>
      )}

      {question.type === "coding" && (
        <View style={styles.gap}>
          <FieldLabel colors={colors}>Languages</FieldLabel>
          <View style={styles.chips}>
            {CODING_LANGUAGE_IDS.map((language) => {
              const selected = coding.languages.includes(language);
              return (
                <Chip
                  key={language}
                  colors={colors}
                  label={CODING_LANGUAGE_LABELS[language] ?? language}
                  selected={selected}
                  disabled={!editable}
                  onPress={() =>
                    set({
                      coding: {
                        ...coding,
                        languages: selected ? coding.languages.filter((item) => item !== language) : [...coding.languages, language],
                      },
                    })
                  }
                />
              );
            })}
          </View>
          <FieldLabel colors={colors}>Starter code ({CODING_LANGUAGE_LABELS[starterLanguage] ?? starterLanguage})</FieldLabel>
          <TextField
            colors={colors}
            value={coding.starterCode[starterLanguage] ?? ""}
            onChangeText={(text) => set({ coding: { ...coding, starterCode: { ...coding.starterCode, [starterLanguage]: text } } })}
            placeholder="// Starter code shown to students"
            multiline
            editable={editable}
          />
          <View style={styles.twoCol}>
            <View style={styles.flex1}>
              <FieldLabel colors={colors}>Time limit (ms)</FieldLabel>
              <TextField colors={colors} value={String(coding.timeLimitMs)} onChangeText={(text) => set({ coding: { ...coding, timeLimitMs: Number(text) || 3000 } })} keyboardType="numeric" editable={editable} />
            </View>
            <View style={styles.flex1}>
              <FieldLabel colors={colors}>Memory (MB)</FieldLabel>
              <TextField colors={colors} value={String(coding.memoryLimitMb)} onChangeText={(text) => set({ coding: { ...coding, memoryLimitMb: Number(text) || 256 } })} keyboardType="numeric" editable={editable} />
            </View>
          </View>
          <FieldLabel colors={colors}>Test cases</FieldLabel>
          {(question.testCases ?? []).map((testCase, caseIndex) => (
            <View key={caseIndex} style={[styles.caseBox, { borderColor: colors.border }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Case {caseIndex + 1}</Text>
                <OutlineButton label="Remove" disabled={!editable || (question.testCases ?? []).length <= 1} onPress={() => set({ testCases: (question.testCases ?? []).filter((_, i) => i !== caseIndex) })} />
              </View>
              <FieldLabel colors={colors}>Input (stdin)</FieldLabel>
              <TextField
                colors={colors}
                value={testCase.input}
                onChangeText={(text) => set({ testCases: (question.testCases ?? []).map((item, i) => (i === caseIndex ? { ...item, input: text } : item)) })}
                multiline
                editable={editable}
              />
              <FieldLabel colors={colors}>Expected output</FieldLabel>
              <TextField
                colors={colors}
                value={testCase.expectedOutput}
                onChangeText={(text) => set({ testCases: (question.testCases ?? []).map((item, i) => (i === caseIndex ? { ...item, expectedOutput: text } : item)) })}
                multiline
                editable={editable}
              />
              <View style={styles.twoCol}>
                <View style={styles.flex1}>
                  <FieldLabel colors={colors}>Weight</FieldLabel>
                  <TextField
                    colors={colors}
                    value={String(testCase.weight)}
                    onChangeText={(text) => set({ testCases: (question.testCases ?? []).map((item, i) => (i === caseIndex ? { ...item, weight: Number(text) || 1 } : item)) })}
                    keyboardType="decimal-pad"
                    editable={editable}
                  />
                </View>
                <View style={styles.flex1}>
                  <ToggleRow
                    colors={colors}
                    label="Hidden"
                    value={testCase.isHidden}
                    disabled={!editable}
                    onValueChange={(next) => set({ testCases: (question.testCases ?? []).map((item, i) => (i === caseIndex ? { ...item, isHidden: next } : item)) })}
                  />
                </View>
              </View>
            </View>
          ))}
          <OutlineButton label="Add test case" disabled={!editable} onPress={() => set({ testCases: [...(question.testCases ?? []), { input: "", expectedOutput: "", isHidden: true, weight: 1 }] })} />
        </View>
      )}

      <FieldLabel colors={colors}>Explanation (optional)</FieldLabel>
      <TextField colors={colors} value={question.explanation ?? ""} onChangeText={(text) => set({ explanation: text })} placeholder="Why the answer is correct…" multiline editable={editable} />
    </Card>
  );
}

export default function TestEditorScreen() {
  const params = useLocalSearchParams<{ id: string; classroomId?: string }>();
  const isNew = params.id === "new";
  const colors = useColors();
  const [testId, setTestId] = useState<string | null>(isNew ? null : (params.id ?? null));
  const [status, setStatus] = useState<TestStatus>("draft");
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [durationText, setDurationText] = useState("45");
  const [passingText, setPassingText] = useState("");
  const [examMode, setExamMode] = useState<ExamMode>("standard");
  const [startText, setStartText] = useState("");
  const [endText, setEndText] = useState("");
  const [config, setConfig] = useState<TestConfig>({ ...DEFAULT_TEST_CONFIG });
  const [security, setSecurity] = useState<TestSecurity>({ ...DEFAULT_TEST_SECURITY });

  const [questions, setQuestions] = useState<QuestionInput[]>([]);
  const [questionsLocked, setQuestionsLocked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [aiTopic, setAiTopic] = useState("");
  const [aiCountText, setAiCountText] = useState("5");
  const [aiMarksText, setAiMarksText] = useState("20");
  const [aiDifficulty, setAiDifficulty] = useState<"Easy" | "Medium" | "Hard" | "Adaptive">("Medium");
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (isNew || !params.id) return;
    setLoading(true);
    try {
      const detail = await getTeacherTest(params.id);
      setTestId(detail.id);
      setStatus(detail.status);
      setTitle(detail.title);
      setSubject(detail.subject ?? "");
      setDescription(detail.description ?? "");
      setInstructions(detail.instructions ?? "");
      setDurationText(String(detail.durationMinutes));
      setPassingText(detail.passingMarks === null ? "" : String(detail.passingMarks));
      setExamMode(detail.examMode);
      setStartText(detail.scheduledStart ?? "");
      setEndText(detail.scheduledEnd ?? "");
      setConfig({ ...DEFAULT_TEST_CONFIG, ...detail.config });
      setSecurity({ ...DEFAULT_TEST_SECURITY, ...detail.security, thresholds: { ...DEFAULT_TEST_SECURITY.thresholds, ...(detail.security?.thresholds ?? {}) } });
      setQuestions(detail.questions.map(toInput));
      setQuestionsLocked(detail.questionsLocked);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "This test could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [isNew, params.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const buildMeta = (): TestMetaInput | null => {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3 || trimmedTitle.length > 250) {
      Alert.alert("Check the title", "The title needs between 3 and 250 characters.");
      return null;
    }
    const duration = Number(durationText);
    if (!Number.isInteger(duration) || duration < 1 || duration > 600) {
      Alert.alert("Check the duration", "Duration must be a whole number of minutes between 1 and 600.");
      return null;
    }
    const passing = passingText.trim() === "" ? null : Number(passingText);
    if (passing !== null && (!Number.isFinite(passing) || passing < 0)) {
      Alert.alert("Check passing marks", "Passing marks must be a number of 0 or more, or left blank.");
      return null;
    }
    const parseSchedule = (text: string, label: string): string | null | undefined => {
      const trimmed = text.trim();
      if (!trimmed) return null;
      if (Number.isNaN(Date.parse(trimmed))) {
        Alert.alert(`Check the ${label}`, "Use an ISO date-time such as 2026-11-10T09:00:00+05:30.");
        return undefined;
      }
      return trimmed;
    };
    const scheduledStart = parseSchedule(startText, "start time");
    if (scheduledStart === undefined) return null;
    const scheduledEnd = parseSchedule(endText, "end time");
    if (scheduledEnd === undefined) return null;
    if (scheduledStart && scheduledEnd && new Date(scheduledStart) >= new Date(scheduledEnd)) {
      Alert.alert("Check the schedule", "The end time must be after the start time.");
      return null;
    }
    return {
      title: trimmedTitle,
      subject: subject.trim() || null,
      description: description.trim() || null,
      instructions: instructions.trim() || null,
      durationMinutes: duration,
      passingMarks: passing,
      examMode,
      scheduledStart,
      scheduledEnd,
      config,
      security,
    };
  };

  const saveMeta = async () => {
    const meta = buildMeta();
    if (!meta) return;
    setSavingMeta(true);
    try {
      if (!testId) {
        if (!params.classroomId) throw new Error("Open this editor from a classroom to create a test.");
        const created = await createTest(params.classroomId, meta);
        setTestId(created.id);
        setStatus(created.status);
        router.replace({ pathname: "/test-editor/[id]", params: { id: created.id } } as never);
        setNotice("Test created as a draft. Add questions below, save them, then publish.");
      } else {
        const updated = await updateTestMeta(testId, meta);
        setStatus(updated.status);
        setNotice("Test details saved to the shared NeuroClass database.");
      }
    } catch (nextError) {
      Alert.alert("Could not save", nextError instanceof Error ? nextError.message : "Please try again.");
    } finally {
      setSavingMeta(false);
    }
  };

  const saveQuestions = async () => {
    if (!testId) {
      Alert.alert("Save the test first", "Save the test details above to create the test, then save its questions.");
      return;
    }
    for (let index = 0; index < questions.length; index += 1) {
      const problem = validateQuestion(questions[index], index);
      if (problem) {
        Alert.alert("Check your questions", problem);
        return;
      }
    }
    if (examMode === "coding" && !questions.some((question) => question.type === "coding")) {
      Alert.alert("Coding exam", "A coding exam needs at least one coding question.");
      return;
    }
    setSavingQuestions(true);
    try {
      const detail = await replaceTestQuestions(testId, questions);
      setQuestions(detail.questions.map(toInput));
      setNotice(`${detail.questions.length} question(s) saved. Total marks: ${detail.totalMarks}.`);
    } catch (nextError) {
      Alert.alert("Could not save questions", nextError instanceof Error ? nextError.message : "Please try again.");
    } finally {
      setSavingQuestions(false);
    }
  };

  const publish = async () => {
    if (!testId) {
      Alert.alert("Save the test first", "Save the test details above to create the test, then publish it.");
      return;
    }
    if (questions.length === 0) {
      Alert.alert("Nothing to publish", "Add at least one question and save the questions before publishing.");
      return;
    }
    setPublishing(true);
    try {
      const result = await publishTest(testId, {
        scheduledStart: startText.trim() ? startText.trim() : null,
        scheduledEnd: endText.trim() ? endText.trim() : null,
      });
      setStatus(result.status);
      setNotice("Published. Students in this classroom can now see the test.");
    } catch (nextError) {
      Alert.alert("Could not publish", nextError instanceof Error ? nextError.message : "Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  const generateWithAi = async () => {
    const topic = aiTopic.trim() || title.trim();
    if (!topic) {
      Alert.alert("Add a topic", "Enter a topic for the AI generator (or give the test a title first).");
      return;
    }
    const questionCount = Number(aiCountText);
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 20) {
      Alert.alert("Check the count", "The AI can generate between 1 and 20 questions at a time.");
      return;
    }
    const totalMarks = Number(aiMarksText);
    if (!Number.isInteger(totalMarks) || totalMarks < questionCount || totalMarks > 500) {
      Alert.alert("Check total marks", "Total marks must be a whole number, at least the question count, and at most 500.");
      return;
    }
    setGenerating(true);
    try {
      const result = await generateTestWithAi({
        topic,
        subject: subject.trim() || topic,
        difficulty: aiDifficulty,
        questionCount,
        durationMins: Number(durationText) || 45,
        totalMarks,
        instructions: instructions.trim() || undefined,
      });
      const mapped = mapGeneratedQuestions(result.test);
      if (mapped.length === 0) {
        Alert.alert("Nothing usable", "The AI response did not contain questions that could be added. Try a clearer topic.");
        return;
      }
      setQuestions((current) => [...current, ...mapped]);
      setNotice(`${mapped.length} AI-generated question(s) added below. Review them, then tap “Save questions”.`);
    } catch (nextError) {
      Alert.alert("AI generation failed", nextError instanceof Error ? nextError.message : "Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <LoadingState label="Loading test…" />;
  if (error && !testId)
    return (
      <ScreenContainer className="px-5" containerClassName="bg-background">
        <EmptyState title="Test unavailable" detail={error} action={<PrimaryButton label="Go back" onPress={() => router.back()} />} />
      </ScreenContainer>
    );

  const totalMarks = questions.reduce((sum, question) => sum + (Number(question.marks) || 0), 0);
  const setConfigValue = (patch: Partial<TestConfig>) => setConfig((current) => ({ ...current, ...patch }));
  const setSecurityValue = (patch: Partial<TestSecurity>) => setSecurity((current) => ({ ...current, ...patch }));

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
        </Pressable>
        <ScreenTitle
          eyebrow={isNew ? "New test" : "Test editor"}
          title={isNew ? "Create a test" : "Edit test"}
          subtitle="The same test designer data as the web app — saved tests appear in both places."
          action={<Pill label={status} tone={status === "published" ? "success" : status === "closed" ? "warning" : "primary"} />}
        />
        {notice ? (
          <Card>
            <Text style={[styles.detail, { color: colors.success }]}>{notice}</Text>
          </Card>
        ) : null}
        {questionsLocked ? (
          <Card>
            <Text style={[styles.detail, { color: colors.warning }]}>
              Students have already started this test, so its questions are locked. You can still update the title, description and schedule; duplicate the test to change questions.
            </Text>
          </Card>
        ) : null}

        <Text style={[uiStyles.sectionLabel, { color: colors.muted }]}>Test details</Text>
        <Card>
          <FieldLabel colors={colors}>Title</FieldLabel>
          <TextField colors={colors} value={title} onChangeText={setTitle} placeholder="e.g. Algebra — Chapter 4 quiz" />
          <FieldLabel colors={colors}>Subject</FieldLabel>
          <TextField colors={colors} value={subject} onChangeText={setSubject} placeholder="e.g. Mathematics" />
          <FieldLabel colors={colors}>Description</FieldLabel>
          <TextField colors={colors} value={description} onChangeText={setDescription} placeholder="What this test covers…" multiline />
          <FieldLabel colors={colors}>Instructions for students</FieldLabel>
          <TextField colors={colors} value={instructions} onChangeText={setInstructions} placeholder="Answer all questions…" multiline />
          <View style={styles.twoCol}>
            <View style={styles.flex1}>
              <FieldLabel colors={colors}>Duration (minutes)</FieldLabel>
              <TextField colors={colors} value={durationText} onChangeText={setDurationText} keyboardType="numeric" placeholder="45" />
            </View>
            <View style={styles.flex1}>
              <FieldLabel colors={colors}>Passing marks (optional)</FieldLabel>
              <TextField colors={colors} value={passingText} onChangeText={setPassingText} keyboardType="decimal-pad" placeholder="—" />
            </View>
          </View>
          <FieldLabel colors={colors}>Exam mode</FieldLabel>
          <View style={styles.chips}>
            <Chip colors={colors} label="Standard" selected={examMode === "standard"} onPress={() => setExamMode("standard")} />
            <Chip colors={colors} label="Coding" selected={examMode === "coding"} onPress={() => setExamMode("coding")} />
          </View>
          <FieldLabel colors={colors}>Scheduled start (optional, ISO)</FieldLabel>
          <TextField colors={colors} value={startText} onChangeText={setStartText} placeholder="2026-11-10T09:00:00+05:30" />
          <FieldLabel colors={colors}>Scheduled end (optional, ISO)</FieldLabel>
          <TextField colors={colors} value={endText} onChangeText={setEndText} placeholder="2026-11-10T11:00:00+05:30" />
        </Card>

        <Text style={[uiStyles.sectionLabel, { color: colors.muted }]}>Marking & attempts</Text>
        <Card>
          <View style={styles.toggleRow}>
            <View style={styles.copy}>
              <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Attempt limit</Text>
              <Text style={[styles.itemDetail, { color: colors.muted }]}>How many times a student may take this test (1–10).</Text>
            </View>
            <View style={styles.rowGap}>
              <OutlineButton label="−" onPress={() => setConfigValue({ attemptLimit: Math.max(1, config.attemptLimit - 1) })} disabled={config.attemptLimit <= 1} />
              <Text style={[styles.stepperValue, { color: colors.foreground }]}>{config.attemptLimit}</Text>
              <OutlineButton label="+" onPress={() => setConfigValue({ attemptLimit: Math.min(10, config.attemptLimit + 1) })} disabled={config.attemptLimit >= 10} />
            </View>
          </View>
          <ToggleRow colors={colors} label="Shuffle questions" value={config.shuffleQuestions} onValueChange={(next) => setConfigValue({ shuffleQuestions: next })} />
          <ToggleRow colors={colors} label="Shuffle options" value={config.shuffleOptions} onValueChange={(next) => setConfigValue({ shuffleOptions: next })} />
          <ToggleRow colors={colors} label="Negative marking" detail="Apply each question's negative marks for wrong objective answers." value={config.negativeMarking} onValueChange={(next) => setConfigValue({ negativeMarking: next })} />
          <ToggleRow colors={colors} label="Allow back navigation" value={config.allowBackNavigation} onValueChange={(next) => setConfigValue({ allowBackNavigation: next })} />
          <ToggleRow colors={colors} label="Release results immediately" value={config.releaseResultsImmediately} onValueChange={(next) => setConfigValue({ releaseResultsImmediately: next })} />
          <ToggleRow colors={colors} label="Show correct answers" detail="Let students see the correct answers once results are released." value={config.showCorrectAnswers} onValueChange={(next) => setConfigValue({ showCorrectAnswers: next })} />
        </Card>

        <Text style={[uiStyles.sectionLabel, { color: colors.muted }]}>Proctoring</Text>
        <Card>
          <ToggleRow colors={colors} label="Require camera" value={security.requireCamera} onValueChange={(next) => setSecurityValue({ requireCamera: next })} />
          <ToggleRow colors={colors} label="Require identity verification" detail="Students verify with Face ID before starting." value={security.requireIdentityVerification} onValueChange={(next) => setSecurityValue({ requireIdentityVerification: next })} />
          <ToggleRow colors={colors} label="Live proctoring" value={security.liveProctoring} onValueChange={(next) => setSecurityValue({ liveProctoring: next })} />
          <ToggleRow colors={colors} label="Liveness check" value={security.livenessCheck} onValueChange={(next) => setSecurityValue({ livenessCheck: next })} />
          <ToggleRow colors={colors} label="Require fullscreen" value={security.requireFullscreen} onValueChange={(next) => setSecurityValue({ requireFullscreen: next })} />
          <ToggleRow colors={colors} label="Tab switch detection" value={security.tabSwitchDetection} onValueChange={(next) => setSecurityValue({ tabSwitchDetection: next })} />
          <ToggleRow colors={colors} label="Block clipboard" value={security.blockClipboard} onValueChange={(next) => setSecurityValue({ blockClipboard: next })} />
        </Card>
        <PrimaryButton label={testId ? "Save test details" : "Create test"} onPress={() => void saveMeta()} loading={savingMeta} />

        <Text style={[uiStyles.sectionLabel, { color: colors.muted }]}>Generate with AI</Text>
        <Card>
          <FieldLabel colors={colors}>Topic</FieldLabel>
          <TextField colors={colors} value={aiTopic} onChangeText={setAiTopic} placeholder="e.g. Quadratic equations" />
          <View style={styles.twoCol}>
            <View style={styles.flex1}>
              <FieldLabel colors={colors}>Questions (1–20)</FieldLabel>
              <TextField colors={colors} value={aiCountText} onChangeText={setAiCountText} keyboardType="numeric" />
            </View>
            <View style={styles.flex1}>
              <FieldLabel colors={colors}>Total marks</FieldLabel>
              <TextField colors={colors} value={aiMarksText} onChangeText={setAiMarksText} keyboardType="numeric" />
            </View>
          </View>
          <FieldLabel colors={colors}>Difficulty</FieldLabel>
          <View style={styles.chips}>
            {(["Easy", "Medium", "Hard", "Adaptive"] as const).map((level) => (
              <Chip key={level} colors={colors} label={level} selected={aiDifficulty === level} onPress={() => setAiDifficulty(level)} />
            ))}
          </View>
          <PrimaryButton label="Generate questions" onPress={() => void generateWithAi()} loading={generating} disabled={questionsLocked} />
          <Text style={[styles.itemDetail, { color: colors.muted }]}>Generated questions are appended below for you to review and edit before saving.</Text>
        </Card>

        <View style={styles.rowBetween}>
          <Text style={[uiStyles.sectionLabel, { color: colors.muted }]}>Questions · {questions.length} · {totalMarks} marks</Text>
          <OutlineButton label="Add question" disabled={questionsLocked} onPress={() => setQuestions((current) => [...current, blankQuestion(examMode === "coding" ? "coding" : "mcq")])} />
        </View>
        <View style={styles.stack}>
          {questions.map((question, index) => (
            <QuestionEditor
              key={question.id ?? `draft-${index}`}
              colors={colors}
              question={question}
              index={index}
              total={questions.length}
              locked={questionsLocked}
              onChange={(next) => setQuestions((current) => current.map((item, i) => (i === index ? next : item)))}
              onRemove={() => setQuestions((current) => current.filter((_, i) => i !== index))}
              onMove={(direction) =>
                setQuestions((current) => {
                  const target = index + direction;
                  if (target < 0 || target >= current.length) return current;
                  const next = [...current];
                  [next[index], next[target]] = [next[target], next[index]];
                  return next;
                })
              }
            />
          ))}
        </View>
        {questions.length === 0 ? (
          <EmptyState title="No questions yet" detail="Add questions manually, or generate a first set with AI above." />
        ) : null}
        <PrimaryButton label="Save questions" onPress={() => void saveQuestions()} loading={savingQuestions} disabled={questionsLocked || !testId} />
        {status !== "published" ? (
          <PrimaryButton label="Publish test" onPress={() => void publish()} loading={publishing} disabled={!testId} />
        ) : (
          <Card>
            <Text style={[styles.detail, { color: colors.muted }]}>This test is published. Use the Tests list to unpublish, close or release results.</Text>
          </Card>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: 18, paddingBottom: 32, gap: 14 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stack: { gap: 10 },
  gap: { gap: 10 },
  detail: { fontSize: 14, lineHeight: 21 },
  itemDetail: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  multiline: { minHeight: 96, paddingTop: 12, textAlignVertical: "top" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rowGap: { flexDirection: "row", alignItems: "center", gap: 8 },
  twoCol: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1, minWidth: 0 },
  copy: { flex: 1, minWidth: 0 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 4 },
  toggleLabel: { fontSize: 14, fontWeight: "700" },
  stepperValue: { fontSize: 16, fontWeight: "800", minWidth: 24, textAlign: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipLabel: { fontSize: 13, fontWeight: "700" },
  questionHeading: { fontSize: 16, fontWeight: "800" },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  caseBox: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
});
