// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "book.closed.fill": "menu-book",
  "checkmark.circle.fill": "check-circle",
  "person.crop.circle.fill": "account-circle",
  "plus": "add",
  "chevron.right": "chevron-right",
  "arrow.left": "arrow-back",
  "doc.text.fill": "description",
  "clock.fill": "schedule",
  "person.2.fill": "groups",
  "graduationcap.fill": "school",
  "play.fill": "play-arrow",
  "arrow.right.circle.fill": "arrow-circle-right",
  "rectangle.portrait.and.arrow.right": "logout",
  "sparkles": "auto-awesome",
  "paperplane.fill": "send",
  "chart.bar.fill": "insights",
  "chevron.left.forwardslash.chevron.right": "code",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
