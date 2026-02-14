import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Lead, LEAD_STATUS_CONFIG } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { useTheme } from "@/lib/useTheme";
import * as Haptics from "expo-haptics";

interface LeadCardProps {
  lead: Lead;
  onPress: () => void;
  onLongPress?: () => void;
}

export function LeadCard({ lead, onPress, onLongPress }: LeadCardProps) {
  const theme = useTheme();
  const config = LEAD_STATUS_CONFIG[lead.status];
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown";

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress?.();
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={handleLongPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={[styles.statusBar, { backgroundColor: config.color }]} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.nameContainer}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {fullName}
            </Text>
            {lead.knockedAt && (
              <Text style={[styles.time, { color: theme.textSecondary }]}>
                {formatTimeAgo(lead.knockedAt)}
              </Text>
            )}
          </View>
          <StatusBadge status={lead.status} size="small" />
        </View>
        <View style={styles.detailRow}>
          <Feather name="map-pin" size={12} color={theme.textSecondary} />
          <Text style={[styles.address, { color: theme.textSecondary }]} numberOfLines={1}>
            {lead.address || "No address"}
          </Text>
        </View>
        {lead.notes ? (
          <Text style={[styles.notes, { color: theme.textSecondary }]} numberOfLines={1}>
            {lead.notes}
          </Text>
        ) : null}
        {lead.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {lead.tags.slice(0, 3).map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: theme.tint + "15" }]}>
                <Text style={[styles.tagText, { color: theme.tint }]}>{tag}</Text>
              </View>
            ))}
            {lead.tags.length > 3 && (
              <Text style={[styles.moreTag, { color: theme.textSecondary }]}>
                +{lead.tags.length - 3}
              </Text>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 10,
  },
  statusBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  address: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  notes: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic" as const,
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  moreTag: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
});
