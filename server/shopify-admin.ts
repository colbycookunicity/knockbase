const ADMIN_API_VERSION = "2025-01";

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
    const msg = json.errors[0]?.message || "Shopify Admin API error";
    // Detect scope/permission errors and provide a helpful re-authorization message
    if (msg.toLowerCase().includes("access denied") || msg.toLowerCase().includes("required access")) {
      throw new Error(
        `${msg}. Your Admin API token may be missing required scopes. ` +
        `Please re-authorize by visiting /api/shopify/auth/install to get a new token with the correct permissions.`
      );
    }
    throw new Error(msg);
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
          invoiceUrl
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
    invoiceUrl: draft.invoiceUrl,
    createdAt: draft.createdAt,
    customer: draft.customer,
    lineItems: draft.lineItems.edges.map((e: any) => e.node),
  };
}

export async function sendDraftOrderInvoice(draftOrderId: string, to?: string) {
  const query = `
    mutation draftOrderInvoiceSend($id: ID!, $email: EmailInput) {
      draftOrderInvoiceSend(id: $id, email: $email) {
        draftOrder {
          id
          name
          status
          invoiceSentAt
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables: any = { id: draftOrderId };
  if (to) {
    variables.email = { to };
  }

  const data = await adminQuery(query, variables);
  if (data.draftOrderInvoiceSend.userErrors?.length > 0) {
    throw new Error(data.draftOrderInvoiceSend.userErrors[0].message);
  }
  return data.draftOrderInvoiceSend.draftOrder;
}

export function isAdminConfigured(): boolean {
  return !!(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_ADMIN_ACCESS_TOKEN);
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

// ========== SHOPIFYQL ANALYTICS ==========

export async function runShopifyqlQuery(shopifyql: string): Promise<any> {
  const query = `
    query shopifyqlQuery($query: String!) {
      shopifyqlQuery(query: $query) {
        __typename
        ... on TableResponse {
          tableData {
            unformattedData
            rowData
            columns {
              name
              dataType
              displayName
            }
          }
        }
        parseErrors {
          code
          message
        }
      }
    }
  `;

  const data = await adminQuery(query, { query: shopifyql });

  if (data.shopifyqlQuery.parseErrors?.length > 0) {
    throw new Error("ShopifyQL parse error: " + data.shopifyqlQuery.parseErrors[0].message);
  }

  if (data.shopifyqlQuery.__typename !== "TableResponse") {
    throw new Error("Unexpected ShopifyQL response type: " + data.shopifyqlQuery.__typename);
  }

  return data.shopifyqlQuery.tableData;
}

// POS Staff Daily Sales - matches the Shopify admin analytics report
export async function getPosStaffSales(sinceDays: number = 7): Promise<any> {
  const shopifyql = `
    FROM sales
    SHOW orders,
      average_order_value,
      gross_sales,
      discounts,
      returns,
      net_sales,
      shipping_charges,
      taxes,
      total_sales
    WHERE sales_channel = 'Point of Sale'
      AND staff_member_name IS NOT NULL
    GROUP BY staff_member_name, pos_location_name
    TIMESERIES day
    WITH TOTALS, GROUP_TOTALS
    SINCE startOfDay(-${sinceDays}d) UNTIL today
    ORDER BY day ASC, total_sales DESC
    LIMIT 1000
  `;

  const tableData = await runShopifyqlQuery(shopifyql);
  return parseShopifyqlTable(tableData);
}

// POS Staff Sales Summary (no daily timeseries, just totals per staff)
export async function getPosStaffSummary(sinceDays: number = 7): Promise<any> {
  const shopifyql = `
    FROM sales
    SHOW orders,
      average_order_value,
      gross_sales,
      discounts,
      returns,
      net_sales,
      taxes,
      total_sales
    WHERE sales_channel = 'Point of Sale'
      AND staff_member_name IS NOT NULL
    GROUP BY staff_member_name
    WITH TOTALS
    SINCE startOfDay(-${sinceDays}d) UNTIL today
    ORDER BY total_sales DESC
    LIMIT 100
  `;

  const tableData = await runShopifyqlQuery(shopifyql);
  return parseShopifyqlTable(tableData);
}

function parseShopifyqlTable(tableData: any): { columns: any[]; rows: any[] } {
  const { columns, rowData, unformattedData } = tableData;

  // rowData contains formatted strings, unformattedData contains raw values
  // Use unformattedData for numbers, rowData for display
  const data = unformattedData || rowData || [];

  const rows = data.map((row: any[]) => {
    const obj: Record<string, any> = {};
    columns.forEach((col: any, idx: number) => {
      obj[col.name] = row[idx];
    });
    return obj;
  });

  return { columns, rows };
}

// POS Orders for a specific staff member - individual order drill-down
export async function getPosStaffOrders(staffName: string, sinceDays: number = 7): Promise<any> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - sinceDays);
  const sinceISO = sinceDate.toISOString();

  // Query orders from Shopify Admin API filtered by POS channel and staff
  const query = `
    query posOrders($query: String!, $first: Int!) {
      orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            createdAt
            displayFinancialStatus
            displayFulfillmentStatus
            totalPriceSet { shopMoney { amount currencyCode } }
            subtotalPriceSet { shopMoney { amount currencyCode } }
            totalDiscountsSet { shopMoney { amount currencyCode } }
            totalTaxSet { shopMoney { amount currencyCode } }
            customer {
              id
              firstName
              lastName
              email
            }
            lineItems(first: 10) {
              edges {
                node {
                  title
                  quantity
                  originalTotalSet { shopMoney { amount currencyCode } }
                  variant {
                    title
                    image { url altText }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  // Shopify search syntax for POS orders by staff
  const searchQuery = `source_name:pos AND created_at:>='${sinceISO}' AND tag_not:draft`;
  const data = await adminQuery(query, { query: searchQuery, first: 100 });

  const orders = data.orders.edges.map((e: any) => {
    const o = e.node;
    return {
      id: o.id,
      name: o.name,
      createdAt: o.createdAt,
      financialStatus: o.displayFinancialStatus,
      fulfillmentStatus: o.displayFulfillmentStatus,
      totalPrice: o.totalPriceSet?.shopMoney?.amount,
      subtotalPrice: o.subtotalPriceSet?.shopMoney?.amount,
      totalDiscounts: o.totalDiscountsSet?.shopMoney?.amount,
      totalTax: o.totalTaxSet?.shopMoney?.amount,
      currencyCode: o.totalPriceSet?.shopMoney?.currencyCode,
      customer: o.customer ? {
        firstName: o.customer.firstName,
        lastName: o.customer.lastName,
        email: o.customer.email,
      } : null,
      lineItems: o.lineItems.edges.map((li: any) => ({
        title: li.node.title,
        quantity: li.node.quantity,
        total: li.node.originalTotalSet?.shopMoney?.amount,
        variantTitle: li.node.variant?.title,
        imageUrl: li.node.variant?.image?.url,
      })),
    };
  });

  return { orders, staffName, sinceDays };
}

// POS Staff daily breakdown - timeseries for a single staff member
export async function getPosStaffDailyBreakdown(staffName: string, sinceDays: number = 7): Promise<any> {
  const shopifyql = `
    FROM sales
    SHOW orders,
      gross_sales,
      discounts,
      net_sales,
      taxes,
      total_sales
    WHERE sales_channel = 'Point of Sale'
      AND staff_member_name = '${staffName.replace(/'/g, "\\'")}'
    TIMESERIES day
    WITH TOTALS
    SINCE startOfDay(-${sinceDays}d) UNTIL today
    ORDER BY day ASC
    LIMIT 100
  `;

  const tableData = await runShopifyqlQuery(shopifyql);
  return parseShopifyqlTable(tableData);
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
