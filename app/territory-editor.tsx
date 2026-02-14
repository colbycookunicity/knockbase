import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/useTheme";
import { useTerritories } from "@/lib/territories-context";
import { Coordinate, TERRITORY_COLORS, Territory } from "@/lib/types";

export default function TerritoryEditorScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { territories, addTerritory, updateTerritory, removeTerritory } = useTerritories();
  const mapRef = useRef<any>(null);

  const existing = params.id ? territories.find((t) => t.id === params.id) : null;

  const [name, setName] = useState(existing?.name || "");
  const [assignedRep, setAssignedRep] = useState(existing?.assignedRep || "");
  const [color, setColor] = useState(existing?.color || TERRITORY_COLORS[0]);
  const [points, setPoints] = useState<Coordinate[]>(existing?.points || []);
  const [isDrawing, setIsDrawing] = useState(!existing);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const isWeb = Platform.OS === "web";

  useEffect(() => {
    (async () => {
      if (Platform.OS === "web") {
        navigator.geolocation?.getCurrentPosition(
          (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          () => {}
        );
        return;
      }
      const Location = require("expo-location");
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    })();
  }, []);

  const handleMapPress = (e: any) => {
    if (!isDrawing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPoints((prev) => [...prev, { latitude, longitude }]);
  };

  const handleUndo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPoints((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPoints([]);
  };

  const handleSave = async () => {
    if (points.length < 3) {
      Alert.alert("Need More Points", "A territory needs at least 3 points to form an area.");
      return;
    }
    if (!name.trim()) {
      Alert.alert("Name Required", "Please enter a name for this territory.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (existing) {
      await updateTerritory(existing.id, { name: name.trim(), color, points, assignedRep: assignedRep.trim() });
    } else {
      await addTerritory({ name: name.trim(), color, points, assignedRep: assignedRep.trim() });
    }
    router.back();
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert("Delete Territory", `Remove "${existing.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await removeTerritory(existing.id);
          router.back();
        },
      },
    ]);
  };

  const centerRegion = (() => {
    if (points.length > 0) {
      const avgLat = points.reduce((s, p) => s + p.latitude, 0) / points.length;
      const avgLng = points.reduce((s, p) => s + p.longitude, 0) / points.length;
      return { latitude: avgLat, longitude: avgLng, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    }
    if (userLocation) {
      return { ...userLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    }
    return { latitude: 37.78825, longitude: -122.4324, latitudeDelta: 0.01, longitudeDelta: 0.01 };
  })();

  if (isWeb) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.webHeader, { paddingTop: insets.top + 8 + webTopInset }]}>
          <Pressable onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <Text style={[styles.webHeaderTitle, { color: theme.text }]}>
            {existing ? "Edit Territory" : "New Territory"}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.webFallback}>
          <Feather name="hexagon" size={48} color={theme.textSecondary} />
          <Text style={[styles.webText, { color: theme.textSecondary }]}>
            Territory drawing available on mobile via Expo Go
          </Text>
        </View>
      </View>
    );
  }

  const MapView = require("react-native-maps").default;
  const { Marker, Polygon, Polyline } = require("react-native-maps");

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={centerRegion}
        showsUserLocation
        showsMyLocationButton={false}
        onPress={handleMapPress}
        mapType="hybrid"
      >
        {points.length >= 3 && (
          <Polygon
            coordinates={points}
            fillColor={color + "30"}
            strokeColor={color}
            strokeWidth={3}
          />
        )}
        {points.length >= 2 && points.length < 3 && (
          <Polyline
            coordinates={points}
            strokeColor={color}
            strokeWidth={3}
          />
        )}
        {points.map((point, index) => (
          <Marker key={`point-${index}`} coordinate={point} anchor={{ x: 0.5, y: 0.5 }}>
            <View
              style={[
                styles.drawPoint,
                {
                  backgroundColor: color,
                  borderColor: "#FFF",
                  width: index === 0 ? 20 : 14,
                  height: index === 0 ? 20 : 14,
                  borderRadius: index === 0 ? 10 : 7,
                },
              ]}
            >
              {index === 0 && (
                <Text style={styles.drawPointText}>1</Text>
              )}
            </View>
          </Marker>
        ))}
      </MapView>

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.topBtn, { backgroundColor: theme.surface }]}
        >
          <Feather name="x" size={20} color={theme.text} />
        </Pressable>

        <View style={[styles.topLabel, { backgroundColor: theme.surface }]}>
          <Text style={[styles.topLabelText, { color: theme.text }]}>
            {isDrawing
              ? `Tap map to draw (${points.length} pts)`
              : existing ? "Edit Territory" : "New Territory"}
          </Text>
        </View>

        {isDrawing && points.length > 0 && (
          <Pressable
            onPress={handleUndo}
            style={[styles.topBtn, { backgroundColor: theme.surface }]}
          >
            <Feather name="corner-up-left" size={20} color={theme.text} />
          </Pressable>
        )}
      </View>

      {isDrawing && (
        <View style={[styles.drawControls, { bottom: insets.bottom + 16 }]}>
          <View style={[styles.drawBar, { backgroundColor: theme.surface }]}>
            <Pressable
              onPress={handleClear}
              style={[styles.drawAction, { borderRightWidth: 1, borderColor: theme.border }]}
            >
              <Feather name="trash-2" size={16} color={theme.danger || "#EF4444"} />
              <Text style={[styles.drawActionText, { color: theme.danger || "#EF4444" }]}>Clear</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (points.length >= 3) {
                  setIsDrawing(false);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
              }}
              style={styles.drawAction}
            >
              <Feather
                name="check-circle"
                size={16}
                color={points.length >= 3 ? theme.tint : theme.textSecondary}
              />
              <Text
                style={[
                  styles.drawActionText,
                  { color: points.length >= 3 ? theme.tint : theme.textSecondary },
                ]}
              >
                Done Drawing
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {!isDrawing && (
        <View style={[styles.formPanel, { paddingBottom: insets.bottom + 16 }]}>
          <ScrollView
            style={[styles.formScroll, { backgroundColor: theme.surface }]}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Territory Name</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Oak Park South"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Assigned Rep</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
              value={assignedRep}
              onChangeText={setAssignedRep}
              placeholder="Rep name (optional)"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Color</Text>
            <View style={styles.colorRow}>
              {TERRITORY_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setColor(c);
                  }}
                  style={[
                    styles.colorDot,
                    {
                      backgroundColor: c,
                      borderWidth: color === c ? 3 : 0,
                      borderColor: "#FFF",
                      transform: [{ scale: color === c ? 1.2 : 1 }],
                    },
                  ]}
                />
              ))}
            </View>

            <Pressable
              onPress={() => setIsDrawing(true)}
              style={[styles.redrawBtn, { borderColor: theme.border }]}
            >
              <Feather name="edit-2" size={14} color={theme.tint} />
              <Text style={[styles.redrawText, { color: theme.tint }]}>Redraw Boundary</Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: theme.tint, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Feather name="check" size={18} color="#FFF" />
              <Text style={styles.saveBtnText}>{existing ? "Save Changes" : "Create Territory"}</Text>
            </Pressable>

            {existing && (
              <Pressable onPress={handleDelete} style={styles.deleteBtn}>
                <Feather name="trash-2" size={16} color="#EF4444" />
                <Text style={styles.deleteBtnText}>Delete Territory</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  webHeaderTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  webFallback: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  webText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
    zIndex: 10,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  topLabel: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  topLabelText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  drawPoint: {
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  drawPointText: {
    color: "#FFF",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
  },
  drawControls: {
    position: "absolute",
    left: 16,
    right: 16,
  },
  drawBar: {
    flexDirection: "row",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  drawAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  drawActionText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  formPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "55%",
  },
  formScroll: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  formContent: {
    padding: 20,
    gap: 8,
  },
  formLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    marginTop: 8,
  },
  formInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  colorRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 6,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  redrawBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  redrawText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  saveBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  deleteBtnText: { color: "#EF4444", fontSize: 14, fontFamily: "Inter_500Medium" },
});
