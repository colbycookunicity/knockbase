import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useTheme } from "@/lib/useTheme";
import { apiRequest } from "@/lib/query-client";

interface SellingPlan {
  id: string;
  name: string;
  description: string;
  recurringDeliveries: boolean;
  priceAdjustments: {
    adjustmentValue:
      | { adjustmentPercentage: number }
      | { adjustmentAmount: { amount: string; currencyCode: string } }
      | { price: { amount: string; currencyCode: string } };
  }[];
}

interface SellingPlanGroup {
  name: string;
  sellingPlans: SellingPlan[];
}

interface SellingPlanAllocation {
  sellingPlan: { id: string; name: string };
  priceAdjustments: {
    price: { amount: string; currencyCode: string };
    compareAtPrice: { amount: string; currencyCode: string } | null;
  }[];
}

interface Variant {
  id: string;
  title: string;
  availableForSale: boolean;
  price: { amount: string; currencyCode: string };
  compareAtPrice: { amount: string; currencyCode: string } | null;
  selectedOptions: { name: string; value: string }[];
  image: { url: string; altText: string | null } | null;
  sellingPlanAllocations?: SellingPlanAllocation[];
}

interface Product {
  id: string;
  title: string;
  description: string;
  descriptionHtml: string;
  availableForSale: boolean;
  productType: string;
  vendor: string;
  tags: string[];
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
  images: { url: string; altText: string | null; width: number; height: number }[];
  variants: Variant[];
  sellingPlanGroups?: SellingPlanGroup[];
}

function formatPrice(amount: string, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(parseFloat(amount));
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ProductDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [checkingOut, setCheckingOut] = useState(false);
  const [sendingToPOS, setSendingToPOS] = useState(false);
  const [draftOrderName, setDraftOrderName] = useState<string | null>(null);
  // null = one-time purchase, string = selling plan ID for subscription
  const [selectedSellingPlanId, setSelectedSellingPlanId] = useState<string | null>(null);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["/api/shopify/products", id],
    queryFn: async () => {
      const { getApiUrl } = await import("@/lib/query-client");
      const url = new URL(`/api/shopify/products/${encodeURIComponent(id!)}`, getApiUrl());
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Product not found");
      return res.json();
    },
    enabled: !!id,
    staleTime: 60000,
  });

  const selectedVariant = useMemo(() => {
    if (!product?.variants?.length) return null;
    return product.variants[selectedVariantIdx] || product.variants[0];
  }, [product, selectedVariantIdx]);

  const optionGroups = useMemo(() => {
    if (!product?.variants?.length) return [];
    const groups: Record<string, Set<string>> = {};
    product.variants.forEach((v) => {
      v.selectedOptions.forEach((opt) => {
        if (!groups[opt.name]) groups[opt.name] = new Set();
        groups[opt.name].add(opt.value);
      });
    });
    return Object.entries(groups).map(([name, values]) => ({
      name,
      values: Array.from(values),
    }));
  }, [product]);

  // Flatten all selling plans from all groups for the toggle UI
  const sellingPlans = useMemo(() => {
    if (!product?.sellingPlanGroups?.length) return [];
    const plans: SellingPlan[] = [];
    product.sellingPlanGroups.forEach((group) => {
      group.sellingPlans.forEach((sp) => plans.push(sp));
    });
    return plans;
  }, [product]);

  const hasSellingPlans = sellingPlans.length > 0;

  // Get the price for the selected variant under the selected selling plan
  const resolvedPrice = useMemo(() => {
    if (!selectedVariant) return null;
    if (!selectedSellingPlanId) {
      // One-time purchase: use variant's base price
      return {
        price: selectedVariant.price,
        compareAtPrice: selectedVariant.compareAtPrice,
      };
    }
    // Find the allocation for this selling plan on this variant
    const alloc = selectedVariant.sellingPlanAllocations?.find(
      (a) => a.sellingPlan.id === selectedSellingPlanId
    );
    if (alloc?.priceAdjustments?.[0]) {
      return {
        price: alloc.priceAdjustments[0].price,
        compareAtPrice: alloc.priceAdjustments[0].compareAtPrice,
      };
    }
    // Fallback to variant base price
    return {
      price: selectedVariant.price,
      compareAtPrice: selectedVariant.compareAtPrice,
    };
  }, [selectedVariant, selectedSellingPlanId]);

  const handleCheckout = useCallback(async () => {
    if (!selectedVariant) return;
    setCheckingOut(true);
    try {
      const lineItem: any = { variantId: selectedVariant.id, quantity };
      if (selectedSellingPlanId) {
        lineItem.sellingPlanId = selectedSellingPlanId;
      }
      const res = await apiRequest("POST", "/api/shopify/checkout", {
        lineItems: [lineItem],
      });
      const cart = await res.json();
      if (cart.checkoutUrl) {
        await Linking.openURL(cart.checkoutUrl);
      }
    } catch (err: any) {
      const msg = err?.message || "Checkout failed";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Checkout Error", msg);
      }
    } finally {
      setCheckingOut(false);
    }
  }, [selectedVariant, quantity, selectedSellingPlanId]);

  const handleSendToPOS = useCallback(async () => {
    if (!selectedVariant) return;
    setSendingToPOS(true);
    setDraftOrderName(null);
    try {
      const lineItem: any = { variantId: selectedVariant.id, quantity };
      if (selectedSellingPlanId) {
        lineItem.sellingPlanId = selectedSellingPlanId;
      }
      const res = await apiRequest("POST", "/api/shopify/draft-order", {
        lineItems: [lineItem],
      });
      const cart = await res.json();
      setDraftOrderName(cart.name);

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
            "Cart ready for checkout. Open now?",
            [
              { text: "Later", style: "cancel" },
              { text: "Open Checkout", onPress: openCheckout },
            ]
          );
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
      setSendingToPOS(false);
    }
  }, [selectedVariant, quantity, selectedSellingPlanId]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8, backgroundColor: theme.surface }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.tint} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8, backgroundColor: theme.surface }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.tint} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>Product not found</Text>
        </View>
      </View>
    );
  }

  const hasImages = product.images.length > 0;
  const currentImage = product.images[selectedImageIdx] || product.images[0];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + webTopInset + 8,
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.tint} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {product.title}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {hasImages ? (
          <View>
            <Image source={{ uri: currentImage.url }} style={styles.mainImage} resizeMode="cover" />
            {product.images.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbRow}
                style={{ backgroundColor: theme.surface }}
              >
                {product.images.map((img, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => setSelectedImageIdx(idx)}
                    style={[
                      styles.thumb,
                      {
                        borderColor: idx === selectedImageIdx ? theme.tint : theme.border,
                        borderWidth: idx === selectedImageIdx ? 2 : 1,
                      },
                    ]}
                  >
                    <Image source={{ uri: img.url }} style={styles.thumbImage} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        ) : (
          <View style={[styles.noImageLarge, { backgroundColor: theme.surface }]}>
            <Ionicons name="cube-outline" size={64} color={theme.textSecondary} />
          </View>
        )}

        <View style={[styles.infoSection, { backgroundColor: theme.surface }]}>
          {product.vendor ? (
            <Text style={[styles.vendor, { color: theme.tint }]}>{product.vendor}</Text>
          ) : null}
          <Text style={[styles.productTitle, { color: theme.text }]}>{product.title}</Text>

          {resolvedPrice && (
            <View style={styles.priceSection}>
              <View style={styles.priceRow}>
                <Text style={[styles.price, { color: theme.tint }]}>
                  {formatPrice(resolvedPrice.price.amount, resolvedPrice.price.currencyCode)}
                </Text>
                <Text style={[styles.priceLabel, { color: theme.tint }]}>
                  {selectedSellingPlanId ? "Subscription" : "Wholesale"}
                </Text>
              </View>
              {resolvedPrice.compareAtPrice &&
                parseFloat(resolvedPrice.compareAtPrice.amount) > parseFloat(resolvedPrice.price.amount) && (
                  <View style={styles.priceRow}>
                    <Text style={[styles.comparePrice, { color: theme.textSecondary }]}>
                      {formatPrice(resolvedPrice.compareAtPrice.amount, resolvedPrice.compareAtPrice.currencyCode)}
                    </Text>
                    <Text style={[styles.comparePriceLabel, { color: theme.textSecondary }]}>
                      {selectedSellingPlanId ? "One-time price" : "Retail"}
                    </Text>
                  </View>
                )}
            </View>
          )}

          {hasSellingPlans && (
            <View style={styles.sellingPlanSection}>
              <Text style={[styles.optionLabel, { color: theme.textSecondary }]}>Purchase Type</Text>
              <View style={styles.sellingPlanToggle}>
                <Pressable
                  style={[
                    styles.sellingPlanBtn,
                    {
                      backgroundColor: !selectedSellingPlanId ? theme.tint : theme.background,
                      borderColor: !selectedSellingPlanId ? theme.tint : theme.border,
                    },
                  ]}
                  onPress={() => setSelectedSellingPlanId(null)}
                >
                  <Ionicons
                    name="bag-outline"
                    size={16}
                    color={!selectedSellingPlanId ? "#FFF" : theme.text}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.sellingPlanBtnText, { color: !selectedSellingPlanId ? "#FFF" : theme.text }]}>
                    One-time
                  </Text>
                </Pressable>
                {sellingPlans.map((plan) => {
                  const isSelected = selectedSellingPlanId === plan.id;
                  return (
                    <Pressable
                      key={plan.id}
                      style={[
                        styles.sellingPlanBtn,
                        {
                          backgroundColor: isSelected ? "#8B5CF6" : theme.background,
                          borderColor: isSelected ? "#8B5CF6" : theme.border,
                        },
                      ]}
                      onPress={() => setSelectedSellingPlanId(plan.id)}
                    >
                      <Ionicons
                        name="repeat-outline"
                        size={16}
                        color={isSelected ? "#FFF" : theme.text}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.sellingPlanBtnText, { color: isSelected ? "#FFF" : theme.text }]}>
                        {plan.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {product.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {product.tags.slice(0, 5).map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: theme.tint + "15", borderColor: theme.tint + "30" }]}>
                  <Text style={[styles.tagText, { color: theme.tint }]}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {optionGroups.length > 0 && !(optionGroups.length === 1 && optionGroups[0].values.length === 1 && optionGroups[0].values[0] === "Default Title") && (
          <View style={[styles.optionsSection, { backgroundColor: theme.surface }]}>
            {optionGroups.map((group) => (
              <View key={group.name} style={styles.optionGroup}>
                <Text style={[styles.optionLabel, { color: theme.textSecondary }]}>{group.name}</Text>
                <View style={styles.optionValues}>
                  {group.values.map((value) => {
                    const variantIdx = product.variants.findIndex((v) =>
                      v.selectedOptions.some((o) => o.name === group.name && o.value === value)
                    );
                    const isSelected = selectedVariant?.selectedOptions.some(
                      (o) => o.name === group.name && o.value === value
                    );
                    const variant = product.variants[variantIdx];
                    const available = variant?.availableForSale !== false;

                    return (
                      <Pressable
                        key={value}
                        style={[
                          styles.optionBtn,
                          {
                            backgroundColor: isSelected ? theme.tint : theme.background,
                            borderColor: isSelected ? theme.tint : theme.border,
                            opacity: available ? 1 : 0.4,
                          },
                        ]}
                        onPress={() => {
                          if (variantIdx >= 0) setSelectedVariantIdx(variantIdx);
                        }}
                      >
                        <Text
                          style={[
                            styles.optionBtnText,
                            { color: isSelected ? "#FFF" : theme.text },
                          ]}
                        >
                          {value}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}

        {product.description ? (
          <View style={[styles.descSection, { backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Description</Text>
            <Text style={[styles.descText, { color: theme.textSecondary }]}>{product.description}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 8,
          },
        ]}
      >
        <View style={styles.qtyRow}>
          <Pressable
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            style={[styles.qtyBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
          >
            <Ionicons name="remove" size={20} color={theme.text} />
          </Pressable>
          <Text style={[styles.qtyText, { color: theme.text }]}>{quantity}</Text>
          <Pressable
            onPress={() => setQuantity((q) => q + 1)}
            style={[styles.qtyBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
          >
            <Ionicons name="add" size={20} color={theme.text} />
          </Pressable>
        </View>

        <Pressable
          style={[
            styles.posBtn,
            {
              backgroundColor: product.availableForSale && selectedVariant?.availableForSale !== false ? "#8B5CF6" : theme.textSecondary,
              opacity: sendingToPOS ? 0.7 : 1,
            },
          ]}
          onPress={handleSendToPOS}
          disabled={sendingToPOS || !product.availableForSale || selectedVariant?.availableForSale === false}
        >
          {sendingToPOS ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="phone-portrait-outline" size={18} color="#FFF" />
              <Text style={styles.posBtnText}>POS</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={[
            styles.buyBtn,
            {
              backgroundColor: product.availableForSale && selectedVariant?.availableForSale !== false ? theme.tint : theme.textSecondary,
              opacity: checkingOut ? 0.7 : 1,
            },
          ]}
          onPress={handleCheckout}
          disabled={checkingOut || !product.availableForSale || selectedVariant?.availableForSale === false}
        >
          {checkingOut ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="cart-outline" size={20} color="#FFF" />
              <Text style={styles.buyBtnText}>
                {product.availableForSale && selectedVariant?.availableForSale !== false
                  ? "Buy Now"
                  : "Sold Out"}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  mainImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH, backgroundColor: "#F0F0F0" },
  thumbRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: "row" },
  thumb: { width: 56, height: 56, borderRadius: 8, overflow: "hidden" },
  thumbImage: { width: "100%", height: "100%" },
  noImageLarge: { width: SCREEN_WIDTH, height: 260, alignItems: "center", justifyContent: "center" },
  infoSection: { padding: 16, marginTop: 8, gap: 6 },
  vendor: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  productTitle: { fontSize: 22, fontFamily: "Inter_700Bold", lineHeight: 28 },
  priceSection: { gap: 4, marginTop: 4 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  price: { fontSize: 22, fontFamily: "Inter_700Bold" },
  priceLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  comparePrice: { fontSize: 16, fontFamily: "Inter_400Regular", textDecorationLine: "line-through" },
  comparePriceLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  tagText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  sellingPlanSection: { gap: 8, marginTop: 8 },
  sellingPlanToggle: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sellingPlanBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  sellingPlanBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  optionsSection: { padding: 16, marginTop: 8, gap: 16 },
  optionGroup: { gap: 8 },
  optionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  optionValues: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  optionBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  descSection: { padding: 16, marginTop: 8, gap: 8 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  descText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  qtyText: { fontSize: 16, fontFamily: "Inter_700Bold", minWidth: 24, textAlign: "center" },
  posBtn: {
    flexDirection: "row",
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
  },
  posBtnText: { color: "#FFF", fontSize: 14, fontFamily: "Inter_700Bold" },
  buyBtn: {
    flex: 1,
    flexDirection: "row",
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buyBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold" },
});
