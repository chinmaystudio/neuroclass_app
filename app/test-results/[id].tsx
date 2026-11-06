import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Card, EmptyState, LoadingState, Pill, PrimaryButton, ScreenTitle } from "@/components/neuroclass-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { formatDateTime } from "@/lib/neuroclass-data";
import { QUESTION_TYPE_LABELS, getTestResults, releaseTestResults, type TestResults } from "@/lib/neuroclass-tests";

function MetricCard({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function attemptTone(status: string): "success" | "warning" | "danger" | "primary" | "neutral" {
  if (status === "evaluated") return "success";
  if (status === "submitted" || status === "auto_submitted") return "warning";
  if (status === "flagged") return "danger";
  return "primary";
}

function riskTone(risk: string | null): "success" | "warning" | "danger" | "neutral" {
  if (risk === "high") return "danger";
  if (risk === "medium") return "warning";
  if (risk === "low") return "success";
  return "neutral";
}

export default function TestResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TestResults | null>(null);
  const [released, setReleased] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      if (!id) return;
      if (refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const payload = await getTestResults(id);
        setResults(payload);
        setReleased(payload.test.resultsReleased);
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Results could not be loaded.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const toggleRelease = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const outcome = await releaseTestResults(id, !released);
      setReleased(outcome.released);
      Alert.alert("Done", outcome.released ? "Students can now see their results." : "Results are hidden from students again.");
    } catch (nextError) {
      Alert.alert("That did not work", nextError instanceof Error ? nextError.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading results…" />;
  if (!results)
    return (
      <ScreenContainer className="px-5" containerClassName="bg-background">
        <EmptyState title="Results unavailable" detail={error || "Results could not be loaded."} action={<PrimaryButton label="Go back" onPress={() => router.back()} />} />
      </ScreenContainer>
    );

  const { test, metrics, attempts, perQuestion } = results;

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
        </Pressable>
        <ScreenTitle
          eyebrow="Test results"
          title={test.title}
          subtitle={`${test.totalMarks} marks · ${test.durationMinutes} min · ${attempts.length} attempt(s)`}
          action={<Pill label={test.status} tone={test.status === "published" ? "success" : test.status === "closed" ? "warning" : "primary"} />}
        />
        <View style={styles.rowBetween}>
          <Pill label={released ? "Results released to students" : "Results not released"} tone={released ? "success" : "warning"} />
        </View>
        <PrimaryButton
          label={released ? "Withhold results" : "Release results to students"}
          onPress={() => void toggleRelease()}
          loading={busy}
          tone={released ? "secondary" : "primary"}
        />

        <View style={styles.metricGrid}>
          <MetricCard colors={colors} label="Enrolled" value={String(metrics.enrolled)} />
          <MetricCard colors={colors} label="Started" value={String(metrics.started)} />
          <MetricCard colors={colors} label="Submitted" value={String(metrics.submitted)} />
          <MetricCard colors={colors} label="In progress" value={String(metrics.inProgress)} />
          <MetricCard colors={colors} label="Pending review" value={String(metrics.pendingManualReview)} />
          <MetricCard colors={colors} label="Average" value={`${metrics.average}%`} />
          <MetricCard colors={colors} label="Median" value={`${metrics.median}%`} />
          <MetricCard colors={colors} label="Highest" value={`${metrics.highest}%`} />
          <MetricCard colors={colors} label="Pass rate" value={metrics.passRate === null ? "—" : `${metrics.passRate}%`} />
        </View>

        {perQuestion.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Per-question averages</Text>
            <View style={styles.stack}>
              {perQuestion.map((item) => (
                <Card key={item.questionId}>
                  <View style={styles.row}>
                    <View style={styles.copy}>
                      <Text style={[styles.itemTitle, { color: colors.foreground }]}>
                        Q{item.position + 1} · {item.prompt || "(no prompt)"}
                      </Text>
                      <Text style={[styles.itemDetail, { color: colors.muted }]}>
                        {QUESTION_TYPE_LABELS[item.type] ?? item.type} · answered by {item.answeredCount}
                      </Text>
                    </View>
                    <Pill label={`${item.averageMarks}/${item.marks} · ${item.averagePercent}%`} tone={item.averagePercent >= 50 ? "success" : "warning"} />
                  </View>
                </Card>
              ))}
            </View>
          </>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Attempts · {attempts.length}</Text>
        {attempts.length === 0 ? (
          <EmptyState title="No attempts yet" detail="When students start this test, their attempts and scores will appear here." />
        ) : (
          <View style={styles.stack}>
            {attempts.map((attempt) => (
              <Pressable
                key={attempt.id}
                onPress={() => router.push({ pathname: "/attempt-review/[id]", params: { id: attempt.id } } as never)}
                style={({ pressed }) => (pressed ? { opacity: 0.76 } : undefined)}
              >
                <Card>
                  <View style={styles.row}>
                    <View style={styles.copy}>
                      <Text style={[styles.itemTitle, { color: colors.foreground }]}>
                        {attempt.student.name}
                        {attempt.student.rollNumber ? ` · ${attempt.student.rollNumber}` : ""}
                      </Text>
                      <Text style={[styles.itemDetail, { color: colors.muted }]}>
                        {attempt.student.email || "No email"}
                        {attempt.submittedAt ? ` · Submitted ${formatDateTime(attempt.submittedAt)}` : attempt.startedAt ? ` · Started ${formatDateTime(attempt.startedAt)}` : ""}
                      </Text>
                      <Text style={[styles.itemDetail, { color: colors.muted }]}>
                        {attempt.score !== null ? `Score ${attempt.score} / ${attempt.maxScore ?? test.totalMarks}` : "Not scored yet"}
                        {attempt.percentage !== null ? ` · ${attempt.percentage}%` : ""}
                        {attempt.attemptNumber ? ` · Attempt ${attempt.attemptNumber}` : ""}
                      </Text>
                      {attempt.integrityScore !== null || attempt.warningCount ? (
                        <Text style={[styles.itemDetail, { color: colors.muted }]}>
                          {attempt.integrityScore !== null ? `Integrity ${attempt.integrityScore}` : ""}
                          {attempt.warningCount ? ` · ${attempt.warningCount} warning(s)` : ""}
                          {attempt.identityStatus ? ` · Identity: ${attempt.identityStatus}` : ""}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.pills}>
                      <Pill label={attempt.status.replace(/_/g, " ")} tone={attemptTone(attempt.status)} />
                      {attempt.riskLevel ? <Pill label={`${attempt.riskLevel} risk`} tone={riskTone(attempt.riskLevel)} /> : null}
                    </View>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: 18, paddingBottom: 32, gap: 14 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stack: { gap: 10 },
  row: { flexDirection: "row", gap: 11, alignItems: "flex-start" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  copy: { flex: 1, minWidth: 0 },
  pills: { gap: 6, alignItems: "flex-end" },
  itemTitle: { fontSize: 15, fontWeight: "800" },
  itemDetail: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "31%", flexGrow: 1, borderWidth: 1, borderRadius: 16, padding: 12, alignItems: "center", gap: 2 },
  metricValue: { fontSize: 20, fontWeight: "900" },
  metricLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, textAlign: "center" },
});
