import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/lib/useTheme";
import { useAuth, User } from "@/lib/auth-context";
import { apiRequest } from "@/lib/query-client";
import { LEAD_STATUS_CONFIG, LeadStatus } from "@/lib/types";

type Role = "owner" | "manager" | "rep";
type AdminTab = "team" | "leads" | "performance" | "pos-sales" | "organization";

const ROLE_CONFIG: Record<Role, { label: string; icon: string; color: string }> = {
  owner: { label: "Owner", icon: "shield", color: "#8B5CF6" },
  manager: { label: "Manager", icon: "briefcase", color: "#3B82F6" },
  rep: { label: "Rep", icon: "person", color: "#10B981" },
};

const ORG_UNIT_TYPES = [
  { value: "region", label: "Region", icon: "globe-outline", color: "#8B5CF6" },
  { value: "area", label: "Area", icon: "map-outline", color: "#3B82F6" },
  { value: "team", label: "Team", icon: "people-outline", color: "#10B981" },
];

interface AdminLead {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  status: LeadStatus;
  notes: string;
  knockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  repName: string;
  repEmail: string;
}

interface RepStats {
  userId: string;
  repName: string;
  repEmail: string;
  role: string;
  isActive: string;
  managerId: string | null;
  totalLeads: number;
  doorsKnocked: number;
  contacts: number;
  appointments: number;
  sales: number;
  contactRate: number;
  closeRate: number;
  todayDoors: number;
  todaySales: number;
  weekDoors: number;
  weekSales: number;
  lastActivity: string | null;
}

interface OrgUnit {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: currentUser, isOwner, isManager } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>("team");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Admin leads state
  const [adminLeads, setAdminLeads] = useState<AdminLead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadFilter, setLeadFilter] = useState<string>("all");
  const [leadRepFilter, setLeadRepFilter] = useState<string>("all");
  const [leadSearch, setLeadSearch] = useState("");

  // Performance state
  const [teamStats, setTeamStats] = useState<RepStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<"today" | "week" | "all">("all");

  // Organization state
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgModalVisible, setOrgModalVisible] = useState(false);
  const [editingOrgUnit, setEditingOrgUnit] = useState<OrgUnit | null>(null);
  const [orgFormName, setOrgFormName] = useState("");
  const [orgFormType, setOrgFormType] = useState("team");
  const [orgFormParentId, setOrgFormParentId] = useState<string | null>(null);

  // User form state
  const [formUsername, setFormUsername] = useState("");
  const [formFullName, setFormFullName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState<Role>("rep");
  const [formManagerId, setFormManagerId] = useState<string | null>(null);
  const [formOrgUnitId, setFormOrgUnitId] = useState<string | null>(null);
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Org-based filtering
  const [leadOrgFilter, setLeadOrgFilter] = useState<string>("");
  const [statsOrgFilter, setStatsOrgFilter] = useState<string>("");

  // POS Sales state
  const [posSummary, setPosSummary] = useState<any>(null);
  const [posDays, setPosDays] = useState(7);
  const [posLoading, setPosLoading] = useState(false);

  // User form: shopify staff name
  const [formShopifyStaffName, setFormShopifyStaffName] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/users");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAdminLeads = useCallback(async (orgId?: string) => {
    setLeadsLoading(true);
    try {
      const url = orgId ? `/api/admin/leads?orgUnitId=${encodeURIComponent(orgId)}` : "/api/admin/leads";
      const res = await apiRequest("GET", url);
      const data = await res.json();
      setAdminLeads(data);
    } catch (err) {
      console.error("Failed to fetch admin leads:", err);
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  const fetchTeamStats = useCallback(async (orgId?: string) => {
    setStatsLoading(true);
    try {
      const url = orgId ? `/api/admin/team-stats?orgUnitId=${encodeURIComponent(orgId)}` : "/api/admin/team-stats";
      const res = await apiRequest("GET", url);
      const data = await res.json();
      setTeamStats(data);
    } catch (err) {
      console.error("Failed to fetch team stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchPosSales = useCallback(async (days: number = 7) => {
    setPosLoading(true);
    try {
      const res = await apiRequest("GET", `/api/admin/pos-summary?days=${days}`);
      const data = await res.json();
      setPosSummary(data);
    } catch (err) {
      console.error("Failed to fetch POS sales:", err);
      setPosSummary(null);
    } finally {
      setPosLoading(false);
    }
  }, []);

  const fetchOrgUnits = useCallback(async () => {
    setOrgLoading(true);
    try {
      const res = await apiRequest("GET", "/api/org-units");
      const data = await res.json();
      setOrgUnits(data);
    } catch (err) {
      console.error("Failed to fetch org units:", err);
    } finally {
      setOrgLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchOrgUnits();
  }, [fetchUsers]);

  useEffect(() => {
    if (activeTab === "leads" && adminLeads.length === 0) fetchAdminLeads(leadOrgFilter || undefined);
    if (activeTab === "performance" && teamStats.length === 0) fetchTeamStats(statsOrgFilter || undefined);
    if (activeTab === "pos-sales" && !posSummary) fetchPosSales(posDays);
    if (activeTab === "organization") fetchOrgUnits();
  }, [activeTab]);

  // Re-fetch when org filters change
  useEffect(() => {
    if (activeTab === "leads") fetchAdminLeads(leadOrgFilter || undefined);
  }, [leadOrgFilter]);

  useEffect(() => {
    if (activeTab === "performance") fetchTeamStats(statsOrgFilter || undefined);
  }, [statsOrgFilter]);

  const managers = useMemo(() => {
    return users.filter((u) => u.role === "manager");
  }, [users]);

  const getManagerName = (managerId: string | null) => {
    if (!managerId) return null;
    const mgr = users.find((u) => u.id === managerId);
    return mgr?.fullName || null;
  };

  const getOrgUnitName = (orgUnitId: string | null | undefined) => {
    if (!orgUnitId) return null;
    const unit = orgUnits.find((u) => u.id === orgUnitId);
    return unit?.name || null;
  };

  // ============ TEAM TAB ============
  const openCreateModal = () => {
    setEditingUser(null);
    setFormUsername("");
    setFormFullName("");
    setFormEmail("");
    setFormPhone("");
    setFormRole(isManager ? "rep" : "rep");
    setFormManagerId(isManager ? (currentUser?.id ?? null) : null);
    setFormOrgUnitId(null);
    setFormShopifyStaffName("");
    setFormActive(true);
    setFormError("");
    setModalVisible(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormFullName(user.fullName);
    setFormEmail(user.email);
    setFormPhone(user.phone);
    setFormRole(user.role as Role);
    setFormManagerId(user.managerId);
    setFormOrgUnitId((user as any).orgUnitId || null);
    setFormShopifyStaffName((user as any).shopifyStaffName || "");
    setFormActive(user.isActive === "true");
    setFormError("");
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formEmail.trim() || !formFullName.trim()) {
      setFormError("Email and full name are required");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      if (editingUser) {
        const body: any = {
          username: formUsername.trim(),
          fullName: formFullName.trim(),
          email: formEmail.trim(),
          phone: formPhone.trim(),
          role: formRole,
          isActive: formActive,
          managerId: formRole === "rep" ? formManagerId : null,
          orgUnitId: formOrgUnitId,
          shopifyStaffName: formShopifyStaffName.trim() || null,
        };
        const res = await apiRequest("PUT", `/api/users/${editingUser.id}`, body);
        const updated = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      } else {
        const body: any = {
          username: formUsername.trim(),
          fullName: formFullName.trim(),
          email: formEmail.trim(),
          phone: formPhone.trim(),
          role: formRole,
          orgUnitId: formOrgUnitId,
          shopifyStaffName: formShopifyStaffName.trim() || null,
        };
        if (formRole === "rep" && formManagerId) {
          body.managerId = formManagerId;
        }
        const res = await apiRequest("POST", "/api/users", body);
        const created = await res.json();
        setUsers((prev) => [...prev, created]);
      }
      setModalVisible(false);
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("409")) {
        setFormError("Email already taken");
      } else if (msg.includes("403")) {
        setFormError("You don't have permission to do this");
      } else {
        setFormError("Failed to save user");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (user: User) => {
    if (user.id === currentUser?.id) return;
    const doDelete = async () => {
      try {
        await apiRequest("DELETE", `/api/users/${user.id}`);
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
      } catch (err) {
        if (Platform.OS === "web") {
          window.alert("Failed to delete user");
        } else {
          Alert.alert("Error", "Failed to delete user");
        }
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Delete ${user.fullName}?`)) doDelete();
    } else {
      Alert.alert("Delete User", `Delete ${user.fullName}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const toggleActive = async (user: User) => {
    if (user.id === currentUser?.id) return;
    const newActive = user.isActive !== "true";
    try {
      const res = await apiRequest("PUT", `/api/users/${user.id}`, { isActive: newActive });
      const updated = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      console.error("Toggle active error:", err);
    }
  };

  // ============ ORG TAB ============
  const openOrgCreateModal = () => {
    setEditingOrgUnit(null);
    setOrgFormName("");
    setOrgFormType("team");
    setOrgFormParentId(null);
    setOrgModalVisible(true);
  };

  const openOrgEditModal = (unit: OrgUnit) => {
    setEditingOrgUnit(unit);
    setOrgFormName(unit.name);
    setOrgFormType(unit.type);
    setOrgFormParentId(unit.parentId);
    setOrgModalVisible(true);
  };

  const handleOrgSave = async () => {
    if (!orgFormName.trim()) return;
    setSaving(true);
    try {
      if (editingOrgUnit) {
        const res = await apiRequest("PUT", `/api/org-units/${editingOrgUnit.id}`, {
          name: orgFormName.trim(),
          type: orgFormType,
          parentId: orgFormParentId,
        });
        const updated = await res.json();
        setOrgUnits((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      } else {
        const res = await apiRequest("POST", "/api/org-units", {
          name: orgFormName.trim(),
          type: orgFormType,
          parentId: orgFormParentId,
        });
        const created = await res.json();
        setOrgUnits((prev) => [...prev, created]);
      }
      setOrgModalVisible(false);
    } catch (err) {
      console.error("Save org unit error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleOrgDelete = (unit: OrgUnit) => {
    const doDelete = async () => {
      try {
        await apiRequest("DELETE", `/api/org-units/${unit.id}`);
        setOrgUnits((prev) => prev.filter((u) => u.id !== unit.id));
      } catch (err) {
        console.error("Delete org unit error:", err);
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Delete "${unit.name}"?`)) doDelete();
    } else {
      Alert.alert("Delete", `Delete "${unit.name}"?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  // ============ TEAM GROUPING ============
  const groupedUsers = useMemo(() => {
    if (!isOwner) {
      return [{ title: "Your Team", data: users.filter((u) => u.id !== currentUser?.id) }];
    }
    const owners = users.filter((u) => u.role === "owner");
    const managersList = users.filter((u) => u.role === "manager");
    const reps = users.filter((u) => u.role === "rep");

    const sections: { title: string; data: User[] }[] = [];
    if (owners.length) sections.push({ title: "Owners", data: owners });

    for (const mgr of managersList) {
      const teamReps = reps.filter((r) => r.managerId === mgr.id);
      sections.push({
        title: `${mgr.fullName}'s Team`,
        data: [mgr, ...teamReps],
      });
    }

    const unassigned = reps.filter(
      (r) => !r.managerId || !managersList.some((a) => a.id === r.managerId)
    );
    if (unassigned.length) {
      sections.push({ title: "Unassigned Reps", data: unassigned });
    }

    return sections;
  }, [users, isOwner, currentUser]);

  const teamUserStats = useMemo(() => {
    const ownerCount = users.filter((u) => u.role === "owner").length;
    const managerCount = users.filter((u) => u.role === "manager").length;
    const repCount = users.filter((u) => u.role === "rep").length;
    const activeCount = users.filter((u) => u.isActive === "true").length;
    return { ownerCount, managerCount, repCount, activeCount, total: users.length };
  }, [users]);

  // ============ LEADS FILTERING ============
  const filteredLeads = useMemo(() => {
    let filtered = adminLeads;
    if (leadFilter !== "all") {
      filtered = filtered.filter((l) => l.status === leadFilter);
    }
    if (leadRepFilter !== "all") {
      filtered = filtered.filter((l) => l.userId === leadRepFilter);
    }
    if (leadSearch.trim()) {
      const q = leadSearch.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.firstName.toLowerCase().includes(q) ||
          l.lastName.toLowerCase().includes(q) ||
          l.address.toLowerCase().includes(q) ||
          l.repName.toLowerCase().includes(q)
      );
    }
    return filtered.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [adminLeads, leadFilter, leadRepFilter, leadSearch]);

  const leadStatusSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lead of adminLeads) {
      counts[lead.status] = (counts[lead.status] || 0) + 1;
    }
    return counts;
  }, [adminLeads]);

  // ============ PERFORMANCE SORTING ============
  const sortedStats = useMemo(() => {
    return [...teamStats].sort((a, b) => b.sales - a.sales);
  }, [teamStats]);

  const teamTotals = useMemo(() => {
    return teamStats.reduce(
      (acc, s) => ({
        totalLeads: acc.totalLeads + s.totalLeads,
        doorsKnocked: acc.doorsKnocked + s.doorsKnocked,
        contacts: acc.contacts + s.contacts,
        appointments: acc.appointments + s.appointments,
        sales: acc.sales + s.sales,
        todayDoors: acc.todayDoors + s.todayDoors,
        todaySales: acc.todaySales + s.todaySales,
        weekDoors: acc.weekDoors + s.weekDoors,
        weekSales: acc.weekSales + s.weekSales,
      }),
      { totalLeads: 0, doorsKnocked: 0, contacts: 0, appointments: 0, sales: 0, todayDoors: 0, todaySales: 0, weekDoors: 0, weekSales: 0 }
    );
  }, [teamStats]);

  // ============ ORG HIERARCHY ============
  const orgTree = useMemo(() => {
    const regions = orgUnits.filter((u) => u.type === "region");
    const areas = orgUnits.filter((u) => u.type === "area");
    const teams = orgUnits.filter((u) => u.type === "team");
    return { regions, areas, teams };
  }, [orgUnits]);

  const formatLastLogin = (lastLoginAt: string | null | undefined) => {
    if (!lastLoginAt) return "Never";
    const date = new Date(lastLoginAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return "No activity";
    return formatLastLogin(dateStr);
  };

  // ============ TAB CONFIG ============
  const tabs: { key: AdminTab; label: string; icon: string }[] = [
    { key: "team", label: "Team", icon: "people" },
    { key: "leads", label: "Leads", icon: "document-text" },
    { key: "performance", label: "Stats", icon: "bar-chart" },
    ...((isOwner || isManager) ? [{ key: "pos-sales" as AdminTab, label: "POS", icon: "card" }] : []),
    ...(isOwner ? [{ key: "organization" as AdminTab, label: "Org", icon: "git-network" }] : []),
  ];

  // ============ RENDER FUNCTIONS ============
  const renderUserCard = ({ item }: { item: User }) => {
    const isSelf = item.id === currentUser?.id;
    const isActive = item.isActive === "true";
    const roleConf = ROLE_CONFIG[item.role as Role] || ROLE_CONFIG.rep;
    const mgrName = getManagerName(item.managerId);
    const orgName = getOrgUnitName((item as any).orgUnitId);
    const shopifyStaff = (item as any).shopifyStaffName;
    const lastLogin = formatLastLogin(item.lastLoginAt);

    return (
      <View style={[styles.userCard, { backgroundColor: theme.surface, opacity: isActive ? 1 : 0.6 }]}>
        <Pressable style={styles.userCardContent} onPress={() => openEditModal(item)}>
          <View style={[styles.avatar, { backgroundColor: roleConf.color + "20" }]}>
            <Ionicons name={roleConf.icon as any} size={20} color={roleConf.color} />
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
              {item.fullName}
            </Text>
            <Text style={[styles.userMeta, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.email}
              {mgrName ? ` \u00B7 ${mgrName}'s team` : ""}
              {orgName ? ` \u00B7 ${orgName}` : ""}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
              <Text style={[styles.userLastLogin, { color: theme.textSecondary }]} numberOfLines={1}>
                Last login: {lastLogin}
              </Text>
              {shopifyStaff && (
                <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                  <Text style={{ fontSize: 9, color: "#059669", fontFamily: "Inter_600SemiBold" }}>POS: {shopifyStaff}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.userActions}>
            <View style={[styles.roleBadge, { backgroundColor: roleConf.color + "18" }]}>
              <Text style={[styles.roleBadgeText, { color: roleConf.color }]}>{roleConf.label}</Text>
            </View>
            {!isSelf && (
              <>
                <Pressable onPress={() => toggleActive(item)} style={styles.actionBtn}>
                  <Ionicons
                    name={isActive ? "checkmark-circle" : "close-circle"}
                    size={22}
                    color={isActive ? theme.success : theme.danger}
                  />
                </Pressable>
                <Pressable onPress={() => handleDelete(item)} style={styles.actionBtn}>
                  <Ionicons name="trash-outline" size={20} color={theme.danger} />
                </Pressable>
              </>
            )}
            {isSelf && (
              <View style={[styles.selfBadge, { backgroundColor: roleConf.color + "20" }]}>
                <Text style={[styles.selfBadgeText, { color: roleConf.color }]}>You</Text>
              </View>
            )}
          </View>
        </Pressable>
      </View>
    );
  };

  const renderLeadCard = ({ item }: { item: AdminLead }) => {
    const statusConf = LEAD_STATUS_CONFIG[item.status] || LEAD_STATUS_CONFIG.untouched;
    return (
      <Pressable
        style={[styles.leadCard, { backgroundColor: theme.surface }]}
        onPress={() => router.push({ pathname: "/lead-detail", params: { id: item.id } })}
      >
        <View style={styles.leadCardTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.leadName, { color: theme.text }]} numberOfLines={1}>
              {[item.firstName, item.lastName].filter(Boolean).join(" ") || "No Name"}
            </Text>
            <Text style={[styles.leadAddress, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.address || "No address"}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConf.color + "18" }]}>
            <View style={[styles.statusDot, { backgroundColor: statusConf.color }]} />
            <Text style={[styles.statusText, { color: statusConf.color }]}>{statusConf.label}</Text>
          </View>
        </View>
        <View style={styles.leadCardBottom}>
          <View style={styles.leadRepInfo}>
            <Ionicons name="person-outline" size={13} color={theme.textSecondary} />
            <Text style={[styles.leadRepName, { color: theme.textSecondary }]}>{item.repName}</Text>
          </View>
          <Text style={[styles.leadTime, { color: theme.textSecondary }]}>
            {formatTimeAgo(item.updatedAt)}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderRepStatsCard = ({ item }: { item: RepStats }) => {
    const roleConf = ROLE_CONFIG[item.role as Role] || ROLE_CONFIG.rep;
    const displayDoors = statsPeriod === "today" ? item.todayDoors : statsPeriod === "week" ? item.weekDoors : item.doorsKnocked;
    const displaySales = statsPeriod === "today" ? item.todaySales : statsPeriod === "week" ? item.weekSales : item.sales;
    const displayContacts = statsPeriod === "all" ? item.contacts : 0;
    const displayAppts = statsPeriod === "all" ? item.appointments : 0;

    return (
      <View style={[styles.statsCard, { backgroundColor: theme.surface }]}>
        <View style={styles.statsCardHeader}>
          <View style={[styles.miniAvatar, { backgroundColor: roleConf.color + "20" }]}>
            <Ionicons name={roleConf.icon as any} size={14} color={roleConf.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statsRepName, { color: theme.text }]} numberOfLines={1}>
              {item.repName}
            </Text>
            <Text style={[styles.statsRepMeta, { color: theme.textSecondary }]}>
              {item.totalLeads} leads {"\u00B7"} Last active: {formatTimeAgo(item.lastActivity)}
            </Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: roleConf.color + "18" }]}>
            <Text style={[styles.roleBadgeText, { color: roleConf.color }]}>{roleConf.label}</Text>
          </View>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={[styles.statBoxValue, { color: "#3B82F6" }]}>{displayDoors}</Text>
            <Text style={[styles.statBoxLabel, { color: theme.textSecondary }]}>Doors</Text>
          </View>
          {statsPeriod === "all" && (
            <View style={styles.statBox}>
              <Text style={[styles.statBoxValue, { color: "#06B6D4" }]}>{displayContacts}</Text>
              <Text style={[styles.statBoxLabel, { color: theme.textSecondary }]}>Contacts</Text>
            </View>
          )}
          {statsPeriod === "all" && (
            <View style={styles.statBox}>
              <Text style={[styles.statBoxValue, { color: "#8B5CF6" }]}>{displayAppts}</Text>
              <Text style={[styles.statBoxLabel, { color: theme.textSecondary }]}>Appts</Text>
            </View>
          )}
          <View style={styles.statBox}>
            <Text style={[styles.statBoxValue, { color: "#10B981" }]}>{displaySales}</Text>
            <Text style={[styles.statBoxLabel, { color: theme.textSecondary }]}>Sales</Text>
          </View>
          {statsPeriod === "all" && (
            <>
              <View style={styles.statBox}>
                <Text style={[styles.statBoxValue, { color: theme.text }]}>{item.contactRate}%</Text>
                <Text style={[styles.statBoxLabel, { color: theme.textSecondary }]}>Contact</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statBoxValue, { color: theme.text }]}>{item.closeRate}%</Text>
                <Text style={[styles.statBoxLabel, { color: theme.textSecondary }]}>Close</Text>
              </View>
            </>
          )}
        </View>
      </View>
    );
  };

  const allTeamItems = useMemo(() => {
    const result: (User | { type: "header"; title: string })[] = [];
    for (const section of groupedUsers) {
      result.push({ type: "header", title: section.title } as any);
      result.push(...section.data);
    }
    return result;
  }, [groupedUsers]);

  const availableRoles: Role[] = isOwner ? ["owner", "manager", "rep"] : ["rep"];

  // Unique reps for the leads filter
  const uniqueReps = useMemo(() => {
    const repMap = new Map<string, string>();
    adminLeads.forEach((l) => {
      if (!repMap.has(l.userId)) repMap.set(l.userId, l.repName);
    });
    return Array.from(repMap.entries()).map(([id, name]) => ({ id, name }));
  }, [adminLeads]);

  // ============ RENDER TAB CONTENT ============
  const renderTeamTab = () => (
    <>
      {!loading && (
        <View style={[styles.statsBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: ROLE_CONFIG.owner.color }]}>{teamUserStats.ownerCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Owners</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: ROLE_CONFIG.manager.color }]}>{teamUserStats.managerCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Managers</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: ROLE_CONFIG.rep.color }]}>{teamUserStats.repCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Reps</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>{teamUserStats.activeCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Active</Text>
          </View>
        </View>
      )}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      ) : (
        <FlatList
          data={allTeamItems}
          keyExtractor={(item: any) => item.type === "header" ? `header-${item.title}` : item.id}
          renderItem={({ item }: any) => {
            if (item.type === "header") {
              return (
                <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
                  {item.title}
                </Text>
              );
            }
            return renderUserCard({ item });
          }}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 20 }]}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No team members yet</Text>
            </View>
          }
        />
      )}
    </>
  );

  const renderLeadsTab = () => (
    <View style={{ flex: 1 }}>
      {/* Lead status summary bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 6, alignItems: "center" }}
      >
        <Pressable
          style={[
            styles.filterChip,
            {
              backgroundColor: leadFilter === "all" ? theme.tint : theme.background,
              borderColor: leadFilter === "all" ? theme.tint : theme.border,
            },
          ]}
          onPress={() => setLeadFilter("all")}
        >
          <Text style={{ color: leadFilter === "all" ? "#FFF" : theme.text, fontFamily: "Inter_500Medium", fontSize: 12 }}>
            All ({adminLeads.length})
          </Text>
        </Pressable>
        {(Object.keys(LEAD_STATUS_CONFIG) as LeadStatus[]).map((status) => {
          const config = LEAD_STATUS_CONFIG[status];
          const count = leadStatusSummary[status] || 0;
          if (count === 0) return null;
          const selected = leadFilter === status;
          return (
            <Pressable
              key={status}
              style={[
                styles.filterChip,
                {
                  backgroundColor: selected ? config.color : theme.background,
                  borderColor: selected ? config.color : theme.border,
                },
              ]}
              onPress={() => setLeadFilter(selected ? "all" : status)}
            >
              <Text style={{ color: selected ? "#FFF" : theme.text, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                {config.label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Org unit filter */}
      {orgUnits.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.filterBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 6, alignItems: "center" }}
        >
          <Ionicons name="git-network-outline" size={14} color={theme.textSecondary} />
          <Pressable
            style={[
              styles.filterChip,
              {
                backgroundColor: !leadOrgFilter ? theme.tint + "18" : theme.background,
                borderColor: !leadOrgFilter ? theme.tint : theme.border,
              },
            ]}
            onPress={() => setLeadOrgFilter("")}
          >
            <Text style={{ color: !leadOrgFilter ? theme.tint : theme.textSecondary, fontFamily: "Inter_500Medium", fontSize: 11 }}>
              All Units
            </Text>
          </Pressable>
          {[...orgUnits]
            .sort((a, b) => {
              const order: Record<string, number> = { region: 1, area: 2, team: 3 };
              return (order[a.type] || 9) - (order[b.type] || 9);
            })
            .map((unit) => {
              const selected = leadOrgFilter === unit.id;
              const typeColors: Record<string, string> = { region: "#8B5CF6", area: "#3B82F6", team: "#10B981" };
              const color = typeColors[unit.type] || theme.tint;
              return (
                <Pressable
                  key={unit.id}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selected ? color + "18" : theme.background,
                      borderColor: selected ? color : theme.border,
                    },
                  ]}
                  onPress={() => setLeadOrgFilter(selected ? "" : unit.id)}
                >
                  <Text style={{ color: selected ? color : theme.textSecondary, fontFamily: "Inter_500Medium", fontSize: 11 }}>
                    {unit.name}
                  </Text>
                </Pressable>
              );
            })}
        </ScrollView>
      )}

      {/* Rep filter + search */}
      <View style={[styles.searchRow, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={[styles.searchInput, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Ionicons name="search" size={16} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchText, { color: theme.text }]}
            value={leadSearch}
            onChangeText={setLeadSearch}
            placeholder="Search leads..."
            placeholderTextColor={theme.textSecondary}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexShrink: 1 }}>
          <Pressable
            style={[
              styles.repFilterChip,
              {
                backgroundColor: leadRepFilter === "all" ? theme.tint + "18" : theme.background,
                borderColor: leadRepFilter === "all" ? theme.tint : theme.border,
              },
            ]}
            onPress={() => setLeadRepFilter("all")}
          >
            <Text style={{ color: leadRepFilter === "all" ? theme.tint : theme.textSecondary, fontFamily: "Inter_500Medium", fontSize: 11 }}>
              All Reps
            </Text>
          </Pressable>
          {uniqueReps.map((rep) => {
            const selected = leadRepFilter === rep.id;
            return (
              <Pressable
                key={rep.id}
                style={[
                  styles.repFilterChip,
                  {
                    backgroundColor: selected ? theme.tint + "18" : theme.background,
                    borderColor: selected ? theme.tint : theme.border,
                  },
                ]}
                onPress={() => setLeadRepFilter(selected ? "all" : rep.id)}
              >
                <Text style={{ color: selected ? theme.tint : theme.textSecondary, fontFamily: "Inter_500Medium", fontSize: 11 }}>
                  {rep.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {leadsLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      ) : (
        <FlatList
          data={filteredLeads}
          keyExtractor={(item) => item.id}
          renderItem={renderLeadCard}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 20 }]}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No leads found</Text>
            </View>
          }
          ListHeaderComponent={
            <Text style={[styles.resultCount, { color: theme.textSecondary }]}>
              {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}
            </Text>
          }
        />
      )}
    </View>
  );

  const renderPerformanceTab = () => (
    <View style={{ flex: 1 }}>
      {/* Period selector */}
      <View style={[styles.periodRow, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        {(["today", "week", "all"] as const).map((p) => (
          <Pressable
            key={p}
            onPress={() => setStatsPeriod(p)}
            style={[
              styles.periodBtn,
              { backgroundColor: statsPeriod === p ? theme.tint : "transparent" },
            ]}
          >
            <Text style={{ color: statsPeriod === p ? "#FFF" : theme.textSecondary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
              {p === "today" ? "Today" : p === "week" ? "This Week" : "All Time"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Org unit filter */}
      {orgUnits.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.filterBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 6, alignItems: "center" }}
        >
          <Ionicons name="git-network-outline" size={14} color={theme.textSecondary} />
          <Pressable
            style={[
              styles.filterChip,
              {
                backgroundColor: !statsOrgFilter ? theme.tint + "18" : theme.background,
                borderColor: !statsOrgFilter ? theme.tint : theme.border,
              },
            ]}
            onPress={() => setStatsOrgFilter("")}
          >
            <Text style={{ color: !statsOrgFilter ? theme.tint : theme.textSecondary, fontFamily: "Inter_500Medium", fontSize: 11 }}>
              All Units
            </Text>
          </Pressable>
          {[...orgUnits]
            .sort((a, b) => {
              const order: Record<string, number> = { region: 1, area: 2, team: 3 };
              return (order[a.type] || 9) - (order[b.type] || 9);
            })
            .map((unit) => {
              const selected = statsOrgFilter === unit.id;
              const typeColors: Record<string, string> = { region: "#8B5CF6", area: "#3B82F6", team: "#10B981" };
              const color = typeColors[unit.type] || theme.tint;
              return (
                <Pressable
                  key={unit.id}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selected ? color + "18" : theme.background,
                      borderColor: selected ? color : theme.border,
                    },
                  ]}
                  onPress={() => setStatsOrgFilter(selected ? "" : unit.id)}
                >
                  <Text style={{ color: selected ? color : theme.textSecondary, fontFamily: "Inter_500Medium", fontSize: 11 }}>
                    {unit.name}
                  </Text>
                </Pressable>
              );
            })}
        </ScrollView>
      )}

      {statsLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      ) : (
        <FlatList
          data={sortedStats}
          keyExtractor={(item) => item.userId}
          renderItem={renderRepStatsCard}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 20 }]}
          ListHeaderComponent={
            <View style={[styles.teamTotalsCard, { backgroundColor: theme.surface }]}>
              <Text style={[styles.teamTotalsTitle, { color: theme.text }]}>Team Totals</Text>
              <View style={styles.teamTotalsGrid}>
                <View style={styles.teamTotalItem}>
                  <Text style={[styles.teamTotalValue, { color: "#3B82F6" }]}>
                    {statsPeriod === "today" ? teamTotals.todayDoors : statsPeriod === "week" ? teamTotals.weekDoors : teamTotals.doorsKnocked}
                  </Text>
                  <Text style={[styles.teamTotalLabel, { color: theme.textSecondary }]}>Doors</Text>
                </View>
                {statsPeriod === "all" && (
                  <View style={styles.teamTotalItem}>
                    <Text style={[styles.teamTotalValue, { color: "#06B6D4" }]}>{teamTotals.contacts}</Text>
                    <Text style={[styles.teamTotalLabel, { color: theme.textSecondary }]}>Contacts</Text>
                  </View>
                )}
                {statsPeriod === "all" && (
                  <View style={styles.teamTotalItem}>
                    <Text style={[styles.teamTotalValue, { color: "#8B5CF6" }]}>{teamTotals.appointments}</Text>
                    <Text style={[styles.teamTotalLabel, { color: theme.textSecondary }]}>Appts</Text>
                  </View>
                )}
                <View style={styles.teamTotalItem}>
                  <Text style={[styles.teamTotalValue, { color: "#10B981" }]}>
                    {statsPeriod === "today" ? teamTotals.todaySales : statsPeriod === "week" ? teamTotals.weekSales : teamTotals.sales}
                  </Text>
                  <Text style={[styles.teamTotalLabel, { color: theme.textSecondary }]}>Sales</Text>
                </View>
                <View style={styles.teamTotalItem}>
                  <Text style={[styles.teamTotalValue, { color: theme.text }]}>{teamTotals.totalLeads}</Text>
                  <Text style={[styles.teamTotalLabel, { color: theme.textSecondary }]}>Total Leads</Text>
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No team performance data</Text>
            </View>
          }
        />
      )}
    </View>
  );

  const formatCurrency = (val: any) => {
    if (val == null || val === "") return "$0";
    const num = parseFloat(val);
    if (isNaN(num)) return "$0";
    return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const renderPosSalesTab = () => {
    const staffUserMap = new Map<string, User>();
    users.forEach((u) => {
      if ((u as any).shopifyStaffName) {
        staffUserMap.set((u as any).shopifyStaffName.toLowerCase(), u);
      }
    });

    const rows = posSummary?.rows || [];
    const totalsRow = rows.find((r: any) => !r.staff_member_name);
    const staffRows = rows.filter((r: any) => r.staff_member_name);

    return (
      <View style={{ flex: 1 }}>
        {/* Period selector */}
        <View style={[styles.periodRow, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          {([1, 7, 30, 90] as const).map((d) => (
            <Pressable
              key={d}
              onPress={() => { setPosDays(d); fetchPosSales(d); }}
              style={[
                styles.periodBtn,
                { backgroundColor: posDays === d ? "#10B981" : "transparent" },
              ]}
            >
              <Text style={{ color: posDays === d ? "#FFF" : theme.textSecondary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                {d === 1 ? "Today" : `${d} Days`}
              </Text>
            </Pressable>
          ))}
        </View>

        {posLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        ) : !posSummary ? (
          <View style={styles.center}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Failed to load POS data. Check Shopify Admin API credentials.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 20 }]}>
            {/* Team totals */}
            {totalsRow && (
              <View style={[styles.teamTotalsCard, { backgroundColor: theme.surface }]}>
                <Text style={[styles.teamTotalsTitle, { color: theme.text }]}>
                  POS Team Totals ({posDays === 1 ? "Today" : `${posDays} Days`})
                </Text>
                <View style={styles.teamTotalsGrid}>
                  <View style={styles.teamTotalItem}>
                    <Text style={[styles.teamTotalValue, { color: "#3B82F6" }]}>{totalsRow.orders || 0}</Text>
                    <Text style={[styles.teamTotalLabel, { color: theme.textSecondary }]}>Orders</Text>
                  </View>
                  <View style={styles.teamTotalItem}>
                    <Text style={[styles.teamTotalValue, { color: "#10B981" }]}>{formatCurrency(totalsRow.total_sales)}</Text>
                    <Text style={[styles.teamTotalLabel, { color: theme.textSecondary }]}>Total</Text>
                  </View>
                  <View style={styles.teamTotalItem}>
                    <Text style={[styles.teamTotalValue, { color: "#8B5CF6" }]}>{formatCurrency(totalsRow.net_sales)}</Text>
                    <Text style={[styles.teamTotalLabel, { color: theme.textSecondary }]}>Net</Text>
                  </View>
                  <View style={styles.teamTotalItem}>
                    <Text style={[styles.teamTotalValue, { color: "#F59E0B" }]}>{formatCurrency(totalsRow.average_order_value)}</Text>
                    <Text style={[styles.teamTotalLabel, { color: theme.textSecondary }]}>Avg Order</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Per-staff cards */}
            {staffRows.length === 0 ? (
              <View style={styles.center}>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No POS staff sales for this period</Text>
              </View>
            ) : (
              staffRows.map((row: any, idx: number) => {
                const name = row.staff_member_name || "Unknown";
                const linkedUser = staffUserMap.get(name.toLowerCase());
                const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

                return (
                  <View key={idx} style={[styles.statsCard, { backgroundColor: theme.surface }]}>
                    <View style={styles.statsCardHeader}>
                      <View style={[styles.miniAvatar, { backgroundColor: linkedUser ? "#10B98120" : "#94A3B820" }]}>
                        <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: linkedUser ? "#10B981" : "#94A3B8" }}>
                          {initials}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={[styles.statsRepName, { color: theme.text }]} numberOfLines={1}>
                            {name}
                          </Text>
                          {linkedUser && (
                            <View style={{ backgroundColor: "#D1FAE5", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                              <Text style={{ fontSize: 9, color: "#059669", fontFamily: "Inter_600SemiBold" }}>Linked</Text>
                            </View>
                          )}
                        </View>
                        {linkedUser && (
                          <Text style={[styles.statsRepMeta, { color: theme.textSecondary }]}>
                            {linkedUser.email}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.statsGrid}>
                      <View style={styles.statBox}>
                        <Text style={[styles.statBoxValue, { color: "#3B82F6" }]}>{row.orders || 0}</Text>
                        <Text style={[styles.statBoxLabel, { color: theme.textSecondary }]}>Orders</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={[styles.statBoxValue, { color: "#10B981" }]}>{formatCurrency(row.total_sales)}</Text>
                        <Text style={[styles.statBoxLabel, { color: theme.textSecondary }]}>Total</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={[styles.statBoxValue, { color: "#8B5CF6" }]}>{formatCurrency(row.net_sales)}</Text>
                        <Text style={[styles.statBoxLabel, { color: theme.textSecondary }]}>Net</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={[styles.statBoxValue, { color: "#F59E0B" }]}>{formatCurrency(row.average_order_value)}</Text>
                        <Text style={[styles.statBoxLabel, { color: theme.textSecondary }]}>Avg</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={[styles.statBoxValue, { color: "#EF4444" }]}>{formatCurrency(row.discounts)}</Text>
                        <Text style={[styles.statBoxLabel, { color: theme.textSecondary }]}>Discounts</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={[styles.statBoxValue, { color: "#64748B" }]}>{formatCurrency(row.taxes)}</Text>
                        <Text style={[styles.statBoxLabel, { color: theme.textSecondary }]}>Taxes</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </View>
    );
  };

  const renderOrganizationTab = () => {
    const getParentName = (parentId: string | null) => {
      if (!parentId) return null;
      const parent = orgUnits.find((u) => u.id === parentId);
      return parent?.name || null;
    };

    const getChildCount = (unitId: string) => {
      return orgUnits.filter((u) => u.parentId === unitId).length;
    };

    const getUserCount = (unitId: string) => {
      // Count users in this unit + all descendant units
      const descendantIds: string[] = [];
      const collectDescendants = (parentId: string) => {
        for (const u of orgUnits) {
          if (u.parentId === parentId) {
            descendantIds.push(u.id);
            collectDescendants(u.id);
          }
        }
      };
      collectDescendants(unitId);
      const allIds = [unitId, ...descendantIds];
      return users.filter((u) => allIds.includes((u as any).orgUnitId)).length;
    };

    return (
      <View style={{ flex: 1 }}>
        {orgLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.tint} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 20 }]}>
            <Text style={[styles.orgDescription, { color: theme.textSecondary }]}>
              Organize your team using a SalesRabbit-style hierarchy: Regions (by state), Areas (by city/county), and Teams (sub-groups).
            </Text>

            {ORG_UNIT_TYPES.map(({ value: type, label, icon, color }) => {
              const items = orgUnits.filter((u) => u.type === type);
              return (
                <View key={type} style={{ marginBottom: 16 }}>
                  <View style={styles.orgSectionHeader}>
                    <Ionicons name={icon as any} size={18} color={color} />
                    <Text style={[styles.orgSectionTitle, { color: theme.text }]}>
                      {label}s ({items.length})
                    </Text>
                  </View>
                  {items.length === 0 ? (
                    <Text style={[styles.orgEmpty, { color: theme.textSecondary }]}>
                      No {label.toLowerCase()}s yet
                    </Text>
                  ) : (
                    items.map((unit) => {
                      const memberCount = getUserCount(unit.id);
                      const directMembers = users.filter((u) => (u as any).orgUnitId === unit.id);
                      return (
                        <View key={unit.id} style={[styles.orgCard, { backgroundColor: theme.surface }]}>
                          <Pressable style={styles.orgCardContent} onPress={() => openOrgEditModal(unit)}>
                            <View style={[styles.orgDot, { backgroundColor: color }]} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.orgName, { color: theme.text }]}>{unit.name}</Text>
                              {getParentName(unit.parentId) && (
                                <Text style={[styles.orgParent, { color: theme.textSecondary }]}>
                                  Parent: {getParentName(unit.parentId)}
                                </Text>
                              )}
                              {directMembers.length > 0 && (
                                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                                  {directMembers.map((m) => {
                                    const rc = ROLE_CONFIG[m.role as Role] || ROLE_CONFIG.rep;
                                    return (
                                      <View key={m.id} style={{ backgroundColor: rc.color + "14", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                        <Text style={{ fontSize: 10, color: rc.color, fontFamily: "Inter_500Medium" }}>{m.fullName}</Text>
                                      </View>
                                    );
                                  })}
                                </View>
                              )}
                            </View>
                            <View style={styles.orgMeta}>
                              {memberCount > 0 && (
                                <View style={{ backgroundColor: theme.background, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                                  <Text style={[styles.orgMetaText, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>
                                    {memberCount}
                                  </Text>
                                </View>
                              )}
                              {getChildCount(unit.id) > 0 && (
                                <Text style={[styles.orgMetaText, { color: theme.textSecondary }]}>
                                  {getChildCount(unit.id)} sub
                                </Text>
                              )}
                            </View>
                            <Pressable onPress={() => handleOrgDelete(unit)} style={styles.actionBtn}>
                              <Ionicons name="trash-outline" size={18} color={theme.danger} />
                            </Pressable>
                          </Pressable>
                        </View>
                      );
                    })
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + webTopInset + 12,
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.tint} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Admin Panel</Text>
        {activeTab === "team" && (
          <Pressable onPress={openCreateModal} style={styles.addBtn}>
            <Ionicons name="person-add" size={22} color={theme.tint} />
          </Pressable>
        )}
        {activeTab === "leads" && (
          <Pressable onPress={() => fetchAdminLeads(leadOrgFilter || undefined)} style={styles.addBtn}>
            <Ionicons name="refresh" size={22} color={theme.tint} />
          </Pressable>
        )}
        {activeTab === "performance" && (
          <Pressable onPress={() => fetchTeamStats(statsOrgFilter || undefined)} style={styles.addBtn}>
            <Ionicons name="refresh" size={22} color={theme.tint} />
          </Pressable>
        )}
        {activeTab === "pos-sales" && (
          <Pressable onPress={() => fetchPosSales(posDays)} style={styles.addBtn}>
            <Ionicons name="refresh" size={22} color={theme.tint} />
          </Pressable>
        )}
        {activeTab === "organization" && (
          <Pressable onPress={openOrgCreateModal} style={styles.addBtn}>
            <Ionicons name="add-circle-outline" size={22} color={theme.tint} />
          </Pressable>
        )}
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tab, active && { borderBottomColor: theme.tint, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons name={tab.icon as any} size={18} color={active ? theme.tint : theme.textSecondary} />
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? theme.tint : theme.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tab content */}
      {activeTab === "team" && renderTeamTab()}
      {activeTab === "leads" && renderLeadsTab()}
      {activeTab === "performance" && renderPerformanceTab()}
      {activeTab === "pos-sales" && renderPosSalesTab()}
      {activeTab === "organization" && renderOrganizationTab()}

      {/* User form modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {editingUser ? "Edit User" : "Add Team Member"}
                </Text>
                <Pressable onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={theme.textSecondary} />
                </Pressable>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Email (login)</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={formEmail}
                  onChangeText={setFormEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="email@example.com"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Full Name</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={formFullName}
                  onChangeText={setFormFullName}
                  placeholder="Full name"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Username (optional)</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={formUsername}
                  onChangeText={setFormUsername}
                  autoCapitalize="none"
                  placeholder="username"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Phone</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={formPhone}
                  onChangeText={setFormPhone}
                  keyboardType="phone-pad"
                  placeholder="555-0100"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Role</Text>
                <View style={styles.roleRow}>
                  {availableRoles.map((role) => {
                    const conf = ROLE_CONFIG[role];
                    const isSelected = formRole === role;
                    return (
                      <Pressable
                        key={role}
                        style={[
                          styles.roleBtn,
                          {
                            backgroundColor: isSelected ? conf.color : theme.background,
                            borderColor: isSelected ? conf.color : theme.border,
                          },
                        ]}
                        onPress={() => {
                          setFormRole(role);
                          if (role !== "rep") setFormManagerId(null);
                        }}
                      >
                        <Ionicons
                          name={conf.icon as any}
                          size={14}
                          color={isSelected ? "#FFF" : theme.textSecondary}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={{ color: isSelected ? "#FFF" : theme.text, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                          {conf.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {isOwner && formRole === "rep" && managers.length > 0 && (
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Assign to Manager</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.adminScroll}>
                    <Pressable
                      style={[
                        styles.adminChip,
                        {
                          backgroundColor: !formManagerId ? theme.accent : theme.background,
                          borderColor: !formManagerId ? theme.accent : theme.border,
                        },
                      ]}
                      onPress={() => setFormManagerId(null)}
                    >
                      <Text style={{ color: !formManagerId ? "#FFF" : theme.text, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                        Unassigned
                      </Text>
                    </Pressable>
                    {managers.map((mgr) => {
                      const selected = formManagerId === mgr.id;
                      return (
                        <Pressable
                          key={mgr.id}
                          style={[
                            styles.adminChip,
                            {
                              backgroundColor: selected ? theme.accent : theme.background,
                              borderColor: selected ? theme.accent : theme.border,
                            },
                          ]}
                          onPress={() => setFormManagerId(mgr.id)}
                        >
                          <Text style={{ color: selected ? "#FFF" : theme.text, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                            {mgr.fullName}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {orgUnits.length > 0 && (
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Org Unit</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.adminScroll}>
                    <Pressable
                      style={[
                        styles.adminChip,
                        {
                          backgroundColor: !formOrgUnitId ? theme.accent : theme.background,
                          borderColor: !formOrgUnitId ? theme.accent : theme.border,
                        },
                      ]}
                      onPress={() => setFormOrgUnitId(null)}
                    >
                      <Text style={{ color: !formOrgUnitId ? "#FFF" : theme.text, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                        None
                      </Text>
                    </Pressable>
                    {[...orgUnits]
                      .sort((a, b) => {
                        const order: Record<string, number> = { region: 1, area: 2, team: 3 };
                        return (order[a.type] || 9) - (order[b.type] || 9);
                      })
                      .map((unit) => {
                        const selected = formOrgUnitId === unit.id;
                        const typeColors: Record<string, string> = { region: "#8B5CF6", area: "#3B82F6", team: "#10B981" };
                        const typeColor = typeColors[unit.type] || theme.tint;
                        return (
                          <Pressable
                            key={unit.id}
                            style={[
                              styles.adminChip,
                              {
                                backgroundColor: selected ? typeColor + "20" : theme.background,
                                borderColor: selected ? typeColor : theme.border,
                              },
                            ]}
                            onPress={() => setFormOrgUnitId(unit.id)}
                          >
                            <Text style={{ color: selected ? typeColor : theme.text, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                              {unit.name} ({unit.type})
                            </Text>
                          </Pressable>
                        );
                      })}
                  </ScrollView>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Shopify POS Staff Name</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={formShopifyStaffName}
                  onChangeText={setFormShopifyStaffName}
                  placeholder="e.g. Walter, Colby (must match Shopify POS)"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="words"
                />
              </View>

              {editingUser && editingUser.id !== currentUser?.id && (
                <View style={[styles.formGroup, styles.switchRow]}>
                  <Text style={[styles.label, { color: theme.textSecondary, marginBottom: 0 }]}>Account Active</Text>
                  <Switch value={formActive} onValueChange={setFormActive} trackColor={{ true: theme.tint }} />
                </View>
              )}

              {formError ? (
                <View style={styles.formErrorRow}>
                  <Ionicons name="alert-circle" size={16} color={theme.danger} />
                  <Text style={[styles.formErrorText, { color: theme.danger }]}>{formError}</Text>
                </View>
              ) : null}

              <Pressable
                style={[styles.saveBtn, { backgroundColor: theme.tint, opacity: saving ? 0.7 : 1 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>{editingUser ? "Save Changes" : "Add Member"}</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Org unit form modal */}
      <Modal visible={orgModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {editingOrgUnit ? "Edit Unit" : "Add Org Unit"}
                </Text>
                <Pressable onPress={() => setOrgModalVisible(false)}>
                  <Ionicons name="close" size={24} color={theme.textSecondary} />
                </Pressable>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Name</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={orgFormName}
                  onChangeText={setOrgFormName}
                  placeholder="e.g. Mississippi, Jackson Metro, Team Alpha"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Type</Text>
                <View style={styles.roleRow}>
                  {ORG_UNIT_TYPES.map((t) => {
                    const isSelected = orgFormType === t.value;
                    return (
                      <Pressable
                        key={t.value}
                        style={[
                          styles.roleBtn,
                          {
                            backgroundColor: isSelected ? t.color : theme.background,
                            borderColor: isSelected ? t.color : theme.border,
                          },
                        ]}
                        onPress={() => setOrgFormType(t.value)}
                      >
                        <Ionicons
                          name={t.icon as any}
                          size={14}
                          color={isSelected ? "#FFF" : theme.textSecondary}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={{ color: isSelected ? "#FFF" : theme.text, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                          {t.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {orgFormType !== "region" && orgUnits.length > 0 && (
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Parent Unit</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.adminScroll}>
                    <Pressable
                      style={[
                        styles.adminChip,
                        {
                          backgroundColor: !orgFormParentId ? theme.accent : theme.background,
                          borderColor: !orgFormParentId ? theme.accent : theme.border,
                        },
                      ]}
                      onPress={() => setOrgFormParentId(null)}
                    >
                      <Text style={{ color: !orgFormParentId ? "#FFF" : theme.text, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                        None
                      </Text>
                    </Pressable>
                    {orgUnits
                      .filter((u) => {
                        if (orgFormType === "area") return u.type === "region";
                        if (orgFormType === "team") return u.type === "area" || u.type === "region";
                        return false;
                      })
                      .map((unit) => {
                        const selected = orgFormParentId === unit.id;
                        return (
                          <Pressable
                            key={unit.id}
                            style={[
                              styles.adminChip,
                              {
                                backgroundColor: selected ? theme.accent : theme.background,
                                borderColor: selected ? theme.accent : theme.border,
                              },
                            ]}
                            onPress={() => setOrgFormParentId(unit.id)}
                          >
                            <Text style={{ color: selected ? "#FFF" : theme.text, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                              {unit.name} ({unit.type})
                            </Text>
                          </Pressable>
                        );
                      })}
                  </ScrollView>
                </View>
              )}

              <Pressable
                style={[styles.saveBtn, { backgroundColor: theme.tint, opacity: saving ? 0.7 : 1 }]}
                onPress={handleOrgSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>{editingOrgUnit ? "Save Changes" : "Add Unit"}</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold" },
  addBtn: { padding: 4 },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 4,
  },
  tabLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  statItem: { alignItems: "center", flex: 1 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  statDivider: { width: 1, height: 28, marginHorizontal: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  list: { padding: 16, gap: 8 },
  sectionHeader: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  userCard: { borderRadius: 12, overflow: "hidden" },
  userCardContent: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  userMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  userLastLogin: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2, opacity: 0.7 },
  userActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  actionBtn: { padding: 4 },
  selfBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  selfBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },

  // Leads tab
  filterBar: {
    borderBottomWidth: 1,
    paddingVertical: 8,
    maxHeight: 50,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  searchInput: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
    minWidth: 140,
  },
  searchText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  repFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 6,
  },
  resultCount: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  leadCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 2,
  },
  leadCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  leadName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  leadAddress: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  leadCardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  leadRepInfo: { flexDirection: "row", alignItems: "center", gap: 4 },
  leadRepName: { fontSize: 12, fontFamily: "Inter_500Medium" },
  leadTime: { fontSize: 11, fontFamily: "Inter_400Regular" },

  // Performance tab
  periodRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
    borderBottomWidth: 1,
  },
  periodBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statsCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 2,
  },
  statsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  miniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRepName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  statsRepMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  statBox: {
    flex: 1,
    minWidth: 60,
    alignItems: "center",
    paddingVertical: 6,
  },
  statBoxValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statBoxLabel: { fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 2, textTransform: "uppercase" as const },
  teamTotalsCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  teamTotalsTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 12,
  },
  teamTotalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  teamTotalItem: {
    flex: 1,
    minWidth: 70,
    alignItems: "center",
    paddingVertical: 8,
  },
  teamTotalValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  teamTotalLabel: { fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 2, textTransform: "uppercase" as const },

  // Organization tab
  orgDescription: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    marginBottom: 16,
  },
  orgSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  orgSectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  orgEmpty: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    paddingLeft: 26,
    marginBottom: 8,
  },
  orgCard: {
    borderRadius: 10,
    marginBottom: 6,
  },
  orgCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
  },
  orgDot: { width: 8, height: 8, borderRadius: 4 },
  orgName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  orgParent: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  orgMeta: { flexDirection: "row", gap: 8 },
  orgMetaText: { fontSize: 11, fontFamily: "Inter_400Regular" },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: "85%",
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 6 },
  formInput: {
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
  },
  roleRow: { flexDirection: "row", gap: 8 },
  roleBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, flexDirection: "row" },
  adminScroll: { flexDirection: "row" },
  adminChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  formErrorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  formErrorText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  saveBtn: { height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 4 },
  saveBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
