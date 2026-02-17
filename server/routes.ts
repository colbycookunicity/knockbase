import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import * as storage from "./storage";
import * as shopify from "./shopify";
import { insertUserSchema, loginSchema } from "@shared/schema";
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
  if (!user || (user.role !== "owner" && user.role !== "admin")) {
    return res.status(403).json({ message: "Owner or admin access required" });
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
      secret: process.env.SESSION_SECRET || "knockbase-dev-secret",
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

  await storage.seedAdminUser();

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Email and password required" });
      }
      const { email, password } = parsed.data;
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      if (user.isActive !== "true") {
        return res.status(403).json({ message: "Account is deactivated" });
      }
      const valid = await storage.verifyPassword(user, password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      req.session.userId = user.id;
      res.json({ user: sanitizeUser(user) });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // OTP Login: Step 1 - Request OTP code via Hydra
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

  // OTP Login: Step 2 - Verify OTP code and create session
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

      // OTP verified — create session
      req.session.userId = user.id;
      res.json({ user: sanitizeUser(user), verified: true });
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

      if (currentUser.role === "admin") {
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

      if (currentUser.role === "admin") {
        const targetUser = await storage.getUserById(targetId);
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }
        if (targetUser.id !== currentUser.id && targetUser.managerId !== currentUser.id) {
          return res.status(403).json({ message: "You can only edit your own team members" });
        }
        if (req.body.role && req.body.role !== "rep" && targetUser.id !== currentUser.id) {
          return res.status(403).json({ message: "Admins can only assign rep role" });
        }
      }

      const updates: any = {};
      if (req.body.fullName !== undefined) updates.fullName = req.body.fullName;
      if (req.body.role !== undefined) updates.role = req.body.role;
      if (req.body.email !== undefined) updates.email = req.body.email;
      if (req.body.phone !== undefined) updates.phone = req.body.phone;
      if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
      if (req.body.password) updates.password = req.body.password;
      if (req.body.username) updates.username = req.body.username;
      if (req.body.managerId !== undefined) updates.managerId = req.body.managerId;

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

    if (currentUser.role === "admin") {
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

  const httpServer = createServer(app);
  return httpServer;
}
