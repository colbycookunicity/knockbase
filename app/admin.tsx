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
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/lib/useTheme";
import { useAuth, User } from "@/lib/auth-context";
import { apiRequest } from "@/lib/query-client";

type Role = "owner" | "admin" | "rep";

const ROLE_CONFIG: Record<Role, { label: string; icon: string; color: string }> = {
  owner: { label: "Owner", icon: "shield", color: "#8B5CF6" },
  admin: { label: "Admin", icon: "briefcase", color: "#3B82F6" },
  rep: { label: "Rep", icon: "person", color: "#10B981" },
};

export default function AdminScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: currentUser, isOwner, isAdmin } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formUsername, setFormUsername] = useState("");
  const [formFullName, setFormFullName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState<Role>("rep");
  const [formManagerId, setFormManagerId] = useState<string | null>(null);
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const admins = useMemo(() => {
    return users.filter((u) => u.role === "admin");
  }, [users]);

  const getAdminName = (managerId: string | null) => {
    if (!managerId) return null;
    const mgr = users.find((u) => u.id === managerId);
    return mgr?.fullName || null;
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormUsername("");
    setFormFullName("");
    setFormEmail("");
    setFormPhone("");
    setFormRole(isAdmin ? "rep" : "rep");
    setFormManagerId(isAdmin ? (currentUser?.id ?? null) : null);
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
    setFormRole(user.role);
    setFormManagerId(user.managerId);
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

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  // Build team-grouped view for owners, flat list for admins
  const groupedUsers = useMemo(() => {
    if (!isOwner) {
      // Admin sees their own team
      return [{ title: "Your Team", data: users.filter((u) => u.id !== currentUser?.id) }];
    }

    // Owner sees the full team hierarchy
    const owners = users.filter((u) => u.role === "owner");
    const adminsList = users.filter((u) => u.role === "admin");
    const reps = users.filter((u) => u.role === "rep");

    const sections: { title: string; data: User[] }[] = [];
    if (owners.length) sections.push({ title: "Owners", data: owners });

    // Group reps under their admins for team view
    for (const admin of adminsList) {
      const teamReps = reps.filter((r) => r.managerId === admin.id);
      sections.push({
        title: `${admin.fullName}'s Team`,
        data: [admin, ...teamReps],
      });
    }

    // Unassigned reps (no admin)
    const unassigned = reps.filter(
      (r) => !r.managerId || !adminsList.some((a) => a.id === r.managerId)
    );
    if (unassigned.length) {
      sections.push({ title: "Unassigned Reps", data: unassigned });
    }

    return sections;
  }, [users, isOwner, currentUser]);

  // Stats for the header
  const stats = useMemo(() => {
    const ownerCount = users.filter((u) => u.role === "owner").length;
    const adminCount = users.filter((u) => u.role === "admin").length;
    const repCount = users.filter((u) => u.role === "rep").length;
    const activeCount = users.filter((u) => u.isActive === "true").length;
    return { ownerCount, adminCount, repCount, activeCount, total: users.length };
  }, [users]);

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
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
  };

  const renderUser = ({ item }: { item: User }) => {
    const isSelf = item.id === currentUser?.id;
    const isActive = item.isActive === "true";
    const roleConf = ROLE_CONFIG[item.role] || ROLE_CONFIG.rep;
    const adminName = getAdminName(item.managerId);
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
              {adminName ? ` \u00B7 ${adminName}'s team` : ""}
            </Text>
            <Text style={[styles.userLastLogin, { color: theme.textSecondary }]} numberOfLines={1}>
              Last login: {lastLogin}
            </Text>
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

  const allUsers = useMemo(() => {
    const result: (User | { type: "header"; title: string })[] = [];
    for (const section of groupedUsers) {
      result.push({ type: "header", title: section.title } as any);
      result.push(...section.data);
    }
    return result;
  }, [groupedUsers]);

  const availableRoles: Role[] = isOwner ? ["owner", "admin", "rep"] : ["rep"];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>Team Management</Text>
        <Pressable onPress={openCreateModal} style={styles.addBtn}>
          <Ionicons name="person-add" size={22} color={theme.tint} />
        </Pressable>
      </View>

      {/* Stats bar */}
      {!loading && (
        <View style={[styles.statsBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: ROLE_CONFIG.owner.color }]}>{stats.ownerCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Owners</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: ROLE_CONFIG.admin.color }]}>{stats.adminCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Admins</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: ROLE_CONFIG.rep.color }]}>{stats.repCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Reps</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.activeCount}</Text>
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
          data={allUsers}
          keyExtractor={(item: any) => item.type === "header" ? `header-${item.title}` : item.id}
          renderItem={({ item }: any) => {
            if (item.type === "header") {
              return (
                <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
                  {item.title}
                </Text>
              );
            }
            return renderUser({ item });
          }}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 20 }]}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No team members yet</Text>
            </View>
          }
          ListFooterComponent={
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Powered by Unicity International{"\n"}{"\u00A9"} 2026 Unicity. All rights reserved.
            </Text>
          }
        />
      )}

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

              {isOwner && formRole === "rep" && admins.length > 0 && (
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Assign to Admin</Text>
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
                    {admins.map((adm) => {
                      const selected = formManagerId === adm.id;
                      return (
                        <Pressable
                          key={adm.id}
                          style={[
                            styles.adminChip,
                            {
                              backgroundColor: selected ? theme.accent : theme.background,
                              borderColor: selected ? theme.accent : theme.border,
                            },
                          ]}
                          onPress={() => setFormManagerId(adm.id)}
                        >
                          <Text style={{ color: selected ? "#FFF" : theme.text, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                            {adm.fullName}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

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
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2, textTransform: "uppercase" as const, letterSpacing: 0.5 },
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
  footerText: { textAlign: "center", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 24, lineHeight: 16, opacity: 0.6 },
});
