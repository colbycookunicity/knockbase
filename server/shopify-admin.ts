const ADMIN_API_VERSION = "2024-10";

interface DraftOrderLineItem {
  variantId: string;
  quantity: number;
}

interface DraftOrderCustomer {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

interface DraftOrderAddress {
  address1?: string;
  city?: string;
  province?: string;
  zip?: string;
  country?: string;
}

interface CreateDraftOrderInput {
  lineItems: DraftOrderLineItem[];
  customer?: DraftOrderCustomer;
  shippingAddress?: DraftOrderAddress;
  note?: string;
  tags?: string[];
  customAttributes?: { key: string; value: string }[];
}

async function adminQuery(query: string, variables: Record<string, any> = {}) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN || "";
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "";
  if (!domain || !token) {
    throw new Error(
      "Shopify Admin API credentials not configured (SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_ACCESS_TOKEN)"
    );
  }
  const url = `https://${domain}/admin/api/${ADMIN_API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Shopify Admin API HTTP ${res.status}: ${body}`);
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Shopify Admin API authentication failed (HTTP ${res.status}). Check that SHOPIFY_ADMIN_ACCESS_TOKEN has the required scopes (write_draft_orders, read_products).`
      );
    }
    throw new Error(`Shopify Admin API error (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  if (json.errors) {
    console.error("Shopify Admin GraphQL errors:", JSON.stringify(json.errors));
    throw new Error(json.errors[0]?.message || "Shopify Admin API error");
  }
  return json.data;
}

export async function createDraftOrder(input: CreateDraftOrderInput) {
  const query = `
    mutation draftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          name
          status
          totalPrice
          currencyCode
          createdAt
          customer {
            id
            email
            firstName
            lastName
          }
          lineItems(first: 20) {
            edges {
              node {
                id
                title
                quantity
                originalTotal
                variant {
                  id
                  title
                  price
                  image { url altText }
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

  const draftInput: any = {
    lineItems: input.lineItems.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
    })),
  };

  if (input.note) {
    draftInput.note = input.note;
  }

  if (input.tags?.length) {
    draftInput.tags = input.tags;
  }

  if (input.customAttributes?.length) {
    draftInput.customAttributes = input.customAttributes;
  }

  // Attach customer by email if provided
  if (input.customer?.email) {
    draftInput.email = input.customer.email;
  }

  if (input.shippingAddress) {
    draftInput.shippingAddress = {
      address1: input.shippingAddress.address1 || "",
      city: input.shippingAddress.city || "",
      province: input.shippingAddress.province || "",
      zip: input.shippingAddress.zip || "",
      country: input.shippingAddress.country || "US",
      firstName: input.customer?.firstName || "",
      lastName: input.customer?.lastName || "",
      phone: input.customer?.phone || "",
    };
  }

  const data = await adminQuery(query, { input: draftInput });

  if (data.draftOrderCreate.userErrors?.length > 0) {
    throw new Error(data.draftOrderCreate.userErrors[0].message);
  }

  const draft = data.draftOrderCreate.draftOrder;
  return {
    id: draft.id,
    name: draft.name,
    status: draft.status,
    totalPrice: draft.totalPrice,
    currencyCode: draft.currencyCode,
    createdAt: draft.createdAt,
    customer: draft.customer,
    lineItems: draft.lineItems.edges.map((e: any) => e.node),
  };
}

export async function checkAccessScopes() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN || "";
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "";
  const tokenPrefix = token ? token.substring(0, 10) + "..." : "(empty)";
  
  if (!domain || !token) {
    return { error: "Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN", tokenPrefix };
  }

  try {
    const url = `https://${domain}/admin/api/${ADMIN_API_VERSION}/graphql.json`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({
        query: `{ app { installation { accessScopes { handle } } } }`,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { error: `HTTP ${res.status}`, body: body.slice(0, 300), tokenPrefix };
    }

    const json = await res.json();
    if (json.errors) {
      return { error: "GraphQL errors", errors: json.errors, tokenPrefix };
    }

    const scopes = json.data?.app?.installation?.accessScopes?.map((s: any) => s.handle) || [];
    return {
      tokenPrefix,
      domain,
      scopes,
      hasDraftOrders: scopes.includes("write_draft_orders"),
      hasQuickSale: scopes.includes("write_quick_sale"),
    };
  } catch (err: any) {
    return { error: err.message, tokenPrefix };
  }
}

export async function getDraftOrder(id: string) {
  const query = `
    query getDraftOrder($id: ID!) {
      draftOrder(id: $id) {
        id
        name
        status
        totalPrice
        currencyCode
        note
        tags
        createdAt
        customer {
          id
          email
          firstName
          lastName
        }
        lineItems(first: 20) {
          edges {
            node {
              id
              title
              quantity
              originalTotal
              variant {
                id
                title
                price
                image { url altText }
              }
            }
          }
        }
      }
    }
  `;

  const data = await adminQuery(query, { id });
  if (!data.draftOrder) return null;

  const draft = data.draftOrder;
  return {
    id: draft.id,
    name: draft.name,
    status: draft.status,
    totalPrice: draft.totalPrice,
    currencyCode: draft.currencyCode,
    note: draft.note,
    tags: draft.tags,
    createdAt: draft.createdAt,
    customer: draft.customer,
    lineItems: draft.lineItems.edges.map((e: any) => e.node),
  };
}
