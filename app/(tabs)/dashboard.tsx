import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLeads } from "@/lib/leads-context";
import { useTheme } from "@/lib/useTheme";
import { computeTodayStats, computeWeekStats, getStatusCounts } from "@/lib/storage";
import { StatCard } from "@/components/StatCard";
import { LEAD_STATUS_CONFIG, LeadStatus } from "@/lib/types";
import Colors from "@/constants/colors";

type Period = "today" | "week" | "all";

export default function DashboardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { leads } = useLeads();
  const [period, setPeriod] = useState<Period>("today");

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const stats = useMemo(() => {
    if (period === "today") return computeTodayStats(leads);
    if (period === "week") return computeWeekStats(leads);
    return {
      date: "all",
      doorsKnocked: leads.filter((l) => l.knockedAt).length,
      contacts: leads.filter((l) =>
        ["callback", "appointment", "sold", "follow_up", "not_interested"].includes(l.status)
      ).length,
      appointments: leads.filter((l) => l.status === "appointment").length,
      sales: leads.filter((l) => l.status === "sold").length,
      notHome: leads.filter((l) => l.status === "not_home").length,
      notInterested: leads.filter((l) => l.status === "not_interested").length,
      callbacks: leads.filter((l) => l.status === "callback").length,
    };
  }, [leads, period]);

  const statusCounts = useMemo(() => getStatusCounts(leads), [leads]);
  const totalLeads = leads.length;
  const contactRate = stats.doorsKnocked > 0
    ? Math.round((stats.contacts / stats.doorsKnocked) * 100)
    : 0;
  const closeRate = stats.contacts > 0
    ? Math.round((stats.sales / stats.contacts) * 100)
    : 0;

  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return leads
      .filter((l) => l.appointmentDate && new Date(l.appointmentDate) >= now)
      .sort((a, b) => new Date(a.appointmentDate!).getTime() - new Date(b.appointmentDate!).getTime())
      .slice(0, 5);
  }, [leads]);

  const upcomingCallbacks = useMemo(() => {
    const now = new Date();
    return leads
      .filter((l) => l.followUpDate && new Date(l.followUpDate) >= now && l.status === "callback")
      .sort((a, b) => new Date(a.followUpDate!).getTime() - new Date(b.followUpDate!).getTime())
      .slice(0, 5);
  }, [leads]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 + webTopInset }]}>
        <Text style={[styles.title, { color: theme.text }]}>Dashboard</Text>
        <View style={[styles.totalBadge, { backgroundColor: theme.tint + "18" }]}>
          <Text style={[styles.totalCount, { color: theme.tint }]}>{totalLeads}</Text>
          <Text style={[styles.totalLabel, { color: theme.tint }]}>leads</Text>
        </View>
      </View>

      <View style={styles.periodRow}>
        {(["today", "week", "all"] as Period[]).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={[
              styles.periodBtn,
              {
                backgroundColor: period === p ? theme.tint : "transparent",
              },
            ]}
          >
            <Text
              style={[
                styles.periodText,
                { color: period === p ? "#FFF" : theme.textSecondary },
              ]}
            >
              {p === "today" ? "Today" : p === "week" ? "This Week" : "All Time"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
      >
        <View style={styles.statsGrid}>
          <StatCard
            icon="navigation"
            label="Doors Knocked"
            value={stats.doorsKnocked}
            color={Colors.status.callback}
          />
          <StatCard
            icon="users"
            label="Contacts"
            value={stats.contacts}
            color={Colors.status.followUp}
          />
        </View>
        <View style={styles.statsGrid}>
          <StatCard
            icon="calendar"
            label="Appointments"
            value={stats.appointments}
            color={Colors.status.appointment}
          />
          <StatCard
            icon="check-circle"
            label="Sales"
            value={stats.sales}
            color={Colors.status.sold}
          />
        </View>

        <View style={[styles.ratesCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Conversion Rates</Text>
          <View style={styles.ratesRow}>
            <View style={styles.rateItem}>
              <Text style={[styles.rateValue, { color: theme.tint }]}>{contactRate}%</Text>
              <Text style={[styles.rateLabel, { color: theme.textSecondary }]}>Contact Rate</Text>
            </View>
            <View style={[styles.rateDivider, { backgroundColor: theme.border }]} />
            <View style={styles.rateItem}>
              <Text style={[styles.rateValue, { color: Colors.status.sold }]}>{closeRate}%</Text>
              <Text style={[styles.rateLabel, { color: theme.textSecondary }]}>Close Rate</Text>
            </View>
          </View>
        </View>

        <View style={[styles.pipelineCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Pipeline</Text>
          {(Object.keys(LEAD_STATUS_CONFIG) as LeadStatus[]).map((status) => {
            const config = LEAD_STATUS_CONFIG[status];
            const count = statusCounts[status];
            const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
            return (
              <View key={status} style={styles.pipelineRow}>
                <View style={styles.pipelineLabel}>
                  <View style={[styles.pipeDot, { backgroundColor: config.color }]} />
                  <Text style={[styles.pipeText, { color: theme.text }]}>{config.label}</Text>
                </View>
                <View style={styles.pipelineBar}>
                  <View
                    style={[
                      styles.pipelineFill,
                      {
                        backgroundColor: config.color + "40",
                        width: `${Math.max(pct, 2)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.pipeCount, { color: theme.textSecondary }]}>{count}</Text>
              </View>
            );
          })}
        </View>

        {upcomingAppointments.length > 0 && (
          <View style={[styles.upcomingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.upcomingHeader}>
              <Feather name="calendar" size={16} color={Colors.status.appointment} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Upcoming Appointments</Text>
            </View>
            {upcomingAppointments.map((lead) => (
              <View key={lead.id} style={[styles.upcomingItem, { borderTopColor: theme.borderLight }]}>
                <View>
                  <Text style={[styles.upcomingName, { color: theme.text }]}>
                    {[lead.firstName, lead.lastName].filter(Boolean).join(" ")}
                  </Text>
                  <Text style={[styles.upcomingDate, { color: theme.textSecondary }]}>
                    {new Date(lead.appointmentDate!).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {upcomingCallbacks.length > 0 && (
          <View style={[styles.upcomingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.upcomingHeader}>
              <Feather name="phone-call" size={16} color={Colors.status.callback} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Pending Callbacks</Text>
            </View>
            {upcomingCallbacks.map((lead) => (
              <View key={lead.id} style={[styles.upcomingItem, { borderTopColor: theme.borderLight }]}>
                <View>
                  <Text style={[styles.upcomingName, { color: theme.text }]}>
                    {[lead.firstName, lead.lastName].filter(Boolean).join(" ")}
                  </Text>
                  <Text style={[styles.upcomingDate, { color: theme.textSecondary }]}>
                    {lead.followUpDate
                      ? new Date(lead.followUpDate).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      : "No date set"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  totalBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  totalCount: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  totalLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  periodRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    gap: 4,
    marginBottom: 16,
  },
  periodBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  periodText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  ratesCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 12,
  },
  ratesRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  rateItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  rateValue: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  rateLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  rateDivider: {
    width: 1,
    height: 40,
  },
  pipelineCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  pipelineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  pipelineLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: 120,
  },
  pipeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pipeText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  pipelineBar: {
    flex: 1,
    height: 8,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 4,
    overflow: "hidden",
  },
  pipelineFill: {
    height: "100%",
    borderRadius: 4,
  },
  pipeCount: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    width: 28,
    textAlign: "right",
  },
  upcomingCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  upcomingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  upcomingItem: {
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  upcomingName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  upcomingDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
