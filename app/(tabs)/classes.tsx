import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { Card, EmptyState, LoadingState, OutlineButton, Pill, PrimaryButton, ScreenTitle, uiStyles } from "@/components/neuroclass-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { createClassroom, joinClassroom, listClassrooms } from "@/lib/neuroclass-data";
import { useNeuroClassAuth } from "@/lib/neuroclass-auth";
import type { Classroom } from "@/lib/neuroclass-types";
import { ScreenContainer } from "@/components/screen-container";

export default function ClassesScreen() {
  const colors = useColors();
  const { user, profile, role } = useNeuroClassAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!user || !role) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    try { setClassrooms(await listClassrooms(user.id, role)); }
    catch (error) { Alert.alert("Could not load classes", error instanceof Error ? error.message : "Please try again."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [role, user]);

  useEffect(() => { void load(); }, [load]);
  if (loading) return <LoadingState label="Loading your classes…" />;

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />} showsVerticalScrollIndicator={false}>
        <ScreenTitle eyebrow={role === "teacher" ? "Teaching" : "Learning"} title="Classes" subtitle={role === "teacher" ? "Create a class and share its code with students." : "Join classes and keep your learning workspace in sync."} action={<Pressable accessibilityRole="button" onPress={() => setModalVisible(true)} style={[styles.addButton, { backgroundColor: colors.primary }]}><IconSymbol name="plus" size={24} color="#FFFFFF" /></Pressable>} />
        {classrooms.length === 0 ? (
          <EmptyState title={role === "teacher" ? "No classrooms yet" : "No classes joined yet"} detail={role === "teacher" ? "Create your first classroom to receive a shareable code and manage it from NeuroClass." : "Enter the classroom code provided by your instructor to join the shared course space."} action={<PrimaryButton label={role === "teacher" ? "Create classroom" : "Join classroom"} onPress={() => setModalVisible(true)} />} />
        ) : <View style={styles.list}>{classrooms.map((classroom) => <ClassroomCard key={classroom.id} classroom={classroom} />)}</View>}
      </ScrollView>
      <ClassroomActionModal visible={modalVisible} onClose={() => setModalVisible(false)} onComplete={() => void load(true)} role={role ?? "student"} userId={user?.id ?? ""} name={profile?.displayName ?? ""} email={profile?.email ?? ""} />
    </ScreenContainer>
  );
}

function ClassroomCard({ classroom }: { classroom: Classroom }) {
  const colors = useColors();
  return (
    <Pressable onPress={() => router.push({ pathname: "/classroom/[id]", params: { id: classroom.id } })} style={({ pressed }) => pressed ? styles.cardPressed : undefined}>
      <Card>
        <View style={styles.cardTop}><View style={[styles.icon, { backgroundColor: `${colors.primary}14` }]}><IconSymbol name="graduationcap.fill" size={23} color={colors.primary} /></View><View style={styles.cardCopy}><Text numberOfLines={1} style={[styles.cardTitle, { color: colors.foreground }]}>{classroom.name}</Text><Text numberOfLines={1} style={[styles.cardSubtitle, { color: colors.muted }]}>{classroom.subject || "General studies"}</Text></View><IconSymbol name="chevron.right" size={22} color={colors.muted} /></View>
        <View style={styles.cardBottom}><Pill label={`Class code · ${classroom.code}`} tone="primary" /><Text style={[styles.enrollment, { color: colors.muted }]}>{classroom.students ?? 0} enrolled</Text></View>
      </Card>
    </Pressable>
  );
}

function ClassroomActionModal({ visible, onClose, onComplete, role, userId, name, email }: { visible: boolean; onClose: () => void; onComplete: () => void; role: "teacher" | "student"; userId: string; name: string; email: string }) {
  const colors = useColors();
  const [classroomName, setClassroomName] = useState("");
  const [subject, setSubject] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => { if (!busy) onClose(); };
  const submit = async () => {
    setBusy(true);
    try {
      if (role === "teacher") {
        const classroom = await createClassroom({ name: classroomName, subject, userId });
        Alert.alert("Classroom created", `Share ${classroom.code} with your students to let them join.`);
      } else {
        const classroom = await joinClassroom({ code, userId, name: name || "NeuroClass student", email });
        Alert.alert("You joined the class", `You are now enrolled in ${classroom.name}.`);
      }
      setClassroomName(""); setSubject(""); setCode(""); onClose(); onComplete();
    } catch (error) {
      Alert.alert("NeuroClass could not continue", error instanceof Error ? error.message : "Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={close}>
      <View style={styles.modalBackdrop}><View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <View style={styles.handle} />
        <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{role === "teacher" ? "Create classroom" : "Join classroom"}</Text>
        <Text style={[styles.sheetSubtitle, { color: colors.muted }]}>{role === "teacher" ? "Create a shared classroom in the existing NeuroClass ecosystem." : "Enter the code your instructor shared with you."}</Text>
        {role === "teacher" ? <><Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Classroom name</Text><TextInput value={classroomName} onChangeText={setClassroomName} placeholder="e.g. Data Structures" placeholderTextColor={colors.muted} style={[uiStyles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} /><Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Subject</Text><TextInput value={subject} onChangeText={setSubject} placeholder="e.g. Computer Science" placeholderTextColor={colors.muted} style={[uiStyles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} /></> : <><Text style={[uiStyles.fieldLabel, { color: colors.foreground }]}>Classroom code</Text><TextInput value={code} onChangeText={(value) => setCode(value.toUpperCase())} autoCapitalize="characters" placeholder="e.g. DS-7AF2Q" placeholderTextColor={colors.muted} style={[uiStyles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface, letterSpacing: 1.5, fontWeight: "800" }]} /></>}
        <PrimaryButton label={role === "teacher" ? "Create classroom" : "Join classroom"} onPress={submit} loading={busy} />
        <OutlineButton label="Cancel" onPress={close} disabled={busy} />
      </View></View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: 20, paddingBottom: 32 },
  addButton: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  list: { gap: 11 },
  cardPressed: { opacity: 0.75 },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  icon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 16, fontWeight: "800" },
  cardSubtitle: { fontSize: 13, marginTop: 3 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  enrollment: { fontSize: 12, fontWeight: "600" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(13, 20, 42, 0.42)" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, gap: 12 },
  handle: { width: 40, height: 4, borderRadius: 3, alignSelf: "center", backgroundColor: "#98A2B3", marginBottom: 4 },
  sheetTitle: { fontSize: 23, fontWeight: "900", letterSpacing: -0.4 },
  sheetSubtitle: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
});
