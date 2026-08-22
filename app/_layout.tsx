import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthGate } from "@/components/auth-gate";
import { NetworkStatusBanner } from "@/components/network-status";
import { SessionPrivacyGuard } from "@/components/session-privacy-guard";
import { NeuroClassAuthProvider } from "@/lib/neuroclass-auth";
import { ThemeProvider } from "@/lib/theme-provider";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <NeuroClassAuthProvider>
        <AuthGate>
          <SessionPrivacyGuard>
            <StatusBar style="auto" />
            <NetworkStatusBanner />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="classroom/[id]" options={{ presentation: "card" }} />
              <Stack.Screen name="assessment/[id]" options={{ presentation: "card" }} />
              <Stack.Screen name="test/[id]" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="face-registration/[classroomId]" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="attendance-scan/[classroomId]" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="result/[id]" options={{ presentation: "card" }} />
            </Stack>
          </SessionPrivacyGuard>
        </AuthGate>
      </NeuroClassAuthProvider>
    </ThemeProvider>
  );
}
