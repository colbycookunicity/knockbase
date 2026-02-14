import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Lead, LEAD_STATUS_CONFIG } from "@/lib/types";

interface WebMapProps {
  leads: Lead[];
  onLeadPress: (lead: Lead) => void;
  selectedLeadId?: string | null;
}

export function WebMap({ leads, onLeadPress, selectedLeadId }: WebMapProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.isDark ? "#1a2332" : "#e8f0f8" }]}>
      <View style={styles.overlay}>
        <Feather name="map" size={64} color={theme.textSecondary} />
        <Text style={[styles.title, { color: theme.text }]}>Map View</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Open on your phone with Expo Go for the full map experience
        </Text>
      </View>

      {leads.length > 0 && (
        <View style={[styles.leadsList, { backgroundColor: theme.surface }]}>
          <Text style={[styles.listTitle, { color: theme.text }]}>
            {leads.length} Lead{leads.length !== 1 ? "s" : ""} on Map
          </Text>
          {leads.slice(0, 10).map((lead) => {
            const config = LEAD_STATUS_CONFIG[lead.status];
            const isSelected = selectedLeadId === lead.id;
            return (
              <Pressable
                key={lead.id}
                onPress={() => onLeadPress(lead)}
                style={[
                  styles.leadItem,
                  {
                    borderColor: isSelected ? config.color : theme.border,
                    backgroundColor: isSelected ? config.color + "10" : "transparent",
                  },
                ]}
              >
                <View style={[styles.dot, { backgroundColor: config.color }]} />
                <View style={styles.leadInfo}>
                  <Text style={[styles.leadName, { color: theme.text }]} numberOfLines={1}>
                    {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown"}
                  </Text>
                  <Text style={[styles.leadAddress, { color: theme.textSecondary }]} numberOfLines={1}>
                    {lead.address || `${lead.latitude.toFixed(4)}, ${lead.longitude.toFixed(4)}`}
                  </Text>
                </View>
                <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
              </Pressable>
            );
          })}
          {leads.length > 10 && (
            <Text style={[styles.moreText, { color: theme.textSecondary }]}>
              +{leads.length - 10} more leads
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    alignItems: "center",
    gap: 12,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 280,
  },
  leadsList: {
    position: "absolute",
    bottom: 120,
    left: 16,
    right: 16,
    borderRadius: 14,
    padding: 14,
    maxHeight: 300,
  },
  listTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  leadItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  leadInfo: {
    flex: 1,
  },
  leadName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  leadAddress: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  moreText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 4,
  },
});
