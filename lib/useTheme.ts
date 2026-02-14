import { useColorScheme } from "react-native";
import Colors, { ColorScheme } from "@/constants/colors";

export function useTheme(): ColorScheme & { isDark: boolean } {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  return { ...colors, isDark };
}
