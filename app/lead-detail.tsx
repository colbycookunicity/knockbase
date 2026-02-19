import React, { useState, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Linking, Alert, Modal, FlatList, Image, ActivityIndicator } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import { useLeads } from "@/lib/leads-context";
import { useTheme } from "@/lib/useTheme";
import { LEAD_STATUS_CONFIG } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { DispositionSheet } from "@/components/DispositionSheet";
import { apiRequest } from "@/lib/query-client";

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { leads, dispositionLead, deleteLead } = useLeads();
  const [showDisposition, setShowDisposition] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderCart, setOrderCart] = useState<Record<string, number>>({});
  // Maps variantId -> sellingPlanId (null = one-time purchase)
  const [orderSellingPlans, setOrderSellingPlans] = useState<Record<string, string | null>>({});
  const [creatingOrder, setCreatingOrder] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const lead = useMemo(() => leads.find((l) => l.id === id), [leads, id]);

  if (!lead) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 + webTopInset }]}>
          <Pressable onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
        </View>
        <View style={styles.centered}>
          <Feather name="alert-circle" size={48} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Lead not found</Text>
        </View>
      </View>
    );
  }

  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown";
  const config = LEAD_STATUS_CONFIG[lead.status];

  const handleCall = () => {
    if (lead.phone) Linking.openURL(`tel:${lead.phone}`);
  };

  const handleEmail = () => {
    if (lead.email) Linking.openURL(`mailto:${lead.email}`);
  };

  const handleNavigate = () => {
    const url = Platform.select({
      ios: `maps:0,0?q=${lead.latitude},${lead.longitude}`,
      android: `geo:${lead.latitude},${lead.longitude}?q=${lead.latitude},${lead.longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lead.latitude},${lead.longitude}`,
    });
    if (url) Linking.openURL(url);
  };

  const handleDelete = () => {
    if (Platform.OS === "web") {
      if (confirm(`Delete ${fullName}?`)) {
        deleteLead(lead.id);
        router.back();
      }
    } else {
      Alert.alert("Delete Lead", `Delete ${fullName}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteLead(lead.id);
            router.back();
          },
        },
      ]);
    }
  };

  const { data: productsData, isLoading: productsLoading } = useQuery<{ products: any[]; pageInfo: any }>({
    queryKey: ["/api/shopify/products"],
    staleTime: 60000,
    enabled: showOrderModal,
  });

  const products = productsData?.products || [];

  const cartCount = useMemo(() => {
    return Object.values(orderCart).reduce((sum, qty) => sum + qty, 0);
  }, [orderCart]);

  const updateCart = useCallback((variantId: string, delta: number) => {
    setOrderCart((prev) => {
      const current = prev[variantId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [variantId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [variantId]: next };
    });
  }, []);

  const handleCreateOrder = useCallback(async () => {
    if (!lead || Object.keys(orderCart).length === 0) return;
    setCreatingOrder(true);
    try {
      const lineItems = Object.entries(orderCart).map(([variantId, quantity]) => {
        const item: any = { variantId, quantity };
        const planId = orderSellingPlans[variantId];
        if (planId) {
          item.sellingPlanId = planId;
        }
        return item;
      });

      const res = await apiRequest("POST", "/api/shopify/draft-order", {
        lineItems,
        leadId: lead.id,
        customerFirstName: lead.firstName,
        customerLastName: lead.lastName,
        customerEmail: lead.email || undefined,
        customerPhone: lead.phone || undefined,
      });
      const cart = await res.json();

      setShowOrderModal(false);
      setOrderCart({});
      setOrderSellingPlans({});

      if (cart.checkoutUrl) {
        const openCheckout = async () => {
          try {
            await Linking.openURL(cart.checkoutUrl);
          } catch {}
        };
        if (Platform.OS === "web") {
          window.open(cart.checkoutUrl, "_blank");
        } else {
          Alert.alert(
            "Order Created",
            `Cart ready for checkout.\n\nWould you like to open the checkout now?`,
            [
              { text: "Later", style: "cancel" },
              { text: "Open Checkout", onPress: openCheckout },
            ]
          );
        }
      } else {
        const msg = `Order ${cart.name} created!`;
        if (Platform.OS === "web") {
          window.alert(msg);
        } else {
          Alert.alert("Order Created", msg);
        }
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to create order";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setCreatingOrder(false);
    }
  }, [lead, orderCart, orderSellingPlans]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 + webTopInset }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({ pathname: "/lead-form", params: { id: lead.id } });
            }}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Feather name="edit-2" size={20} color={theme.text} />
          </Pressable>
          <Pressable onPress={handleDelete} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <Feather name="trash-2" size={20} color={theme.danger} />
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.avatar, { backgroundColor: config.color + "20" }]}>
            <Feather name={config.icon as any} size={28} color={config.color} />
          </View>
          <Text style={[styles.name, { color: theme.text }]}>{fullName}</Text>
          <StatusBadge status={lead.status} size="large" />

          <View style={styles.quickActions}>
            {lead.phone ? (
              <Pressable
                onPress={handleCall}
                style={[styles.quickBtn, { backgroundColor: theme.tint + "15" }]}
              >
                <Feather name="phone" size={18} color={theme.tint} />
              </Pressable>
            ) : null}
            {lead.email ? (
              <Pressable
                onPress={handleEmail}
                style={[styles.quickBtn, { backgroundColor: theme.accent + "15" }]}
              >
                <Feather name="mail" size={18} color={theme.accent} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={handleNavigate}
              style={[styles.quickBtn, { backgroundColor: theme.accentSecondary + "15" }]}
            >
              <Feather name="navigation" size={18} color={theme.accentSecondary} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Contact Info</Text>
          <InfoRow icon="map-pin" label="Address" value={lead.address} theme={theme} />
          <InfoRow icon="phone" label="Phone" value={lead.phone} theme={theme} />
          <InfoRow icon="mail" label="Email" value={lead.email} theme={theme} />
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Activity</Text>
          <InfoRow
            icon="clock"
            label="Created"
            value={new Date(lead.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            theme={theme}
          />
          {lead.knockedAt && (
            <InfoRow
              icon="navigation"
              label="Last Knocked"
              value={new Date(lead.knockedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              theme={theme}
            />
          )}
          {lead.appointmentDate && (
            <InfoRow
              icon="calendar"
              label="Appointment"
              value={new Date(lead.appointmentDate).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              theme={theme}
            />
          )}
          {lead.followUpDate && (
            <InfoRow
              icon="refresh-cw"
              label="Follow Up"
              value={new Date(lead.followUpDate).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
              theme={theme}
            />
          )}
        </View>

        {lead.notes ? (
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Notes</Text>
            <Text style={[styles.notesText, { color: theme.text }]}>{lead.notes}</Text>
          </View>
        ) : null}

        {lead.tags.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Tags</Text>
            <View style={styles.tagsWrap}>
              {lead.tags.map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: theme.tint + "15" }]}>
                  <Text style={[styles.tagText, { color: theme.tint }]}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowOrderModal(true);
          }}
          style={[styles.orderBtn, { backgroundColor: "#8B5CF6" }]}
        >
          <Ionicons name="phone-portrait-outline" size={18} color="#FFF" />
          <Text style={styles.dispositionText}>Create Order for POS</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowDisposition(true);
          }}
          style={[styles.dispositionBtn, { backgroundColor: theme.tint }]}
        >
          <Feather name="edit-3" size={18} color="#FFF" />
          <Text style={styles.dispositionText}>Log Visit</Text>
        </Pressable>
      </ScrollView>

      {/* Order creation modal */}
      <Modal visible={showOrderModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Create Order for {fullName}
              </Text>
              <Pressable onPress={() => { setShowOrderModal(false); setOrderCart({}); setOrderSellingPlans({}); }}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            {productsLoading ? (
              <View style={styles.modalCenter}>
                <ActivityIndicator size="large" color={theme.tint} />
              </View>
            ) : (
              <FlatList
                data={products}
                keyExtractor={(item: any) => item.id}
                renderItem={({ item: product }: any) => {
                  const variant = product.variants?.[0];
                  if (!variant) return null;
                  const qty = orderCart[variant.id] || 0;
                  const img = product.images?.[0];
                  const sellingPlans: any[] = [];
                  (product.sellingPlanGroups || []).forEach((g: any) => {
                    (g.sellingPlans || []).forEach((sp: any) => sellingPlans.push(sp));
                  });
                  const hasPlans = sellingPlans.length > 0;
                  const currentPlanId = orderSellingPlans[variant.id] || null;

                  // Resolve displayed price based on selected selling plan
                  let displayPrice = parseFloat(variant.price?.amount || "0");
                  if (currentPlanId && variant.sellingPlanAllocations) {
                    const alloc = variant.sellingPlanAllocations.find(
                      (a: any) => a.sellingPlan.id === currentPlanId
                    );
                    if (alloc?.priceAdjustments?.[0]?.price) {
                      displayPrice = parseFloat(alloc.priceAdjustments[0].price.amount);
                    }
                  }

                  return (
                    <View style={[styles.productRow, { borderBottomColor: theme.border }]}>
                      {img ? (
                        <Image source={{ uri: img.url }} style={styles.productThumb} />
                      ) : (
                        <View style={[styles.productThumb, { backgroundColor: theme.border, alignItems: "center", justifyContent: "center" }]}>
                          <Ionicons name="cube-outline" size={20} color={theme.textSecondary} />
                        </View>
                      )}
                      <View style={styles.productInfo}>
                        <Text style={[styles.productName, { color: theme.text }]} numberOfLines={2}>
                          {product.title}
                        </Text>
                        <Text style={[styles.productPrice, { color: theme.tint }]}>
                          ${displayPrice.toFixed(2)}
                          {currentPlanId ? " /mo" : ""}
                        </Text>
                        {hasPlans && (
                          <View style={styles.planToggleRow}>
                            <Pressable
                              onPress={() => setOrderSellingPlans((prev) => ({ ...prev, [variant.id]: null }))}
                              style={[
                                styles.planToggleBtn,
                                {
                                  backgroundColor: !currentPlanId ? theme.tint : "transparent",
                                  borderColor: !currentPlanId ? theme.tint : theme.border,
                                },
                              ]}
                            >
                              <Text style={[styles.planToggleText, { color: !currentPlanId ? "#FFF" : theme.textSecondary }]}>
                                One-time
                              </Text>
                            </Pressable>
                            {sellingPlans.map((sp: any) => {
                              const isSel = currentPlanId === sp.id;
                              return (
                                <Pressable
                                  key={sp.id}
                                  onPress={() => setOrderSellingPlans((prev) => ({ ...prev, [variant.id]: sp.id }))}
                                  style={[
                                    styles.planToggleBtn,
                                    {
                                      backgroundColor: isSel ? "#8B5CF6" : "transparent",
                                      borderColor: isSel ? "#8B5CF6" : theme.border,
                                    },
                                  ]}
                                >
                                  <Text style={[styles.planToggleText, { color: isSel ? "#FFF" : theme.textSecondary }]}>
                                    {sp.name.replace(/subscriptions?/i, "Sub").replace(/monthly/i, "Monthly")}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        )}
                      </View>
                      <View style={styles.qtyControls}>
                        {qty > 0 && (
                          <Pressable onPress={() => updateCart(variant.id, -1)} style={[styles.qtyBtn, { borderColor: theme.border }]}>
                            <Ionicons name="remove" size={18} color={theme.text} />
                          </Pressable>
                        )}
                        {qty > 0 && (
                          <Text style={[styles.qtyText, { color: theme.text }]}>{qty}</Text>
                        )}
                        <Pressable onPress={() => updateCart(variant.id, 1)} style={[styles.qtyBtn, { borderColor: theme.border }]}>
                          <Ionicons name="add" size={18} color={theme.tint} />
                        </Pressable>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.modalCenter}>
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No products available</Text>
                  </View>
                }
              />
            )}

            {cartCount > 0 && (
              <Pressable
                style={[styles.createOrderBtn, { backgroundColor: "#8B5CF6", opacity: creatingOrder ? 0.7 : 1 }]}
                onPress={handleCreateOrder}
                disabled={creatingOrder}
              >
                {creatingOrder ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="phone-portrait-outline" size={18} color="#FFF" />
                    <Text style={styles.createOrderBtnText}>
                      Send {cartCount} item{cartCount > 1 ? "s" : ""} to POS
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      <DispositionSheet
        visible={showDisposition}
        currentStatus={lead.status}
        onSelect={(status, notes) => {
          dispositionLead(lead.id, status, notes);
          setShowDisposition(false);
        }}
        onClose={() => setShowDisposition(false)}
      />
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  theme,
}: {
  icon: string;
  label: string;
  value: string;
  theme: any;
}) {
  if (!value) return null;
  return (
    <View style={infoStyles.row}>
      <Feather name={icon as any} size={16} color={theme.textSecondary} />
      <View style={infoStyles.info}>
        <Text style={[infoStyles.label, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[infoStyles.value, { color: theme.text }]}>{value}</Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 8,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
});

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
  headerActions: {
    flexDirection: "row",
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 14,
  },
  profileCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  quickBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  tagText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  orderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  dispositionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  dispositionText: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalCenter: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  productThumb: { width: 48, height: 48, borderRadius: 8 },
  productInfo: { flex: 1, gap: 2 },
  productName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  productPrice: { fontSize: 13, fontFamily: "Inter_700Bold" },
  qtyControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  qtyText: { fontSize: 15, fontFamily: "Inter_700Bold", minWidth: 20, textAlign: "center" as const },
  planToggleRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  planToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  planToggleText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  createOrderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 12,
    marginTop: 16,
  },
  createOrderBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
