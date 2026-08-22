import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/neuroclass-ui";
import { useColors } from "@/hooks/use-colors";
import { neuroClassMultipart } from "@/lib/neuroclass-api";
import { getClassroomOverview } from "@/lib/neuroclass-data";
import { useNeuroClassAuth } from "@/lib/neuroclass-auth";

export default function FaceRegistrationScreen() {
  const { classroomId } = useLocalSearchParams<{ classroomId: string }>();
  const { user, role } = useNeuroClassAuth();
  const colors = useColors();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [samples, setSamples] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const capture = async () => {
    const photo = await camera.current?.takePictureAsync({ quality: 0.72, base64: false });
    if (photo?.uri) setSamples((current) => current.length < 10 ? [...current, photo.uri] : current);
  };
  const submit = async () => {
    if (!user || role !== "student" || !classroomId || samples.length < 5) return;
    setBusy(true);
    try {
      const overview = await getClassroomOverview(classroomId, user.id, "student");
      if (!overview.studentRecord) throw new Error("Your enrollment for this classroom could not be verified.");
      const form = new FormData();
      form.append("student_id", overview.studentRecord.id);
      form.append("classroom_id", classroomId);
      form.append("registration_session_id", `mobile-${Date.now()}`);
      samples.forEach((uri, index) => form.append("files", { uri, name: `face-sample-${index + 1}.jpg`, type: "image/jpeg" } as unknown as Blob));
      const payload = await neuroClassMultipart<{ success: boolean; accepted_samples: number; rejected_samples: number; rejection_reasons?: string[] }>("/api/students/face-registration", form);
      if (!payload.success) throw new Error(payload.rejection_reasons?.join(" ") || "Face samples need to be captured again.");
      setSamples([]);
      Alert.alert("Face registration complete", `${payload.accepted_samples} samples were accepted by the secure NeuroClass attendance service.`);
      router.back();
    } catch (error) { Alert.alert("Registration could not finish", error instanceof Error ? error.message : "Please capture fresh samples and try again."); }
    finally { setBusy(false); }
  };

  if (!permission) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.muted }}>Preparing camera…</Text></View>;
  if (!permission.granted) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.foreground }]}>Camera permission is required</Text><Text style={[styles.detail, { color: colors.muted }]}>NeuroClass uses five to ten front-camera samples only for secure server-side face enrollment. No biometric embedding is created on this device.</Text><PrimaryButton label="Allow camera" onPress={() => void requestPermission()} /></View>;
  return <View style={[styles.root, { backgroundColor: colors.background }]}><CameraView ref={camera} style={styles.camera} facing="front" mirror /><View style={styles.overlay}><Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>Close</Text></Pressable><View style={styles.copy}><Text style={styles.eyebrow}>SECURE FACE ENROLLMENT</Text><Text style={styles.title}>Capture varied, clear angles</Text><Text style={styles.detail}>Take {Math.max(0, 5 - samples.length)} more sample{Math.max(0, 5 - samples.length) === 1 ? "" : "s"} to enable submission. Samples are uploaded only to the existing secure backend.</Text></View><View style={styles.controls}><Text style={styles.counter}>{samples.length}/10 samples</Text><PrimaryButton label={samples.length >= 5 ? "Submit secure samples" : "Capture sample"} tone="secondary" onPress={() => { if (samples.length >= 5) void submit(); else void capture(); }} loading={busy} disabled={Platform.OS === "web" && !camera.current} /><Pressable onPress={() => setSamples([])} disabled={!samples.length}><Text style={[styles.reset, { opacity: samples.length ? 1 : 0.45 }]}>Clear samples</Text></Pressable></View></View></View>;
}

const styles = StyleSheet.create({ root: { flex: 1 }, camera: { flex: 1 }, overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between", padding: 22, paddingTop: 64, backgroundColor: "rgba(9,13,28,0.28)" }, back: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12 }, backText: { color: "#FFFFFF", fontWeight: "800" }, copy: { gap: 5 }, eyebrow: { color: "#C7D2FE", fontSize: 11, fontWeight: "900", letterSpacing: 1 }, title: { color: "#FFFFFF", fontSize: 26, lineHeight: 32, fontWeight: "900" }, detail: { color: "#EEF2FF", fontSize: 14, lineHeight: 20 }, controls: { gap: 10 }, counter: { color: "#FFFFFF", fontWeight: "900", textAlign: "center" }, reset: { color: "#FFFFFF", fontSize: 13, textAlign: "center", fontWeight: "700" }, center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 } });

