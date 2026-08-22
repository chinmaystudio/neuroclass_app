import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 9);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarButton: HapticTab,
        tabBarStyle: {
          height: 58 + bottomPadding,
          paddingTop: 7,
          paddingBottom: bottomPadding,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} /> }} />
      <Tabs.Screen name="classes" options={{ title: "Classes", tabBarIcon: ({ color }) => <IconSymbol size={24} name="book.closed.fill" color={color} /> }} />
      <Tabs.Screen name="attendance" options={{ title: "Attendance", tabBarIcon: ({ color }) => <IconSymbol size={24} name="checkmark.circle.fill" color={color} /> }} />
      <Tabs.Screen name="workspace" options={{ title: "Insights", tabBarIcon: ({ color }) => <IconSymbol size={24} name="chart.bar.fill" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.crop.circle.fill" color={color} /> }} />
    </Tabs>
  );
}
