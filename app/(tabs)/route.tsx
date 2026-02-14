import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Platform, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useLeads } from "@/lib/leads-context";
import { useTheme } from "@/lib/useTheme";
import { Lead, LEAD_STATUS_CONFIG, LeadStatus } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

type FilterMode = "all" | "unvisited" | "callbacks";

export default function RouteScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { leads } = useLeads();
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  React.useEffect(() => {
    (async () => {
      if (Platform.OS === "web") {
        navigator.geolocation?.getCurrentPosition(
          (pos) => {
            setUserLat(pos.coords.latitude);
            setUserLon(pos.coords.longitude);
          },
          () => {}
        );
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLat(loc.coords.latitude);
        setUserLon(loc.coords.longitude);
      }
    })();
  }, []);

  const sortedLeads = useMemo(() => {
    let filtered = [...leads];
    if (filterMode === "unvisited") {
      filtered = filtered.filter((l) => l.status === "untouched");
    } else if (filterMode === "callbacks") {
      filtered = filtered.filter((l) => l.status === "callback" || l.status === "follow_up");
    }

    if (userLat != null && userLon != null) {
      filtered.sort((a, b) => {
        const distA = getDistance(userLat, userLon, a.latitude, a.longitude);
        const distB = getDistance(userLat, userLon, b.latitude, b.longitude);
        return distA - distB;
      });
    }
    return filtered;
  }, [leads, userLat, userLon, filterMode]);

  const handleNavigate = (lead: Lead) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = Platform.select({
      ios: `maps:0,0?q=${lead.latitude},${lead.longitude}`,
      android: `geo:${lead.latitude},${lead.longitude}?q=${lead.latitude},${lead.longitude}(${encodeURIComponent(lead.address || "Lead")})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lead.latitude},${lead.longitude}`,
    });
    if (url) Linking.openURL(url);
  };

  const renderItem = ({ item, index }: { item: Lead; index: number }) => {
    const config = LEAD_STATUS_CONFIG[item.status];
    const fullName = [item.firstName, item.lastName].filter(Boolean).join(" ") || "Unknown";
    const dist =
      userLat != null && userLon != null
        ? getDistance(userLat, userLon, item.latitude, item.longitude)
        : null;

    return (
      <Pressable
        onPress={() => router.push({ pathname: "/lead-detail", params: { id: item.id } })}
        style={({ pressed }) => [
          styles.routeItem,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <View style={[styles.indexCircle, { backgroundColor: config.color + "20" }]}>
          <Text style={[styles.indexText, { color: config.color }]}>{index + 1}</Text>
        </View>
        <View style={styles.routeInfo}>
          <Text style={[styles.routeName, { color: theme.text }]} numberOfLines={1}>
            {fullName}
          </Text>
          <Text style={[styles.routeAddress, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.address || "No address"}
          </Text>
          <View style={styles.routeMeta}>
            <StatusBadge status={item.status} size="small" />
            {dist !== null && (
              <Text style={[styles.distText, { color: theme.textSecondary }]}>
                {dist < 0.1 ? `${Math.round(dist * 5280)} ft` : `${dist.toFixed(1)} mi`}
              </Text>
            )}
          </View>
        </View>
        <Pressable
          onPress={() => handleNavigate(item)}
          style={[styles.navBtn, { backgroundColor: theme.accent + "15" }]}
        >
          <Feather name="navigation" size={18} color={theme.accent} />
        </Pressable>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 + webTopInset }]}>
        <Text style={[styles.title, { color: theme.text }]}>Route</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {sortedLeads.length} stops
        </Text>
      </View>

      <View style={styles.filterRow}>
        {(
          [
            { key: "all", label: "All Leads", icon: "list" },
            { key: "unvisited", label: "Unvisited", icon: "map-pin" },
            { key: "callbacks", label: "Callbacks", icon: "phone-call" },
          ] as const
        ).map((f) => (
          <Pressable
            key={f.key}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFilterMode(f.key);
            }}
            style={[
              styles.filterBtn,
              {
                backgroundColor: filterMode === f.key ? theme.tint : theme.surface,
                borderColor: filterMode === f.key ? theme.tint : theme.border,
              },
            ]}
          >
            <Feather
              name={f.icon as any}
              size={14}
              color={filterMode === f.key ? "#FFF" : theme.textSecondary}
            />
            <Text
              style={[
                styles.filterBtnText,
                { color: filterMode === f.key ? "#FFF" : theme.textSecondary },
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={sortedLeads}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="map" size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No leads in route</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Add leads from the map to build your route
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  indexCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  indexText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  routeInfo: {
    flex: 1,
    gap: 4,
  },
  routeName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  routeAddress: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  routeMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  distText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
