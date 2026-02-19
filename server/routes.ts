import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import * as storage from "./storage";
import * as shopify from "./shopify";
import * as shopifyAdmin from "./shopify-admin";
import * as shopifyOAuth from "./shopify-oauth";
import { insertUserSchema, insertOrgUnitSchema } from "@shared/schema";
import { requestOtp, verifyOtp, HydraError } from "./services/hydraClient";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

async function requireOwnerOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const user = await storage.getUserById(req.session.userId);
  if (!user || (user.role !== "owner" && user.role !== "manager")) {
    return res.status(403).json({ message: "Owner or manager access required" });
  }
  (req as any).currentUser = user;
  next();
}

async function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const user = await storage.getUserById(req.session.userId);
  if (!user || user.role !== "owner") {
    return res.status(403).json({ message: "Owner access required" });
  }
  next();
}

function sanitizeUser(user: any) {
  const { password, ...rest } = user;
  return rest;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const PgSession = connectPgSimple(session);

  app.use(
    session({
      store: new PgSession({
        pool: pool as any,
        tableName: "user_sessions",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "feelgreatd2d-dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      },
    })
  );

  await storage.runMigrations();
  await storage.seedAdminUser();

  app.post("/api/auth/otp/request", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email.trim().toLowerCase());
      if (!user) {
        return res.status(404).json({ message: "No account found with this email" });
      }
      if (user.isActive !== "true") {
        return res.status(403).json({ message: "Account is deactivated" });
      }

      await requestOtp(email.trim().toLowerCase());
      res.json({ message: "Verification code sent to your email" });
    } catch (err) {
      if (err instanceof HydraError) {
        return res.status(400).json({ message: err.message, code: err.code });
      }
      console.error("OTP request error:", err);
      res.status(500).json({ message: "Failed to send verification code" });
    }
  });

  app.post("/api/auth/otp/verify", async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || typeof email !== "string" || !code || typeof code !== "string") {
        return res.status(400).json({ message: "Email and code are required" });
      }

      const user = await storage.getUserByEmail(email.trim().toLowerCase());
      if (!user) {
        return res.status(404).json({ message: "No account found with this email" });
      }
      if (user.isActive !== "true") {
        return res.status(403).json({ message: "Account is deactivated" });
      }

      await verifyOtp(email.trim().toLowerCase(), code.trim());

      await storage.updateUser(user.id, { lastLoginAt: new Date() });

      req.session.userId = user.id;
      res.json({ user: sanitizeUser({ ...user, lastLoginAt: new Date() }), verified: true });
    } catch (err) {
      if (err instanceof HydraError) {
        return res.status(400).json({ message: err.message, code: err.code });
      }
      console.error("OTP verify error:", err);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    res.json({ user: sanitizeUser(user) });
  });

  app.get("/api/users", requireOwnerOrAdmin, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const visibleUsers = await storage.getVisibleUsers(currentUser);
    res.json(visibleUsers.map(sanitizeUser));
  });

  app.post("/api/users", requireOwnerOrAdmin, async (req, res) => {
    try {
      const currentUser = (req as any).currentUser;
      const body = { ...req.body };

      if (currentUser.role === "manager") {
        body.role = "rep";
        body.managerId = currentUser.id;
      }

      if (currentUser.role === "owner" && body.role === "rep" && !body.managerId) {
        // owner creating a rep without an admin - that's fine
      }

      const parsed = insertUserSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid user data", errors: parsed.error.flatten() });
      }
      const existing = await storage.getUserByEmail(parsed.data.email);
      if (existing) {
        return res.status(409).json({ message: "Email already taken" });
      }
      const user = await storage.createUser(parsed.data);
      res.status(201).json(sanitizeUser(user));
    } catch (err) {
      console.error("Create user error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/users/:id", requireOwnerOrAdmin, async (req, res) => {
    try {
      const currentUser = (req as any).currentUser;
      const targetId = req.params.id as string;

      if (currentUser.role === "manager") {
        const targetUser = await storage.getUserById(targetId);
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }
        if (targetUser.id !== currentUser.id && targetUser.managerId !== currentUser.id) {
          return res.status(403).json({ message: "You can only edit your own team members" });
        }
        if (req.body.role && req.body.role !== "rep" && targetUser.id !== currentUser.id) {
          return res.status(403).json({ message: "Managers can only assign rep role" });
        }
      }

      const updates: any = {};
      if (req.body.fullName !== undefined) updates.fullName = req.body.fullName;
      if (req.body.role !== undefined) updates.role = req.body.role;
      if (req.body.email !== undefined) updates.email = req.body.email;
      if (req.body.phone !== undefined) updates.phone = req.body.phone;
      if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
      if (req.body.username) updates.username = req.body.username;
      if (req.body.managerId !== undefined) updates.managerId = req.body.managerId;
      if (req.body.orgUnitId !== undefined) updates.orgUnitId = req.body.orgUnitId;
      if (req.body.shopifyStaffName !== undefined) updates.shopifyStaffName = req.body.shopifyStaffName;

      const user = await storage.updateUser(targetId, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(sanitizeUser(user));
    } catch (err) {
      console.error("Update user error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/users/:id", requireOwnerOrAdmin, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const targetId = req.params.id as string;

    if (currentUser.role === "manager") {
      const targetUser = await storage.getUserById(targetId);
      if (!targetUser || targetUser.managerId !== currentUser.id) {
        return res.status(403).json({ message: "You can only delete your own team members" });
      }
    }

    const success = await storage.deleteUser(targetId);
    if (!success) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted" });
  });

  app.get("/api/leads", requireAuth, async (req, res) => {
    const user = await storage.getUserById(req.session.userId!);
    if (!user) return res.status(401).json({ message: "User not found" });
    const userLeads = await storage.getLeadsByUserRole(user);
    res.json(userLeads);
  });

  app.post("/api/leads", requireAuth, async (req, res) => {
    try {
      const lead = await storage.createLead({
        ...req.body,
        userId: req.session.userId,
        tags: req.body.tags || [],
      });
      res.status(201).json(lead);
    } catch (err) {
      console.error("Create lead error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      const lead = await storage.updateLead(req.params.id as string, req.body);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(lead);
    } catch (err) {
      console.error("Update lead error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/leads/:id", requireAuth, async (req, res) => {
    const success = await storage.deleteLead(req.params.id as string);
    if (!success) {
      return res.status(404).json({ message: "Lead not found" });
    }
    res.json({ message: "Lead deleted" });
  });

  app.get("/api/territories", requireAuth, async (_req, res) => {
    const allTerritories = await storage.getAllTerritories();
    res.json(allTerritories);
  });

  app.post("/api/territories", requireAuth, async (req, res) => {
    try {
      const territory = await storage.createTerritory(req.body);
      res.status(201).json(territory);
    } catch (err) {
      console.error("Create territory error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/territories/:id", requireAuth, async (req, res) => {
    try {
      const territory = await storage.updateTerritory(req.params.id as string, req.body);
      if (!territory) {
        return res.status(404).json({ message: "Territory not found" });
      }
      res.json(territory);
    } catch (err) {
      console.error("Update territory error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/territories/:id", requireAuth, async (req, res) => {
    const success = await storage.deleteTerritory(req.params.id as string);
    if (!success) {
      return res.status(404).json({ message: "Territory not found" });
    }
    res.json({ message: "Territory deleted" });
  });

  // Admin: leads with rep info (optional orgUnitId filter)
  app.get("/api/admin/leads", requireOwnerOrAdmin, async (req, res) => {
    try {
      const currentUser = (req as any).currentUser;
      const orgUnitId = req.query.orgUnitId as string | undefined;
      const adminLeads = await storage.getAdminLeads(currentUser, orgUnitId || undefined);
      res.json(adminLeads);
    } catch (err) {
      console.error("Admin leads error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Admin: team performance stats (optional orgUnitId filter)
  app.get("/api/admin/team-stats", requireOwnerOrAdmin, async (req, res) => {
    try {
      const currentUser = (req as any).currentUser;
      const orgUnitId = req.query.orgUnitId as string | undefined;
      const stats = await storage.getTeamStats(currentUser, orgUnitId || undefined);
      res.json(stats);
    } catch (err) {
      console.error("Team stats error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Admin: reassign a lead to a different rep
  app.put("/api/admin/leads/:id/reassign", requireOwnerOrAdmin, async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }
      const lead = await storage.reassignLead(req.params.id as string, userId);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(lead);
    } catch (err) {
      console.error("Reassign lead error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Org unit members
  app.get("/api/org-units/:id/members", requireOwnerOrAdmin, async (req, res) => {
    try {
      const members = await storage.getUsersByOrgUnit(req.params.id as string);
      res.json(members.map(sanitizeUser));
    } catch (err) {
      console.error("Org unit members error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Org units CRUD
  app.get("/api/org-units", requireAuth, async (_req, res) => {
    try {
      const units = await storage.getAllOrgUnits();
      res.json(units);
    } catch (err) {
      console.error("Get org units error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/org-units", requireOwner, async (req, res) => {
    try {
      const parsed = insertOrgUnitSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid org unit data", errors: parsed.error.flatten() });
      }
      const unit = await storage.createOrgUnit(parsed.data);
      res.status(201).json(unit);
    } catch (err) {
      console.error("Create org unit error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/org-units/:id", requireOwner, async (req, res) => {
    try {
      const unit = await storage.updateOrgUnit(req.params.id as string, req.body);
      if (!unit) {
        return res.status(404).json({ message: "Org unit not found" });
      }
      res.json(unit);
    } catch (err) {
      console.error("Update org unit error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/org-units/:id", requireOwner, async (req, res) => {
    try {
      const success = await storage.deleteOrgUnit(req.params.id as string);
      if (!success) {
        return res.status(404).json({ message: "Org unit not found" });
      }
      res.json({ message: "Org unit deleted" });
    } catch (err) {
      console.error("Delete org unit error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // POS Sales analytics (admin view - all staff)
  app.get("/api/admin/pos-sales", requireOwnerOrAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const data = await shopifyAdmin.getPosStaffSales(days);
      res.json(data);
    } catch (err: any) {
      console.error("POS sales error:", err);
      res.status(500).json({ message: err.message || "Failed to fetch POS sales data" });
    }
  });

  // POS Sales summary (admin view - totals per staff)
  app.get("/api/admin/pos-summary", requireOwnerOrAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const data = await shopifyAdmin.getPosStaffSummary(days);
      res.json(data);
    } catch (err: any) {
      console.error("POS summary error:", err);
      res.status(500).json({ message: err.message || "Failed to fetch POS summary" });
    }
  });

  // POS Sales for current user (individual rep view)
  app.get("/api/pos-sales/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(401).json({ message: "User not found" });
      if (!user.shopifyStaffName) {
        return res.json({ columns: [], rows: [], staffName: null });
      }
      const days = parseInt(req.query.days as string) || 7;
      const data = await shopifyAdmin.getPosStaffSales(days);
      // Filter to just this user's staff name
      const filtered = data.rows.filter((r: any) =>
        r.staff_member_name && r.staff_member_name.toLowerCase() === user.shopifyStaffName!.toLowerCase()
      );
      res.json({ ...data, rows: filtered, staffName: user.shopifyStaffName });
    } catch (err: any) {
      console.error("POS sales/me error:", err);
      res.status(500).json({ message: err.message || "Failed to fetch POS sales" });
    }
  });

  app.get("/api/shopify/products", requireAuth, async (req, res) => {
    try {
      const first = parseInt(req.query.first as string) || 20;
      const after = req.query.after as string | undefined;
      const result = await shopify.getProducts(first, after);
      res.json(result);
    } catch (err: any) {
      console.error("Shopify products error:", err);
      res.status(500).json({ message: err.message || "Failed to fetch products" });
    }
  });

  app.get("/api/shopify/products/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const fullId = id.startsWith("gid://") ? id : `gid://shopify/Product/${id}`;
      const product = await shopify.getProduct(fullId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (err: any) {
      console.error("Shopify product error:", err);
      res.status(500).json({ message: err.message || "Failed to fetch product" });
    }
  });

  app.get("/api/shopify/search", requireAuth, async (req, res) => {
    try {
      const q = req.query.q as string;
      if (!q) return res.json([]);
      const products = await shopify.searchProducts(q);
      res.json(products);
    } catch (err: any) {
      console.error("Shopify search error:", err);
      res.status(500).json({ message: err.message || "Search failed" });
    }
  });

  app.post("/api/shopify/checkout", requireAuth, async (req, res) => {
    try {
      const { lineItems } = req.body;
      if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        return res.status(400).json({ message: "Line items required" });
      }
      const cart = await shopify.createCheckout(lineItems);
      res.json(cart);
    } catch (err: any) {
      console.error("Shopify checkout error:", err);
      res.status(500).json({ message: err.message || "Checkout failed" });
    }
  });

  app.get("/api/shopify/shop", requireAuth, async (_req, res) => {
    try {
      const shop = await shopify.getShopInfo();
      res.json(shop);
    } catch (err: any) {
      console.error("Shopify shop error:", err);
      res.status(500).json({ message: err.message || "Failed to fetch shop info" });
    }
  });

  app.get("/api/shopify/admin-scopes", requireAuth, async (_req, res) => {
    try {
      const result = await shopifyAdmin.checkAccessScopes();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Shopify Order via Storefront Cart API
  app.post("/api/shopify/draft-order", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(401).json({ message: "User not found" });

      const { lineItems, leadId, customerEmail, customerFirstName, customerLastName } = req.body;
      if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        return res.status(400).json({ message: "Line items required" });
      }

      const note = `Feel Great D2D Order | Rep: ${user.fullName}${leadId ? ` | Lead: ${leadId}` : ""}`;
      const customAttributes = [
        { key: "repId", value: user.id },
        { key: "repName", value: user.fullName },
        { key: "source", value: "feelgreatd2d" },
      ];

      if (leadId) {
        customAttributes.push({ key: "leadId", value: leadId });
      }
      if (customerFirstName || customerLastName) {
        customAttributes.push({ key: "customerName", value: `${customerFirstName || ""} ${customerLastName || ""}`.trim() });
      }

      const cart = await shopify.createCartWithAttributes(
        lineItems,
        note,
        customAttributes,
        customerEmail || undefined,
      );

      res.status(201).json({
        id: cart.id,
        name: `Cart ${cart.id.split("/").pop()?.substring(0, 8) || ""}`,
        checkoutUrl: cart.checkoutUrl,
        totalQuantity: cart.totalQuantity,
        cost: cart.cost,
        lines: cart.lines,
      });
    } catch (err: any) {
      console.error("Cart order error:", err.message, err.stack);
      res.status(500).json({ message: err.message || "Failed to create order" });
    }
  });

  // ─── Shopify Admin API Draft Orders (visible in Shopify Admin + POS app) ───

  // Check if Admin API is available
  app.get("/api/shopify/admin/status", requireAuth, (_req, res) => {
    res.json({ available: shopifyAdmin.isAdminConfigured() });
  });

  // Create a real Shopify Draft Order via Admin API
  app.post("/api/shopify/admin/draft-order", requireAuth, async (req, res) => {
    try {
      if (!shopifyAdmin.isAdminConfigured()) {
        return res.status(503).json({
          message: "Shopify Admin API not configured. Set SHOPIFY_ADMIN_ACCESS_TOKEN to enable draft orders.",
        });
      }

      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(401).json({ message: "User not found" });

      const {
        lineItems, leadId, customerEmail, customerFirstName,
        customerLastName, customerPhone, sendInvoice,
      } = req.body;

      if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        return res.status(400).json({ message: "Line items required" });
      }

      // Build note with selling plan info since Admin API doesn't support sellingPlanId
      const planNotes = lineItems
        .filter((li: any) => li.sellingPlanName)
        .map((li: any) => `${li.sellingPlanName}`)
        .join(", ");
      const noteLines = [`Feel Great D2D Order | Rep: ${user.fullName}`];
      if (leadId) noteLines.push(`Lead: ${leadId}`);
      if (planNotes) noteLines.push(`Subscription: ${planNotes}`);
      const note = noteLines.join(" | ");

      const tags = ["feelgreatd2d"];
      if (lineItems.some((li: any) => li.sellingPlanId)) {
        tags.push("subscription");
      }

      const customAttributes = [
        { key: "repId", value: user.id },
        { key: "repName", value: user.fullName },
        { key: "source", value: "feelgreatd2d" },
      ];
      if (leadId) customAttributes.push({ key: "leadId", value: leadId });

      // Map line items for Admin API (strip sellingPlanId since Admin API doesn't support it)
      const adminLineItems = lineItems.map((li: any) => ({
        variantId: li.variantId,
        quantity: li.quantity,
      }));

      const draft = await shopifyAdmin.createDraftOrder({
        lineItems: adminLineItems,
        customer: {
          firstName: customerFirstName,
          lastName: customerLastName,
          email: customerEmail,
          phone: customerPhone,
        },
        note,
        tags,
        customAttributes,
      });

      // Optionally send invoice email
      if (sendInvoice && customerEmail && draft.id) {
        try {
          await shopifyAdmin.sendDraftOrderInvoice(draft.id, customerEmail);
          (draft as any).invoiceSent = true;
        } catch (invoiceErr: any) {
          console.warn("Failed to send draft order invoice:", invoiceErr.message);
          (draft as any).invoiceSent = false;
          (draft as any).invoiceError = invoiceErr.message;
        }
      }

      res.status(201).json(draft);
    } catch (err: any) {
      console.error("Admin draft order error:", err.message, err.stack);
      res.status(500).json({ message: err.message || "Failed to create draft order" });
    }
  });

  // Send/resend invoice for an existing draft order
  app.post("/api/shopify/admin/draft-order/:id/send-invoice", requireAuth, async (req, res) => {
    try {
      if (!shopifyAdmin.isAdminConfigured()) {
        return res.status(503).json({ message: "Shopify Admin API not configured" });
      }
      const { email } = req.body;
      const result = await shopifyAdmin.sendDraftOrderInvoice(req.params.id, email);
      res.json(result);
    } catch (err: any) {
      console.error("Send invoice error:", err.message);
      res.status(500).json({ message: err.message || "Failed to send invoice" });
    }
  });

  // ─── Shopify OAuth: Install flow to get Admin API access token ───

  // Step 1: Visit this URL to start the OAuth install flow
  app.get("/api/shopify/auth/install", (req, res) => {
    try {
      const forwardedProto = req.header("x-forwarded-proto") || req.protocol || "https";
      const forwardedHost = req.header("x-forwarded-host") || req.get("host");
      const baseUrl = `${forwardedProto}://${forwardedHost}`;
      const installUrl = shopifyOAuth.getInstallUrl(baseUrl);
      res.redirect(installUrl);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Step 2: Shopify redirects here after merchant approves the app
  app.get("/api/shopify/auth/callback", async (req, res) => {
    try {
      const query: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === "string") query[key] = value;
      }

      const { accessToken, scopes } = await shopifyOAuth.handleCallback(query);
      const shop = query.shop || process.env.SHOPIFY_STORE_DOMAIN || "unknown";

      // Dynamically update the in-memory env so the admin client works immediately
      process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = accessToken;
      console.log(`[Shopify OAuth] Token obtained for ${shop} with scopes: ${scopes}`);

      // Render a page showing the token so the user can copy it into Replit Secrets
      const html = shopifyOAuth.renderTokenPage(accessToken, scopes, shop);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(html);
    } catch (err: any) {
      console.error("Shopify OAuth callback error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
