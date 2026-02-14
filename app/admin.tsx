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

type Role = "admin" | "manager" | "sales_rep";

const ROLE_CONFIG: Record<Role, { label: string; icon: string; color: string }> = {
  admin: { label: "Admin", icon: "shield", color: "#8B5CF6" },
  manager: { label: "Manager", icon: "briefcase", color: "#3B82F6" },
  sales_rep: { label: "Sales Rep", icon: "person", color: "#10B981" },
};

export default function AdminScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: currentUser, isAdmin, isManager } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formUsername, setFormUsername] = useState("");
  const [formFullName, setFormFullName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<Role>("sales_rep");
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

  const managers = useMemo(() => {
    return users.filter((u) => u.role === "manager");
  }, [users]);

  const getManagerName = (managerId: string | null) => {
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
    setFormPassword("");
    setFormRole(isManager ? "sales_rep" : "sales_rep");
    setFormManagerId(isManager ? (currentUser?.id ?? null) : null);
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
    setFormPassword("");
    setFormRole(user.role);
    setFormManagerId(user.managerId);
    setFormActive(user.isActive === "true");
    setFormError("");
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formUsername.trim() || !formFullName.trim()) {
      setFormError("Username and full name are required");
      return;
    }
    if (!editingUser && !formPassword.trim()) {
      setFormError("Password is required for new users");
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
          managerId: formRole === "sales_rep" ? formManagerId : null,
        };
        if (formPassword.trim()) body.password = formPassword.trim();
        const res = await apiRequest("PUT", `/api/users/${editingUser.id}`, body);
        const updated = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      } else {
        const body: any = {
          username: formUsername.trim(),
          fullName: formFullName.trim(),
          email: formEmail.trim(),
          phone: formPhone.trim(),
          password: formPassword.trim(),
          role: formRole,
        };
        if (formRole === "sales_rep" && formManagerId) {
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
        setFormError("Username already taken");
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

  const groupedUsers = useMemo(() => {
    if (!isAdmin) {
      return [{ title: "Your Team", data: users.filter((u) => u.id !== currentUser?.id) }];
    }
    const admins = users.filter((u) => u.role === "admin");
    const managersList = users.filter((u) => u.role === "manager");
    const reps = users.filter((u) => u.role === "sales_rep");
    const sections: { title: string; data: User[] }[] = [];
    if (admins.length) sections.push({ title: "Admins", data: admins });
    if (managersList.length) sections.push({ title: "Managers", data: managersList });
    if (reps.length) sections.push({ title: "Sales Reps", data: reps });
    return sections;
  }, [users, isAdmin, currentUser]);

  const renderUser = ({ item }: { item: User }) => {
    const isSelf = item.id === currentUser?.id;
    const isActive = item.isActive === "true";
    const roleConf = ROLE_CONFIG[item.role] || ROLE_CONFIG.sales_rep;
    const managerName = getManagerName(item.managerId);

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
            <Text style={[styles.userMeta, { color: theme.textSecondary }]}>
              @{item.username} - {roleConf.label}
              {managerName ? ` (${managerName}'s team)` : ""}
            </Text>
          </View>
          <View style={styles.userActions}>
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

  const availableRoles: Role[] = isAdmin ? ["admin", "manager", "sales_rep"] : ["sales_rep"];

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
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {isAdmin ? "User Management" : "My Team"}
        </Text>
        <Pressable onPress={openCreateModal} style={styles.addBtn}>
          <Ionicons name="person-add" size={22} color={theme.tint} />
        </Pressable>
      </View>

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
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No users found</Text>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {editingUser ? "Edit User" : "Create User"}
                </Text>
                <Pressable onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={theme.textSecondary} />
                </Pressable>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Username</Text>
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
                <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
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
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  {editingUser ? "New Password (leave blank to keep)" : "Password"}
                </Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={formPassword}
                  onChangeText={setFormPassword}
                  secureTextEntry
                  placeholder={editingUser ? "Leave blank to keep" : "Password"}
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
                          if (role !== "sales_rep") setFormManagerId(null);
                        }}
                      >
                        <Text style={{ color: isSelected ? "#FFF" : theme.text, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                          {conf.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {isAdmin && formRole === "sales_rep" && managers.length > 0 && (
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Assign to Manager</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.managerScroll}>
                    <Pressable
                      style={[
                        styles.managerChip,
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
                            styles.managerChip,
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
                  <Text style={styles.saveBtnText}>{editingUser ? "Save Changes" : "Create User"}</Text>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  list: { padding: 16, gap: 8 },
  sectionHeader: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  userCard: { borderRadius: 12, overflow: "hidden" },
  userCardContent: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  userMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  userActions: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  roleBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  managerScroll: { flexDirection: "row" },
  managerChip: {
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
