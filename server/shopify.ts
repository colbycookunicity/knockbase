const API_VERSION = "2024-10";

async function shopifyQuery(query: string, variables: Record<string, any> = {}) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN || "";
  const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || "";
  if (!domain || !token) {
    throw new Error("Shopify credentials not configured (SHOPIFY_STORE_DOMAIN / SHOPIFY_STOREFRONT_ACCESS_TOKEN)");
  }
  const url = `https://${domain}/api/${API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error("Shopify GraphQL errors:", JSON.stringify(json.errors));
    throw new Error(json.errors[0]?.message || "Shopify API error");
  }
  return json.data;
}

export async function getProducts(first = 20, after?: string) {
  const query = `
    query getProducts($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        edges {
          cursor
          node {
            id
            title
            handle
            description
            availableForSale
            productType
            tags
            vendor
            priceRange {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            compareAtPriceRange {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            images(first: 5) {
              edges {
                node { url altText width height }
              }
            }
            variants(first: 20) {
              edges {
                node {
                  id
                  title
                  availableForSale
                  price { amount currencyCode }
                  compareAtPrice { amount currencyCode }
                  selectedOptions { name value }
                  image { url altText }
                }
              }
            }
          }
        }
        pageInfo { hasNextPage hasPreviousPage endCursor startCursor }
      }
    }
  `;
  const data = await shopifyQuery(query, { first, after });
  const products = data.products.edges.map((e: any) => ({
    ...e.node,
    images: e.node.images.edges.map((ie: any) => ie.node),
    variants: e.node.variants.edges.map((ve: any) => ve.node),
    cursor: e.cursor,
  }));
  return { products, pageInfo: data.products.pageInfo };
}

export async function getProduct(id: string) {
  const query = `
    query getProduct($id: ID!) {
      product(id: $id) {
        id
        title
        handle
        description
        descriptionHtml
        availableForSale
        productType
        tags
        vendor
        priceRange {
          minVariantPrice { amount currencyCode }
          maxVariantPrice { amount currencyCode }
        }
        compareAtPriceRange {
          minVariantPrice { amount currencyCode }
          maxVariantPrice { amount currencyCode }
        }
        images(first: 10) {
          edges {
            node { url altText width height }
          }
        }
        variants(first: 30) {
          edges {
            node {
              id
              title
              availableForSale
              price { amount currencyCode }
              compareAtPrice { amount currencyCode }
              selectedOptions { name value }
              image { url altText }
            }
          }
        }
      }
    }
  `;
  const data = await shopifyQuery(query, { id });
  if (!data.product) return null;
  return {
    ...data.product,
    images: data.product.images.edges.map((ie: any) => ie.node),
    variants: data.product.variants.edges.map((ve: any) => ve.node),
  };
}

export async function searchProducts(searchQuery: string, first = 20) {
  const query = `
    query searchProducts($query: String!, $first: Int!) {
      products(first: $first, query: $query) {
        edges {
          node {
            id
            title
            handle
            description
            availableForSale
            productType
            priceRange {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            compareAtPriceRange {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            images(first: 1) {
              edges {
                node { url altText }
              }
            }
            variants(first: 5) {
              edges {
                node {
                  id
                  title
                  availableForSale
                  price { amount currencyCode }
                  compareAtPrice { amount currencyCode }
                }
              }
            }
          }
        }
      }
    }
  `;
  const data = await shopifyQuery(query, { query: searchQuery, first });
  return data.products.edges.map((e: any) => ({
    ...e.node,
    images: e.node.images.edges.map((ie: any) => ie.node),
    variants: e.node.variants.edges.map((ve: any) => ve.node),
  }));
}

export async function createCheckout(lineItems: { variantId: string; quantity: number }[]) {
  const query = `
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          id
          checkoutUrl
          totalQuantity
          cost {
            totalAmount { amount currencyCode }
            subtotalAmount { amount currencyCode }
          }
          lines(first: 20) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                    price { amount currencyCode }
                    product { title }
                    image { url altText }
                  }
                }
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  const input = {
    lines: lineItems.map((item) => ({
      merchandiseId: item.variantId,
      quantity: item.quantity,
    })),
  };
  const data = await shopifyQuery(query, { input });
  if (data.cartCreate.userErrors?.length > 0) {
    throw new Error(data.cartCreate.userErrors[0].message);
  }
  const cart = data.cartCreate.cart;

  // Shopify returns checkoutUrl using the store's primary domain. If that domain
  // points to a non-Shopify site (e.g. www.unicity.com), the cart URL won't
  // resolve to Shopify's checkout. Rewrite it to use the Shopify store domain
  // so checkout stays within Shopify's hosted checkout system.
  let checkoutUrl: string = cart.checkoutUrl;
  const domain = process.env.SHOPIFY_STORE_DOMAIN || "";
  if (domain && checkoutUrl) {
    try {
      const parsed = new URL(checkoutUrl);
      const shopifyHost = domain.replace(/^https?:\/\//, "");
      if (parsed.hostname !== shopifyHost) {
        parsed.hostname = shopifyHost;
        // Remove any locale path prefix injected by the custom domain (e.g. /usa/en)
        // Shopify cart permalinks always start with /cart/
        const cartPathMatch = parsed.pathname.match(/(\/cart\/.*)/);
        if (cartPathMatch) {
          parsed.pathname = cartPathMatch[1];
        }
        checkoutUrl = parsed.toString();
      }
    } catch {
      // If URL parsing fails, use the original URL
    }
  }

  return {
    id: cart.id,
    checkoutUrl,
    totalQuantity: cart.totalQuantity,
    cost: cart.cost,
    lines: cart.lines.edges.map((e: any) => e.node),
  };
}

export async function getShopInfo() {
  const query = `{ shop { name description } }`;
  const data = await shopifyQuery(query);
  return data.shop;
}
