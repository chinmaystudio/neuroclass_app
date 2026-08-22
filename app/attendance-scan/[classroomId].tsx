import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/neuroclass-ui";
import { useColors } from "@/hooks/use-colors";
import { neuroClassApi, neuroClassMultipart } from "@/lib/neuroclass-api";
import { useNeuroClassAuth } from "@/lib/neuroclass-auth";
import type { AttendanceSession } from "@/lib/neuroclass-types";

type ActiveResponse = { session: AttendanceSession | null };
type FrameResponse = { results?: { name?: string; status?: string; confidence?: number }[] };

export default function AttendanceScanScreen() {
  const { classroomId } = useLocalSearchParams<{ classroomId: string }>();
  const { role } = useNeuroClassAuth();
  const colors = useColors();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [busy, setBusy] = useState(true);
  const [result, setResult] = useState<FrameResponse | null>(null);

  useEffect(() => { void (async () => { try { const payload = await neuroClassApi<ActiveResponse>(`/api/attendance/active?classroomId=${encodeURIComponent(classroomId)}`); setSession(payload.session); } catch { setSession(null); } finally { setBusy(false); } })(); }, [classroomId]);
  const analyze = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.72, base64: false });
      if (!photo?.uri) throw new Error("The camera is not ready yet.");
      const form = new FormData(); form.append("classroom_id", classroomId); form.append("session_id", session.id); form.append("capture_mode", "manual"); form.append("file", { uri: photo.uri, name: "attendance-frame.jpg", type: "image/jpeg" } as unknown as Blob);
      setResult(await neuroClassMultipart<FrameResponse>("/api/attendance/frame", form));
    } catch (error) { Alert.alert("Attendance scan failed", error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  };

  if (role !== "teacher") return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.error }}>Only the classroom teacher can send attendance frames for recognition.</Text></View>;
  if (!permission) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.muted }}>Preparing camera…</Text></View>;
  if (!permission.granted) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.foreground }]}>Camera permission is required</Text><Text style={[styles.detail, { color: colors.muted }]}>Frames are sent to the established NeuroClass attendance gateway. Recognition remains server-authoritative.</Text><PrimaryButton label="Allow camera" onPress={() => void requestPermission()} /></View>;
  if (!busy && !session) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.foreground }]}>No open attendance session</Text><Text style={[styles.detail, { color: colors.muted }]}>Open attendance from the classroom first, then return here to send a frame for secure review.</Text><PrimaryButton label="Back to classroom" onPress={() => router.back()} /></View>;
  return <View style={styles.root}><CameraView ref={camera} style={styles.camera} facing="back" /><View style={styles.overlay}><Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>Close</Text></Pressable><View style={styles.info}><Text style={styles.eyebrow}>TEACHER ATTENDANCE FRAME</Text><Text style={styles.title}>Review classroom presence</Text><Text style={styles.detail}>The device captures a single frame and delegates recognition to the existing secure backend. It does not identify students locally.</Text>{result?.results?.length ? <View style={styles.resultBox}>{result.results.slice(0, 5).map((entry, index) => <Text key={`${entry.name}-${index}`} style={styles.result}>{entry.name || "Unknown"} · {entry.status || "review"}</Text>)}</View> : null}</View><PrimaryButton label="Capture and analyze" tone="secondary" onPress={() => void analyze()} loading={busy} disabled={!session} /></View></View>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: "#101322" }, camera: { flex: 1 }, overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between", padding: 22, paddingTop: 64, backgroundColor: "rgba(9,13,28,0.27)" }, back: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12 }, backText: { color: "#FFFFFF", fontWeight: "800" }, info: { gap: 5 }, eyebrow: { color: "#C7D2FE", fontSize: 11, fontWeight: "900", letterSpacing: 1 }, title: { color: "#FFFFFF", fontSize: 25, lineHeight: 31, fontWeight: "900" }, detail: { color: "#EEF2FF", fontSize: 14, lineHeight: 20 }, resultBox: { backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 12, padding: 10, marginTop: 6, gap: 3 }, result: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" }, center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 } });
