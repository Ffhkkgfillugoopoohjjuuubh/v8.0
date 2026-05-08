import { useColorScheme } from "react-native";
import { useApp } from "@/context/AppContext";
import colors from "@/constants/colors";

export function useColors() {
  const colorScheme = useColorScheme();
  const { settings } = useApp();
  const isDark = settings?.darkMode ?? colorScheme === "dark";
  const palette = isDark && "dark" in colors
    ? (colors as Record<string, typeof colors.light>).dark
    : colors.light;
  return { ...palette, radius: colors.radius };
}
