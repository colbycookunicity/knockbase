import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, Platform, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useLeads } from "@/lib/leads-context";
import { useTheme } from "@/lib/useTheme";
import { Lead, LeadStatus, LEAD_STATUS_CONFIG } from "@/lib/types";
import { LeadCard } from "@/components/LeadCard";

const SORT_OPTIONS = [
  { key: "recent", label: "Recent" },
  { key: "name", label: "Name" },
  { key: "status", label: "Status" },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["key"];

export default function LeadsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { leads, deleteLead } = useLeads();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [filterStatus, setFilterStatus] = useState<LeadStatus | null>(null);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const filteredLeads = useMemo(() => {
    let result = [...leads];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.firstName.toLowerCase().includes(q) ||
          l.lastName.toLowerCase().includes(q) ||
          l.address.toLowerCase().includes(q) ||
          l.phone.includes(q)
      );
    }
    if (filterStatus) {
      result = result.filter((l) => l.status === filterStatus);
    }
    switch (sortBy) {
      case "recent":
        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
      case "name":
        result.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
        break;
      case "status":
        const statusOrder: LeadStatus[] = ["sold", "appointment", "callback", "follow_up", "not_home", "not_interested", "untouched"];
        result.sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));
        break;
    }
    return result;
  }, [leads, search, sortBy, filterStatus]);

  const handleDelete = (lead: Lead) => {
    const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "this lead";
    if (Platform.OS === "web") {
      if (confirm(`Delete ${name}?`)) {
        deleteLead(lead.id);
      }
    } else {
      Alert.alert("Delete Lead", `Are you sure you want to delete ${name}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteLead(lead.id),
        },
      ]);
    }
  };

  const renderLead = ({ item }: { item: Lead }) => (
    <LeadCard
      lead={item}
      onPress={() => router.push({ pathname: "/lead-detail", params: { id: item.id } })}
      onLongPress={() => handleDelete(item)}
    />
  );

  const statusFilters: (LeadStatus | null)[] = [null, "untouched", "not_home", "callback", "appointment", "sold", "not_interested", "follow_up"];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 + webTopInset }]}>
        <Text style={[styles.title, { color: theme.text }]}>Leads</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/lead-form");
          }}
          style={[styles.addBtn, { backgroundColor: theme.tint }]}
        >
          <Feather name="plus" size={20} color="#FFF" />
        </Pressable>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Feather name="search" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search leads..."
          placeholderTextColor={theme.textSecondary}
        />
        {search ? (
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.controlsRow}>
        <FlatList
          data={statusFilters}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item || "all"}
          contentContainerStyle={styles.filtersContent}
          renderItem={({ item: status }) => {
            const isActive = filterStatus === status;
            const config = status ? LEAD_STATUS_CONFIG[status] : null;
            const count = status ? leads.filter((l) => l.status === status).length : leads.length;
            return (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFilterStatus(status);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isActive
                      ? config ? config.color + "20" : theme.tint + "20"
                      : theme.surface,
                    borderColor: isActive
                      ? config ? config.color : theme.tint
                      : theme.border,
                  },
                ]}
              >
                {config && <View style={[styles.chipDot, { backgroundColor: config.color }]} />}
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isActive
                        ? config ? config.color : theme.tint
                        : theme.textSecondary,
                    },
                  ]}
                >
                  {status ? config!.label : "All"} ({count})
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => setSortBy(opt.key)}
            style={[
              styles.sortBtn,
              {
                backgroundColor: sortBy === opt.key ? theme.tint + "15" : "transparent",
              },
            ]}
          >
            <Text
              style={[
                styles.sortText,
                { color: sortBy === opt.key ? theme.tint : theme.textSecondary },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        <Text style={[styles.countText, { color: theme.textSecondary }]}>
          {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}
        </Text>
      </View>

      <FlatList
        data={filteredLeads}
        renderItem={renderLead}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="users" size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No leads yet</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Drop a pin on the map or tap + to add your first lead
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
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  controlsRow: {
    marginTop: 12,
  },
  filtersContent: {
    paddingHorizontal: 20,
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    gap: 4,
  },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  sortText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  countText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  listContent: {
    paddingHorizontal: 20,
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
