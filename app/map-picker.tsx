import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/useTheme";

export default function MapPickerScreen() {
  const params = useLocalSearchParams<{
    initialLat?: string;
    initialLng?: string;
    returnTo?: string;
  }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(
    params.initialLat && params.initialLng
      ? { latitude: parseFloat(params.initialLat), longitude: parseFloat(params.initialLng) }
      : null
  );
  const [resolvedAddress, setResolvedAddress] = useState("");
  const [isResolving, setIsResolving] = useState(false);
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

  const reverseGeocode = async (latitude: number, longitude: number) => {
    if (Platform.OS === "web") return;
    setIsResolving(true);
    try {
      const Location = require("expo-location");
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results && results.length > 0) {
        const r = results[0];
        const parts = [r.streetNumber, r.street, r.city, r.region, r.postalCode].filter(Boolean);
        setResolvedAddress(parts.join(", ") || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      }
    } catch {
      setResolvedAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    }
    setIsResolving(false);
  };

  const handleMapPress = (e: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });
    reverseGeocode(latitude, longitude);
  };

  const handleConfirm = () => {
    if (!selectedLocation) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.navigate({
      pathname: "/lead-form",
      params: {
        latitude: selectedLocation.latitude.toString(),
        longitude: selectedLocation.longitude.toString(),
        pickedAddress: resolvedAddress || "",
      },
    });
  };

  const initialRegion = selectedLocation
    ? { ...selectedLocation, latitudeDelta: 0.003, longitudeDelta: 0.003 }
    : userLocation
    ? { ...userLocation, latitudeDelta: 0.005, longitudeDelta: 0.005 }
    : { latitude: 37.78825, longitude: -122.4324, latitudeDelta: 0.01, longitudeDelta: 0.01 };

  if (isWeb) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 + webTopInset }]}>
          <Pressable onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Pick Location</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.webFallback}>
          <Feather name="map-pin" size={48} color={theme.textSecondary} />
          <Text style={[styles.webText, { color: theme.textSecondary }]}>
            Map picker available on mobile via Expo Go
          </Text>
        </View>
      </View>
    );
  }

  const MapView = require("react-native-maps").default;
  const { Marker } = require("react-native-maps");

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        onPress={handleMapPress}
        mapType="hybrid"
      >
        {selectedLocation && (
          <Marker coordinate={selectedLocation} pinColor={theme.tint}>
            <View style={styles.selectedPin}>
              <View style={[styles.selectedPinInner, { backgroundColor: theme.tint }]}>
                <Feather name="home" size={18} color="#FFF" />
              </View>
              <View style={[styles.selectedPinTail, { borderTopColor: theme.tint }]} />
            </View>
          </Marker>
        )}
      </MapView>

      {!selectedLocation && (
        <View style={[styles.hintBanner, { top: insets.top + 60 }]}>
          <View style={[styles.hintBox, { backgroundColor: theme.surface }]}>
            <Feather name="crosshair" size={16} color={theme.tint} />
            <Text style={[styles.hintText, { color: theme.text }]}>Tap on a house to select it</Text>
          </View>
        </View>
      )}

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.headerBtn, { backgroundColor: theme.surface }]}
        >
          <Feather name="arrow-left" size={20} color={theme.text} />
        </Pressable>
        <View style={[styles.headerLabel, { backgroundColor: theme.surface }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Pick Location</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {selectedLocation && (
        <View style={[styles.bottomCard, { paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.cardInner, { backgroundColor: theme.surface }]}>
            <View style={styles.cardContent}>
              <View style={[styles.cardDot, { backgroundColor: theme.tint }]}>
                <Feather name="map-pin" size={14} color="#FFF" />
              </View>
              <View style={styles.cardInfo}>
                {isResolving ? (
                  <ActivityIndicator size="small" color={theme.tint} />
                ) : (
                  <Text style={[styles.cardAddress, { color: theme.text }]} numberOfLines={2}>
                    {resolvedAddress || `${selectedLocation.latitude.toFixed(5)}, ${selectedLocation.longitude.toFixed(5)}`}
                  </Text>
                )}
                <Text style={[styles.cardCoords, { color: theme.textSecondary }]}>
                  {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => [
                styles.confirmBtn,
                { backgroundColor: theme.tint, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Feather name="check" size={18} color="#FFF" />
              <Text style={styles.confirmText}>Use This Location</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    zIndex: 10,
  },
  headerBtn: {
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
  headerLabel: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  hintBanner: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  hintBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  hintText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  selectedPin: {
    alignItems: "center",
  },
  selectedPinInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  selectedPinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -2,
  },
  bottomCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  cardInner: {
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  cardDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  cardAddress: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  cardCoords: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  confirmText: {
    color: "#FFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  webFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  webText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
