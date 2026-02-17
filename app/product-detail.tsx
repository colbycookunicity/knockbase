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

interface Variant {
  id: string;
  title: string;
  availableForSale: boolean;
  price: { amount: string; currencyCode: string };
  compareAtPrice: { amount: string; currencyCode: string } | null;
  selectedOptions: { name: string; value: string }[];
  image: { url: string; altText: string | null } | null;
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

  const handleCheckout = useCallback(async () => {
    if (!selectedVariant) return;
    setCheckingOut(true);
    try {
      const res = await apiRequest("POST", "/api/shopify/checkout", {
        lineItems: [{ variantId: selectedVariant.id, quantity }],
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
  }, [selectedVariant, quantity]);

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

          {selectedVariant && (
            <View style={styles.priceSection}>
              <View style={styles.priceRow}>
                <Text style={[styles.price, { color: theme.tint }]}>
                  {formatPrice(selectedVariant.price.amount, selectedVariant.price.currencyCode)}
                </Text>
                <Text style={[styles.priceLabel, { color: theme.tint }]}>Wholesale</Text>
              </View>
              {selectedVariant.compareAtPrice &&
                parseFloat(selectedVariant.compareAtPrice.amount) > parseFloat(selectedVariant.price.amount) && (
                  <View style={styles.priceRow}>
                    <Text style={[styles.comparePrice, { color: theme.textSecondary }]}>
                      {formatPrice(selectedVariant.compareAtPrice.amount, selectedVariant.compareAtPrice.currencyCode)}
                    </Text>
                    <Text style={[styles.comparePriceLabel, { color: theme.textSecondary }]}>Retail</Text>
                  </View>
                )}
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
