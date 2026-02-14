import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useLeads } from "@/lib/leads-context";
import { useTheme } from "@/lib/useTheme";
import { Lead, LEAD_STATUS_CONFIG, LeadStatus } from "@/lib/types";
import { DispositionSheet } from "@/components/DispositionSheet";
import { NativeMap } from "@/components/NativeMap";

const STATUS_FILTERS: LeadStatus[] = [
  "untouched",
  "not_home",
  "callback",
  "appointment",
  "sold",
  "not_interested",
  "follow_up",
];

export default function MapScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { leads, dispositionLead } = useLeads();
  const mapRef = useRef<any>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showDisposition, setShowDisposition] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<LeadStatus>>(new Set());
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      if (Platform.OS === "web") {
        try {
          navigator.geolocation?.getCurrentPosition(
            (pos) => {
              setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
              setLocationPermission(true);
            },
            () => setLocationPermission(false)
          );
        } catch {
          setLocationPermission(false);
        }
        return;
      }
      const Location = require("expo-location");
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationPermission(false);
        return;
      }
      setLocationPermission(true);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    })();
  }, []);

  const filteredLeads = activeFilters.size === 0
    ? leads
    : leads.filter((l) => activeFilters.has(l.status));

  const handleDropPin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (userLocation) {
      router.push({
        pathname: "/lead-form",
        params: {
          latitude: userLocation.latitude.toString(),
          longitude: userLocation.longitude.toString(),
        },
      });
    } else {
      router.push("/lead-form");
    }
  };

  const handleMapLongPress = (e: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { latitude, longitude } = e.nativeEvent.coordinate;
    router.push({
      pathname: "/lead-form",
      params: {
        latitude: latitude.toString(),
        longitude: longitude.toString(),
      },
    });
  };

  const handleMarkerPress = (lead: Lead) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedLead(lead);
  };

  const handleDisposition = (status: LeadStatus, notes: string) => {
    if (selectedLead) {
      dispositionLead(selectedLead.id, status, notes);
      setShowDisposition(false);
      setSelectedLead(null);
    }
  };

  const handleCenterOnUser = () => {
    if (userLocation && mapRef.current?.animateToRegion) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    }
  };

  const toggleFilter = (status: LeadStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const bottomOffset = Platform.OS === "web" ? 84 + 34 : 100;
  const isWeb = Platform.OS === "web";

  const initialRegion = userLocation
    ? { ...userLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : { latitude: 37.78825, longitude: -122.4324, latitudeDelta: 0.01, longitudeDelta: 0.01 };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {isWeb ? (
        <View style={[styles.webFallback, { backgroundColor: theme.isDark ? "#1a2332" : "#e8f0f8" }]}>
          <View style={styles.webOverlay}>
            <Feather name="map" size={56} color={theme.textSecondary} />
            <Text style={[styles.webTitle, { color: theme.text }]}>Map View</Text>
            <Text style={[styles.webSubtitle, { color: theme.textSecondary }]}>
              Open on your phone with Expo Go for interactive maps
            </Text>
          </View>
          {filteredLeads.length > 0 && (
            <View style={[styles.webLeadsList, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.webListTitle, { color: theme.text }]}>
                {filteredLeads.length} Lead{filteredLeads.length !== 1 ? "s" : ""}
              </Text>
              {filteredLeads.slice(0, 8).map((lead) => {
                const config = LEAD_STATUS_CONFIG[lead.status];
                return (
                  <Pressable
                    key={lead.id}
                    onPress={() => router.push({ pathname: "/lead-detail", params: { id: lead.id } })}
                    style={[styles.webLeadItem, { borderBottomColor: theme.borderLight }]}
                  >
                    <View style={[styles.webDot, { backgroundColor: config.color }]} />
                    <View style={styles.webLeadInfo}>
                      <Text style={[styles.webLeadName, { color: theme.text }]} numberOfLines={1}>
                        {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown"}
                      </Text>
                      <Text style={[styles.webLeadAddr, { color: theme.textSecondary }]} numberOfLines={1}>
                        {lead.address || "No address"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      ) : (
        <NativeMap
          ref={mapRef}
          initialRegion={initialRegion}
          locationPermission={!!locationPermission}
          leads={filteredLeads}
          selectedLeadId={selectedLead?.id || null}
          onMarkerPress={handleMarkerPress}
          onLongPress={handleMapLongPress}
        />
      )}

      <View style={[styles.filterBar, { top: insets.top + 10 + webTopInset }]}>
        <Pressable
          style={[
            styles.filterChip,
            {
              backgroundColor: activeFilters.size === 0 ? theme.tint : theme.surface,
              borderColor: activeFilters.size === 0 ? theme.tint : theme.border,
            },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveFilters(new Set());
          }}
        >
          <Text
            style={[
              styles.filterText,
              { color: activeFilters.size === 0 ? "#FFF" : theme.text },
            ]}
          >
            All ({leads.length})
          </Text>
        </Pressable>
        {STATUS_FILTERS.map((status) => {
          const config = LEAD_STATUS_CONFIG[status];
          const count = leads.filter((l) => l.status === status).length;
          const isActive = activeFilters.has(status);
          return (
            <Pressable
              key={status}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? config.color + "20" : theme.surface,
                  borderColor: isActive ? config.color : theme.border,
                },
              ]}
              onPress={() => toggleFilter(status)}
            >
              <View style={[styles.filterDot, { backgroundColor: config.color }]} />
              <Text
                style={[
                  styles.filterText,
                  { color: isActive ? config.color : theme.textSecondary },
                ]}
              >
                {count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedLead && !isWeb && (
        <View style={[styles.leadPreview, { backgroundColor: theme.surface, bottom: bottomOffset }]}>
          <Pressable
            onPress={() => router.push({ pathname: "/lead-detail", params: { id: selectedLead.id } })}
            style={styles.previewContent}
          >
            <View style={styles.previewLeft}>
              <View style={[styles.previewDot, { backgroundColor: LEAD_STATUS_CONFIG[selectedLead.status].color }]} />
              <View style={styles.previewInfo}>
                <Text style={[styles.previewName, { color: theme.text }]} numberOfLines={1}>
                  {[selectedLead.firstName, selectedLead.lastName].filter(Boolean).join(" ") || "Unknown"}
                </Text>
                <Text style={[styles.previewAddress, { color: theme.textSecondary }]} numberOfLines={1}>
                  {selectedLead.address || "No address"}
                </Text>
              </View>
            </View>
            <View style={styles.previewActions}>
              <Pressable
                onPress={() => setShowDisposition(true)}
                style={[styles.actionBtn, { backgroundColor: theme.tint }]}
              >
                <Feather name="edit-3" size={16} color="#FFF" />
              </Pressable>
              <Pressable
                onPress={() => setSelectedLead(null)}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
          </Pressable>
        </View>
      )}

      {!isWeb && (
        <View style={[styles.mapControls, { bottom: bottomOffset }]}>
          <Pressable
            onPress={handleCenterOnUser}
            style={[styles.mapBtn, { backgroundColor: theme.surface }]}
          >
            <Feather name="navigation" size={20} color={theme.tint} />
          </Pressable>
        </View>
      )}

      <Pressable
        onPress={handleDropPin}
        style={[styles.fabButton, { backgroundColor: theme.tint, bottom: bottomOffset + 8 }]}
      >
        <Feather name="plus" size={24} color="#FFF" />
      </Pressable>

      <DispositionSheet
        visible={showDisposition}
        currentStatus={selectedLead?.status || "untouched"}
        onSelect={handleDisposition}
        onClose={() => setShowDisposition(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  webOverlay: {
    alignItems: "center",
    gap: 10,
    padding: 24,
  },
  webTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  webSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 280,
  },
  webLeadsList: {
    position: "absolute",
    bottom: 130,
    left: 16,
    right: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    maxHeight: 260,
  },
  webListTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  webLeadItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  webDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  webLeadInfo: {
    flex: 1,
  },
  webLeadName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  webLeadAddr: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  filterBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 6,
    zIndex: 10,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  leadPreview: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    padding: 16,
  },
  previewContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  previewDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  previewAddress: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  previewActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  mapControls: {
    position: "absolute",
    right: 16,
    gap: 8,
  },
  mapBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  fabButton: {
    position: "absolute",
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
