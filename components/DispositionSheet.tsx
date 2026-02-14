import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Modal, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LeadStatus, LEAD_STATUS_CONFIG } from "@/lib/types";
import { useTheme } from "@/lib/useTheme";
import * as Haptics from "expo-haptics";

interface DispositionSheetProps {
  visible: boolean;
  currentStatus: LeadStatus;
  onSelect: (status: LeadStatus, notes: string) => void;
  onClose: () => void;
}

const STATUS_ORDER: LeadStatus[] = [
  "not_home",
  "not_interested",
  "callback",
  "follow_up",
  "appointment",
  "sold",
];

export function DispositionSheet({ visible, currentStatus, onSelect, onClose }: DispositionSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<LeadStatus | null>(null);

  const handleSelect = (status: LeadStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedStatus(status);
  };

  const handleConfirm = () => {
    if (selectedStatus) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSelect(selectedStatus, notes);
      setNotes("");
      setSelectedStatus(null);
    }
  };

  const handleClose = () => {
    setNotes("");
    setSelectedStatus(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.overlayBg} onPress={handleClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Log Visit</Text>
            <Pressable onPress={handleClose} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
              <Feather name="x" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Outcome</Text>
            <View style={styles.statusGrid}>
              {STATUS_ORDER.map((status) => {
                const config = LEAD_STATUS_CONFIG[status];
                const isSelected = selectedStatus === status;
                return (
                  <Pressable
                    key={status}
                    onPress={() => handleSelect(status)}
                    style={[
                      styles.statusOption,
                      {
                        backgroundColor: isSelected ? config.color + "20" : theme.background,
                        borderColor: isSelected ? config.color : theme.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                  >
                    <Feather name={config.icon as any} size={20} color={config.color} />
                    <Text style={[styles.statusLabel, { color: isSelected ? config.color : theme.text }]}>
                      {config.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 16 }]}>Notes</Text>
            <TextInput
              style={[
                styles.notesInput,
                {
                  backgroundColor: theme.background,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder="What happened at this door..."
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </ScrollView>

          <Pressable
            onPress={handleConfirm}
            disabled={!selectedStatus}
            style={({ pressed }) => [
              styles.confirmButton,
              {
                backgroundColor: selectedStatus
                  ? LEAD_STATUS_CONFIG[selectedStatus].color
                  : theme.border,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <Feather name="check" size={18} color="#FFF" />
            <Text style={styles.confirmText}>
              {selectedStatus ? `Mark as ${LEAD_STATUS_CONFIG[selectedStatus].label}` : "Select an outcome"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    maxHeight: "80%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  scrollContent: {
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: "45%",
    flex: 1,
  },
  statusLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 80,
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 16,
  },
  confirmText: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
