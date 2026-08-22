import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, OutlineButton, PrimaryButton } from "@/components/neuroclass-ui";
import { useColors } from "@/hooks/use-colors";
import { neuroClassApi, neuroClassMultipart } from "@/lib/neuroclass-api";
import type { ClassroomMaterial } from "@/lib/neuroclass-types";

type MaterialsResponse = { materials: ClassroomMaterial[] };
type AnalyticsResponse = { analytics: { threadCount: number; messageCount: number; feedbackCount: number; materialCount: number; readyMaterialCount: number } };
type TutorResponse = { threadId?: string; answer?: { answer?: string; confidence?: string; answerState?: string; followUp?: string }; sources?: string[] };

export function ClassroomResources({ classroomId, role }: { classroomId: string; role: "teacher" | "student" }) {
  const colors = useColors();
  const [materials, setMaterials] = useState<ClassroomMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse["analytics"] | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<TutorResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await neuroClassApi<MaterialsResponse>(`/api/materials?classroomId=${encodeURIComponent(classroomId)}`);
      setMaterials(payload.materials ?? []);
      if (role === "teacher") {
        const report = await neuroClassApi<AnalyticsResponse>(`/api/ai/classroom-analytics?classroomId=${encodeURIComponent(classroomId)}`);
        setAnalytics(report.analytics);
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Resources could not be loaded."); }
    finally { setLoading(false); }
  }, [classroomId, role]);

  useEffect(() => { void load(); }, [load]);

  const upload = async () => {
    const pick = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "text/plain", "text/markdown", "text/csv", "application/json", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      copyToCacheDirectory: true,
    });
    if (pick.canceled) return;
    const asset = pick.assets[0];
    if (asset.size && asset.size > 15 * 1024 * 1024) {
      Alert.alert("Material too large", "Choose a PDF, DOCX, TXT, Markdown, CSV, or JSON file under 15 MB.");
      return;
    }
    setBusy(true); setNotice(null);
    try {
      const form = new FormData();
      form.append("classroomId", classroomId);
      if (Platform.OS === "web" && asset.file) form.append("file", asset.file);
      else form.append("file", { uri: asset.uri, name: asset.name, type: asset.mimeType || "application/octet-stream" } as unknown as Blob);
      const payload = await neuroClassMultipart<{ message?: string }>("/api/materials", form);
      setNotice(payload.message || "Material uploaded to the shared classroom knowledge base.");
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Material upload failed."); }
    finally { setBusy(false); }
  };

  const askTutor = async () => {
    if (!question.trim()) return;
    const prompt = question.trim();
    setBusy(true); setNotice(null);
    try {
      const payload = await neuroClassApi<TutorResponse>("/api/ai/classroom-answer", { method: "POST", body: { classroomId, question: prompt, learnerProfile: { preferredStyle: "step-by-step" } } });
      setAnswer(payload); setQuestion("");
    } catch (error) { setNotice(error instanceof Error ? error.message : "The classroom assistant could not answer."); }
    finally { setBusy(false); }
  };

  return <View style={styles.stack}>
    <View style={styles.heading}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Classroom materials</Text>{role === "teacher" ? <OutlineButton label="Upload" onPress={() => void upload()} disabled={busy} /> : null}</View>
    <Card>
      <Text style={[styles.explainer, { color: colors.muted }]}>{role === "teacher" ? "Upload approved learning resources. The existing secure backend applies classroom ownership, storage, and extraction controls." : "These are the materials shared with your enrolled classroom."}</Text>
      {loading ? <Text style={[styles.meta, { color: colors.muted }]}>Loading classroom materials…</Text> : materials.length === 0 ? <Text style={[styles.meta, { color: colors.muted }]}>No classroom materials are available yet.</Text> : <View style={styles.stack}>{materials.slice(0, 8).map((material) => <View key={material.id} style={[styles.material, { borderColor: colors.border }]}><View style={{ flex: 1 }}><Text style={[styles.materialName, { color: colors.foreground }]} numberOfLines={1}>{material.name}</Text><Text style={[styles.meta, { color: colors.muted }]}>{Math.max(0, Math.round(material.size_bytes / 1024))} KB · {material.chunk_count} learning chunks</Text></View><Text style={[styles.status, { color: material.extraction_status === "ready" ? colors.success : material.extraction_status === "failed" ? colors.error : colors.warning }]}>{material.extraction_status === "ready" ? "Tutor ready" : material.extraction_status === "failed" ? "Needs review" : "Processing"}</Text></View>)}</View>}
      {notice ? <Text style={[styles.notice, { color: colors.primary }]}>{notice}</Text> : null}
    </Card>
    {role === "teacher" && analytics ? <Card><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Learning signals</Text><Text style={[styles.explainer, { color: colors.muted }]}>Aggregate classroom activity from the existing learning service. Student conversation content stays private.</Text><View style={styles.metrics}>{[["Threads", analytics.threadCount], ["Messages", analytics.messageCount], ["Materials", `${analytics.readyMaterialCount}/${analytics.materialCount}`]].map(([label, value]) => <View key={label as string} style={[styles.metric, { backgroundColor: `${colors.primary}10` }]}><Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text><Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text></View>)}</View></Card> : null}
    {role === "student" ? <Card><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Ask your classroom AI</Text><Text style={[styles.explainer, { color: colors.muted }]}>Answers are grounded only in processed material from this classroom. It will say when sources are insufficient.</Text><TextInput value={question} onChangeText={setQuestion} placeholder="Ask about a class concept…" placeholderTextColor={colors.muted} multiline style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} /><PrimaryButton label="Ask classroom AI" onPress={() => void askTutor()} loading={busy} disabled={!question.trim()} />{answer?.answer?.answer ? <View style={[styles.answer, { backgroundColor: `${colors.primary}0D` }]}><Text style={[styles.answerText, { color: colors.foreground }]}>{answer.answer.answer}</Text>{answer.answer.followUp ? <Text style={[styles.meta, { color: colors.muted }]}>Next step: {answer.answer.followUp}</Text> : null}</View> : null}</Card> : null}
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: 10 }, heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 3 }, sectionTitle: { fontSize: 18, fontWeight: "800" }, explainer: { fontSize: 13, lineHeight: 19 }, meta: { fontSize: 12, lineHeight: 17 }, material: { flexDirection: "row", gap: 10, alignItems: "center", borderTopWidth: 1, paddingTop: 10 }, materialName: { fontSize: 14, fontWeight: "800" }, status: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" }, notice: { fontSize: 12, lineHeight: 18, fontWeight: "700" }, metrics: { flexDirection: "row", gap: 8, marginTop: 12 }, metric: { flex: 1, borderRadius: 12, padding: 10 }, metricValue: { fontSize: 18, fontWeight: "900" }, metricLabel: { fontSize: 10, fontWeight: "700", marginTop: 2 }, input: { minHeight: 74, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14, textAlignVertical: "top" }, answer: { borderRadius: 14, padding: 12, gap: 8 }, answerText: { fontSize: 14, lineHeight: 21 },
});
