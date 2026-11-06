import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Card, EmptyState, Pill, PrimaryButton } from "@/components/neuroclass-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useNeuroClassAuth } from "@/lib/neuroclass-auth";
import { askClassroomTutor, loadTutorHistory, type TutorMessage } from "@/lib/neuroclass-tutor";

type ChatMessage = TutorMessage & {
  sources: string[];
  followUp: string | null;
  pending?: boolean;
};

const SAMPLE_QUESTIONS = [
  "Summarise the key ideas from our class materials.",
  "Explain the hardest concept in this classroom like I am revising for a test.",
  "Give me three practice questions from the uploaded material.",
];

export default function ClassroomTutorScreen() {
  const { classroomId } = useLocalSearchParams<{ classroomId: string }>();
  const colors = useColors();
  const { user } = useNeuroClassAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!classroomId || !user) {
        setLoadingHistory(false);
        return;
      }
      const history = await loadTutorHistory(classroomId, user.id);
      if (cancelled) return;
      setThreadId(history.thread?.id ?? null);
      setMessages(
        history.messages.map((message) => ({ ...message, sources: message.citations, followUp: null })),
      );
      setLoadingHistory(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [classroomId, user]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const send = useCallback(
    async (rawQuestion?: string) => {
      const question = (rawQuestion ?? input).trim();
      if (!question || !classroomId || sending) return;
      setInput("");
      setError(null);
      setSending(true);
      const userMessage: ChatMessage = {
        id: `local-user-${Date.now()}`,
        threadId: threadId ?? "",
        role: "user",
        content: question,
        citations: [],
        confidence: null,
        createdAt: new Date().toISOString(),
        sources: [],
        followUp: null,
      };
      const pendingMessage: ChatMessage = {
        id: `local-pending-${Date.now()}`,
        threadId: threadId ?? "",
        role: "assistant",
        content: "Thinking…",
        citations: [],
        confidence: null,
        createdAt: new Date().toISOString(),
        sources: [],
        followUp: null,
        pending: true,
      };
      setMessages((current) => [...current, userMessage, pendingMessage]);
      scrollToBottom();
      try {
        const response = await askClassroomTutor(classroomId, question, threadId);
        setThreadId(response.threadId);
        const answer = response.answer;
        const assistantMessage: ChatMessage = {
          id: response.assistantMessageId || `local-assistant-${Date.now()}`,
          threadId: response.threadId,
          role: "assistant",
          content: answer?.answer ?? "",
          citations: [],
          confidence: typeof answer?.confidence === "number" ? answer.confidence : null,
          createdAt: new Date().toISOString(),
          sources: response.sources ?? [],
          followUp: answer?.followUp ?? null,
        };
        setMessages((current) =>
          current.map((message) =>
            message.id === userMessage.id
              ? { ...message, id: response.userMessageId || message.id, threadId: response.threadId }
              : message.id === pendingMessage.id
                ? assistantMessage
                : message,
          ),
        );
      } catch (nextError) {
        setMessages((current) => current.filter((message) => message.id !== pendingMessage.id));
        setError(nextError instanceof Error ? nextError.message : "The tutor could not answer right now. Please try again.");
      } finally {
        setSending(false);
        scrollToBottom();
      }
    },
    [classroomId, input, sending, threadId, scrollToBottom],
  );

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
        <View
          style={[
            styles.bubble,
            isUser
              ? { backgroundColor: colors.primary, borderColor: colors.primary }
              : { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {item.pending ? (
            <View style={styles.pendingRow}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={[styles.bubbleText, { color: colors.muted }]}>Reading your class materials…</Text>
            </View>
          ) : (
            <Text style={[styles.bubbleText, { color: isUser ? "#FFFFFF" : colors.foreground }]}>{item.content}</Text>
          )}
          {!isUser && !item.pending && item.sources.length > 0 ? (
            <View style={styles.sources}>
              <Text style={[styles.sourcesLabel, { color: colors.muted }]}>Sources</Text>
              <View style={styles.pillRow}>
                {item.sources.map((source) => (
                  <Pill key={source} label={source} tone="primary" />
                ))}
              </View>
            </View>
          ) : null}
          {!isUser && !item.pending && item.confidence !== null ? (
            <Text style={[styles.confidence, { color: colors.muted }]}>
              Confidence {Math.round(item.confidence <= 1 ? item.confidence * 100 : item.confidence)}%
            </Text>
          ) : null}
        </View>
        {!isUser && !item.pending && item.followUp ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void send(item.followUp ?? undefined)}
            style={[styles.followUp, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Text style={[styles.followUpText, { color: colors.primary }]}>Ask next: {item.followUp}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: colors.foreground }]}>Classroom AI tutor</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Answers are grounded in this classroom&apos;s uploaded materials.
            </Text>
          </View>
        </View>

        {loadingHistory ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[styles.centerLabel, { color: colors.muted }]}>Loading your conversation…</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              title="Ask anything about this class"
              detail="The tutor answers from the materials your teacher uploaded to this classroom, and shows its sources under each answer."
            />
            <View style={styles.samples}>
              {SAMPLE_QUESTIONS.map((question) => (
                <Pressable
                  key={question}
                  accessibilityRole="button"
                  disabled={sending}
                  onPress={() => void send(question)}
                  style={[styles.sample, { borderColor: colors.border, backgroundColor: colors.surface }]}
                >
                  <Text style={[styles.sampleText, { color: colors.foreground }]}>{question}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToBottom}
          />
        )}

        {error ? (
          <Card>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </Card>
        ) : null}

        <View style={[styles.composer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            editable={!sending}
            multiline
            placeholder="Ask about your class materials…"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.foreground }]}
          />
          <PrimaryButton label="Send" onPress={() => void send()} loading={sending} disabled={!input.trim()} />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingTop: 18, paddingBottom: 12 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 24, lineHeight: 30, letterSpacing: -0.5, fontWeight: "900" },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  centerLabel: { fontSize: 14 },
  emptyWrap: { flex: 1, gap: 14 },
  samples: { gap: 10 },
  sample: { borderWidth: 1, borderRadius: 14, padding: 14 },
  sampleText: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  list: { paddingVertical: 8, gap: 12, paddingBottom: 16 },
  bubbleRow: { gap: 8 },
  bubbleRowUser: { alignItems: "flex-end" },
  bubbleRowAssistant: { alignItems: "flex-start" },
  bubble: { maxWidth: "88%", borderWidth: 1, borderRadius: 18, padding: 13, gap: 8 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  pendingRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  sources: { gap: 6 },
  sourcesLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  confidence: { fontSize: 12, fontWeight: "600" },
  followUp: { maxWidth: "88%", borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  followUpText: { fontSize: 13, fontWeight: "700" },
  errorText: { fontSize: 14, lineHeight: 20 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 10, borderWidth: 1, borderRadius: 18, padding: 10, marginBottom: 14 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, fontSize: 16, paddingHorizontal: 6, paddingTop: 10, textAlignVertical: "top" },
});
