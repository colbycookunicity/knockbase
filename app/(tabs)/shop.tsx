import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/lib/useTheme";

interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  availableForSale: boolean;
  productType: string;
  vendor: string;
  tags: string[];
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
  compareAtPriceRange?: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
  images: { url: string; altText: string | null }[];
  variants: {
    id: string;
    title: string;
    availableForSale: boolean;
    price: { amount: string; currencyCode: string };
    compareAtPrice: { amount: string; currencyCode: string } | null;
  }[];
}

function formatPrice(amount: string, currency: string) {
  const num = parseFloat(amount);
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
}

function ProductCard({ product, onPress, theme }: { product: ShopifyProduct; onPress: () => void; theme: any }) {
  const img = product.images[0];
  const minPrice = product.priceRange.minVariantPrice;
  const maxPrice = product.priceRange.maxVariantPrice;
  const samePrice = minPrice.amount === maxPrice.amount;
  // Pricing tier: price = wholesale, compareAtPrice = retail
  const firstVariant = product.variants[0];
  const retailPrice = firstVariant?.compareAtPrice;
  const hasRetailPrice = retailPrice && parseFloat(retailPrice.amount) > parseFloat(minPrice.amount);

  return (
    <Pressable style={[styles.card, { backgroundColor: theme.surface }]} onPress={onPress}>
      {img ? (
        <Image source={{ uri: img.url }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImage, styles.noImage, { backgroundColor: theme.border }]}>
          <Ionicons name="cube-outline" size={36} color={theme.textSecondary} />
        </View>
      )}
      <View style={styles.cardBody}>
        {product.vendor ? (
          <Text style={[styles.vendorText, { color: theme.tint }]} numberOfLines={1}>
            {product.vendor}
          </Text>
        ) : null}
        <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
          {product.title}
        </Text>
        <View style={styles.priceCol}>
          <View style={styles.priceRow}>
            <Text style={[styles.priceText, { color: theme.tint }]}>
              {samePrice
                ? formatPrice(minPrice.amount, minPrice.currencyCode)
                : `${formatPrice(minPrice.amount, minPrice.currencyCode)} - ${formatPrice(maxPrice.amount, maxPrice.currencyCode)}`}
            </Text>
          </View>
          {hasRetailPrice && (
            <Text style={[styles.retailPriceText, { color: theme.textSecondary }]}>
              Retail {formatPrice(retailPrice.amount, retailPrice.currencyCode)}
            </Text>
          )}
          {!product.availableForSale && (
            <View style={[styles.outOfStockBadge, { backgroundColor: theme.danger + "20" }]}>
              <Text style={[styles.outOfStockText, { color: theme.danger }]}>Sold out</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function ShopScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const {
    data: productsData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<{ products: ShopifyProduct[]; pageInfo: any }>({
    queryKey: ["/api/shopify/products"],
    staleTime: 60000,
  });

  const {
    data: searchResults,
    isLoading: searchLoading,
  } = useQuery<ShopifyProduct[]>({
    queryKey: ["/api/shopify/search", search],
    queryFn: async () => {
      if (!search.trim()) return [];
      const { getApiUrl } = await import("@/lib/query-client");
      const url = new URL("/api/shopify/search", getApiUrl());
      url.searchParams.set("q", search.trim());
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: search.trim().length > 0,
    staleTime: 30000,
  });

  const products = useMemo(() => {
    if (search.trim() && searchResults) return searchResults;
    return productsData?.products || [];
  }, [search, searchResults, productsData]);

  const handleProductPress = useCallback(
    (product: ShopifyProduct) => {
      const encodedId = encodeURIComponent(product.id);
      router.push(`/product-detail?id=${encodedId}`);
    },
    [router]
  );

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
        <Text style={[styles.headerTitle, { color: theme.text }]}>Shop</Text>
        <View style={[styles.searchBar, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search products..."
            placeholderTextColor={theme.textSecondary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.tint} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading products...</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProductCard product={item} onPress={() => handleProductPress(item)} theme={theme} />
          )}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 90 },
          ]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.tint} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="storefront-outline" size={56} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {search.trim() ? "No results found" : "No products yet"}
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                {search.trim()
                  ? "Try a different search term"
                  : "Products will appear here once they're published to your Shopify store"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    height: "100%",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  list: { padding: 10 },
  row: { gap: 10, paddingHorizontal: 6 },
  card: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    maxWidth: "50%",
    marginBottom: 10,
  },
  cardImage: { width: "100%", aspectRatio: 1, backgroundColor: "#F0F0F0" },
  noImage: { alignItems: "center", justifyContent: "center" },
  cardBody: { padding: 10, gap: 4 },
  vendorText: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  priceCol: { marginTop: 2, gap: 1 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  priceText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  retailPriceText: { fontSize: 11, fontFamily: "Inter_400Regular", textDecorationLine: "line-through" },
  outOfStockBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start" },
  outOfStockText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingTop: 80, paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
