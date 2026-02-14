import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LeadStatus, LEAD_STATUS_CONFIG } from "@/lib/types";

interface StatusBadgeProps {
  status: LeadStatus;
  size?: "small" | "medium" | "large";
  onPress?: () => void;
  showLabel?: boolean;
}

export function StatusBadge({ status, size = "medium", onPress, showLabel = true }: StatusBadgeProps) {
  const config = LEAD_STATUS_CONFIG[status];
  const sizeMap = { small: 10, medium: 14, large: 18 };
  const paddingMap = { small: 4, medium: 6, large: 10 };
  const fontMap = { small: 10, medium: 12, large: 14 };
  const iconSize = sizeMap[size];

  const content = (
    <View style={[styles.badge, { backgroundColor: config.color + "18", paddingHorizontal: paddingMap[size], paddingVertical: paddingMap[size] - 2 }]}>
      <Feather name={config.icon as any} size={iconSize} color={config.color} />
      {showLabel && <Text style={[styles.label, { color: config.color, fontSize: fontMap[size] }]}>{config.label}</Text>}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    gap: 4,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
});
