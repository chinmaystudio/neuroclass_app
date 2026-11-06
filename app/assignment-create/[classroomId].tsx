import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Card, OutlineButton, Pill, PrimaryButton, ScreenTitle, uiStyles } from "@/components/neuroclass-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  ASSIGNMENT_TYPES,
  CODING_LANGUAGE_IDS,
  SUPPORTED_FILE_EXTENSIONS,
  createAssignment,
  publishAssignment,
  type AssignmentTypeId,
} from "@/lib/neuroclass-tutor";
import type { Assignment } from "@/lib/neuroclass-types";

function tomorrowEndOfDayIso(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(23, 59, 0, 0);
  return date.toISOString();
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function AssignmentCreateScreen() {
  const { classroomId } = useLocalSearchParams<{ classroomId: string }>();
  const colors = useColors();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [assignmentType, setAssignmentType] = useState<AssignmentTypeId>("text");
  const [dueAt, setDueAt] = useState(tomorrowEndOfDayIso());
  const [availableFrom, setAvailableFrom] = useState("");
  const [totalMarks, setTotalMarks] = useState("100");
  const [allowLate, setAllowLate] = useState(false);
  const [penaltyPercent, setPenaltyPercent] = useState("10");
  const [maxLateDays, setMaxLateDays] = useState("3");
  const [allowResubmission, setAllowResubmission] = useState(true);
  const [maxFiles, setMaxFiles] = useState("5");
  const [maxFileSizeMb, setMaxFileSizeMb] = useState("10");
  const [acceptedTypes, setAcceptedTypes] = useState("pdf, docx, txt, png, jpg, zip");
  const [languages, setLanguages] = useState<string[]>(["python"]);

  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Assignment | null>(null);
  const [published, setPublished] = useState(false);

  const needsFileSettings = assignmentType === "file" || assignmentType === "document" || assignmentType === "mixed";
  const needsCoding = assignmentType === "coding" || assignmentType === "mixed";

  const acceptedFileTypes = useMemo(
    () =>
      acceptedTypes
        .split(",")
        .map((item) => item.trim().toLowerCase().replace(/^\./, ""))
        .filter(Boolean),
    [acceptedTypes],
  );
  const unknownTypes = useMemo(
    () => acceptedFileTypes.filter((item) => !(SUPPORTED_FILE_EXTENSIONS as readonly string[]).includes(item)),
    [acceptedFileTypes],
  );

  const toggleLanguage = (language: string) =>
    setLanguages((current) => (current.includes(language) ? current.filter((item) => item !== language) : [...current, language]));

  const validate = (): string | null => {
    if (title.trim().length < 3) return "Give the assignment a title of at least 3 characters.";
    const marks = parseNumber(totalMarks, NaN);
    if (!Number.isFinite(marks) || marks < 0 || marks > 10000) return "Total marks must be a number between 0 and 10000.";
    if (dueAt.trim() && Number.isNaN(Date.parse(dueAt.trim()))) return "The due date must be a valid ISO date, e.g. 2026-11-10T23:59:00.000Z.";
    if (availableFrom.trim() && Number.isNaN(Date.parse(availableFrom.trim()))) return "The start date must be a valid ISO date.";
    if (availableFrom.trim() && dueAt.trim() && Date.parse(availableFrom.trim()) >= Date.parse(dueAt.trim()))
      return "The due date must be after the start date.";
    if (allowLate) {
      const penalty = parseNumber(penaltyPercent, NaN);
      if (!Number.isFinite(penalty) || penalty < 0 || penalty > 100) return "Late penalty must be between 0 and 100 percent per day.";
      const days = parseNumber(maxLateDays, NaN);
      if (!Number.isFinite(days) || days < 0 || days > 60) return "Max late days must be between 0 and 60.";
    }
    if (needsFileSettings) {
      if (unknownTypes.length > 0) return `Unsupported file types: ${unknownTypes.join(", ")}. Supported: ${SUPPORTED_FILE_EXTENSIONS.join(", ")}.`;
      if (acceptedFileTypes.length === 0) return "List at least one accepted file type.";
      const files = parseNumber(maxFiles, NaN);
      if (!Number.isFinite(files) || files < 0 || files > 20) return "Max files must be between 0 and 20.";
      const size = parseNumber(maxFileSizeMb, NaN);
      if (!Number.isFinite(size) || size < 1 || size > 50) return "Max file size must be between 1 and 50 MB.";
    }
    if (needsCoding && languages.length === 0) return "Choose at least one programming language for a coding assignment.";
    return null;
  };

  const create = async () => {
    if (!classroomId || busy) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const assignment = await createAssignment(classroomId, {
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        instructions: instructions.trim() ? instructions.trim() : null,
        assignmentType,
        availableFrom: availableFrom.trim() ? new Date(availableFrom.trim()).toISOString() : null,
        dueAt: dueAt.trim() ? new Date(dueAt.trim()).toISOString() : null,
        totalMarks: parseNumber(totalMarks, 100),
        latePolicy: {
          allowLate,
          penaltyPercentPerDay: allowLate ? parseNumber(penaltyPercent, 0) : 0,
          maxLateDays: allowLate ? Math.trunc(parseNumber(maxLateDays, 0)) : 0,
        },
        acceptedFileTypes: needsFileSettings ? acceptedFileTypes : ["pdf", "docx", "txt", "png", "jpg", "zip"],
        maxFileSizeMb: needsFileSettings ? Math.trunc(parseNumber(maxFileSizeMb, 10)) : 10,
        maxFiles: needsFileSettings ? Math.trunc(parseNumber(maxFiles, 5)) : 5,
        allowResubmission,
        coding: needsCoding ? { languages } : null,
      });
      setCreated(assignment);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The assignment could not be created.");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!created || publishing) return;
    setPublishing(true);
    try {
      const updated = await publishAssignment(created.id);
      setCreated(updated);
      setPublished(true);
    } catch (nextError) {
      Alert.alert("Could not publish", nextError instanceof Error ? nextError.message : "Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  if (created) {
    return (
      <ScreenContainer className="px-5" containerClassName="bg-background">
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Pill label={published ? "published" : created.status} tone={published ? "success" : "warning"} />
          <Text style={[styles.title, { color: colors.foreground }]}>{created.title}</Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            {created.assignmentType} · {created.totalMarks} marks · saved as a draft in the shared NeuroClass database
          </Text>
          <Card>
            <Text style={[styles.detail, { color: colors.muted }]}>
              {published
                ? "This assignment is now published. Students can see it on the web and in this app."
                : "The assignment was created as a draft. Publish it now so students can see it, or publish it later from the web app."}
            </Text>
          </Card>
          <View style={styles.actions}>
            {!published ? <PrimaryButton label="Publish now" onPress={() => void publish()} loading={publishing} /> : null}
            <OutlineButton label="Done" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  const chip = (selected: boolean) => ({
    borderColor: selected ? colors.primary : colors.border,
    backgroundColor: selected ? `${colors.primary}18` : colors.surface,
  });

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
        </Pressable>
        <ScreenTitle eyebrow="Teacher" title="New assignment" subtitle="Created in the same database as the NeuroClass web app. It starts as a draft." />

        {error ? (
          <Card>
            <Text style={[styles.detail, { color: colors.error }]}>{error}</Text>
          </Card>
        ) : null}

        <View>
          <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Title</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Photosynthesis worksheet" placeholderTextColor={colors.muted} style={[uiStyles.input, styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground }]} />
        </View>

        <View>
          <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Description (optional)</Text>
          <TextInput value={description} onChangeText={setDescription} multiline placeholder="A short summary students see in the list." placeholderTextColor={colors.muted} style={[styles.textarea, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground }]} />
        </View>

        <View>
          <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Instructions (optional)</Text>
          <TextInput value={instructions} onChangeText={setInstructions} multiline placeholder="Full instructions for the work…" placeholderTextColor={colors.muted} style={[styles.textarea, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground }]} />
        </View>

        <View>
          <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Type</Text>
          <View style={styles.chipRow}>
            {ASSIGNMENT_TYPES.map((type) => (
              <Pressable key={type.id} accessibilityRole="button" onPress={() => setAssignmentType(type.id)} style={[styles.chip, chip(assignmentType === type.id)]}>
                <Text style={[styles.chipLabel, { color: assignmentType === type.id ? colors.primary : colors.foreground }]}>{type.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {needsCoding ? (
          <View>
            <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Programming languages</Text>
            <View style={styles.chipRow}>
              {CODING_LANGUAGE_IDS.map((language) => (
                <Pressable key={language} accessibilityRole="button" onPress={() => toggleLanguage(language)} style={[styles.chip, chip(languages.includes(language))]}>
                  <Text style={[styles.chipLabel, { color: languages.includes(language) ? colors.primary : colors.foreground }]}>{language}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.hint, { color: colors.muted }]}>Test cases and starter code are configured on the NeuroClass web app.</Text>
          </View>
        ) : null}

        <View>
          <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Due date (ISO)</Text>
          <TextInput value={dueAt} onChangeText={setDueAt} autoCapitalize="none" autoCorrect={false} placeholder="2026-11-10T23:59:00.000Z" placeholderTextColor={colors.muted} style={[uiStyles.input, styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground }]} />
          <View style={styles.quickRow}>
            <OutlineButton label="Tomorrow 23:59" onPress={() => setDueAt(tomorrowEndOfDayIso())} />
          </View>
        </View>

        <View>
          <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Available from (optional, ISO)</Text>
          <TextInput value={availableFrom} onChangeText={setAvailableFrom} autoCapitalize="none" autoCorrect={false} placeholder="Leave empty to make it available immediately" placeholderTextColor={colors.muted} style={[uiStyles.input, styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground }]} />
        </View>

        <View>
          <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Total marks</Text>
          <TextInput value={totalMarks} onChangeText={setTotalMarks} keyboardType="numeric" style={[uiStyles.input, styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground }]} />
        </View>

        <Card>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={[styles.switchTitle, { color: colors.foreground }]}>Allow late submissions</Text>
              <Text style={[styles.hint, { color: colors.muted }]}>Off means work submitted after the due date is blocked.</Text>
            </View>
            <Switch value={allowLate} onValueChange={setAllowLate} trackColor={{ false: colors.border, true: `${colors.primary}99` }} thumbColor={allowLate ? colors.primary : "#FFFFFF"} />
          </View>
          {allowLate ? (
            <>
              <View>
                <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Penalty per late day (%)</Text>
                <TextInput value={penaltyPercent} onChangeText={setPenaltyPercent} keyboardType="numeric" style={[uiStyles.input, styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground }]} />
              </View>
              <View>
                <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Max late days (0 = no cap)</Text>
                <TextInput value={maxLateDays} onChangeText={setMaxLateDays} keyboardType="numeric" style={[uiStyles.input, styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground }]} />
              </View>
            </>
          ) : null}
        </Card>

        <Card>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={[styles.switchTitle, { color: colors.foreground }]}>Allow resubmission</Text>
              <Text style={[styles.hint, { color: colors.muted }]}>Students can update and resubmit their work before grading.</Text>
            </View>
            <Switch value={allowResubmission} onValueChange={setAllowResubmission} trackColor={{ false: colors.border, true: `${colors.primary}99` }} thumbColor={allowResubmission ? colors.primary : "#FFFFFF"} />
          </View>
        </Card>

        {needsFileSettings ? (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>File settings</Text>
            <View>
              <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Accepted file types (comma separated)</Text>
              <TextInput value={acceptedTypes} onChangeText={setAcceptedTypes} autoCapitalize="none" autoCorrect={false} placeholder="pdf, docx, png" placeholderTextColor={colors.muted} style={[uiStyles.input, styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground }]} />
              {unknownTypes.length > 0 ? <Text style={[styles.hint, { color: colors.error }]}>Unsupported: {unknownTypes.join(", ")}</Text> : null}
            </View>
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Max files</Text>
                <TextInput value={maxFiles} onChangeText={setMaxFiles} keyboardType="numeric" style={[uiStyles.input, styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground }]} />
              </View>
              <View style={styles.col}>
                <Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Max size (MB)</Text>
                <TextInput value={maxFileSizeMb} onChangeText={setMaxFileSizeMb} keyboardType="numeric" style={[uiStyles.input, styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground }]} />
              </View>
            </View>
          </Card>
        ) : null}

        <PrimaryButton label="Create assignment" onPress={() => void create()} loading={busy} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: 18, paddingBottom: 36, gap: 16 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, lineHeight: 34, letterSpacing: -0.6, fontWeight: "900" },
  meta: { fontSize: 14, marginTop: -8 },
  detail: { fontSize: 14, lineHeight: 21 },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  input: { borderWidth: 1 },
  textarea: { borderWidth: 1, borderRadius: 14, minHeight: 84, padding: 14, fontSize: 16, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  chipLabel: { fontSize: 13, fontWeight: "700" },
  quickRow: { marginTop: 10, alignSelf: "flex-start" },
  hint: { fontSize: 12, lineHeight: 18, marginTop: 6 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  switchCopy: { flex: 1, minWidth: 0 },
  switchTitle: { fontSize: 15, fontWeight: "800" },
  twoCol: { flexDirection: "row", gap: 12 },
  col: { flex: 1 },
  actions: { gap: 10 },
});
