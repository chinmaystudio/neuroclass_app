import * as Network from "expo-network";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";

export function NetworkStatusBanner() {
  const colors = useColors();
  const state = Network.useNetworkState();
  const offline = state.isConnected === false || state.isInternetReachable === false;
  if (!offline) return null;
  return (
    <View style={[styles.banner, { backgroundColor: `${colors.warning}1C`, borderColor: `${colors.warning}55` }]}>
      <Text style={[styles.text, { color: colors.warning }]}>You are offline. Existing work remains on this device; secure server actions will resume when you reconnect.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginHorizontal: 16, marginTop: 8 },
  text: { fontSize: 12, lineHeight: 17, fontWeight: "700", textAlign: "center" },
});

