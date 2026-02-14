import React from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LeadStatus, LEAD_STATUS_CONFIG } from "@/lib/types";

interface MapPinMarkerProps {
  status: LeadStatus;
  isSelected?: boolean;
}

export function MapPinMarker({ status, isSelected = false }: MapPinMarkerProps) {
  const config = LEAD_STATUS_CONFIG[status];
  const size = isSelected ? 36 : 28;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View
        style={[
          styles.pin,
          {
            backgroundColor: config.color,
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: isSelected ? 3 : 2,
            borderColor: "#FFF",
          },
        ]}
      >
        <Feather name={config.icon as any} size={isSelected ? 16 : 12} color="#FFF" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  pin: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
