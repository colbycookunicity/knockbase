import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import * as storage from "./storage";
import { insertUserSchema, loginSchema } from "@shared/schema";

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

async function requireAdminOrManager(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const user = await storage.getUserById(req.session.userId);
  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return res.status(403).json({ message: "Admin or manager access required" });
  }
  (req as any).currentUser = user;
  next();
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const user = await storage.getUserById(req.session.userId);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
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
        return res.status(400).json({ message: "Username and password required" });
      }
      const { username, password } = parsed.data;
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      if (user.isActive !== "true") {
        return res.status(403).json({ message: "Account is deactivated" });
      }
      const valid = await storage.verifyPassword(user, password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      req.session.userId = user.id;
      res.json({ user: sanitizeUser(user) });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ message: "Server error" });
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

  app.get("/api/users", requireAdminOrManager, async (req, res) => {
    const currentUser = (req as any).currentUser;
    const visibleUsers = await storage.getVisibleUsers(currentUser);
    res.json(visibleUsers.map(sanitizeUser));
  });

  app.post("/api/users", requireAdminOrManager, async (req, res) => {
    try {
      const currentUser = (req as any).currentUser;
      const body = { ...req.body };

      if (currentUser.role === "manager") {
        body.role = "sales_rep";
        body.managerId = currentUser.id;
      }

      if (currentUser.role === "admin" && body.role === "sales_rep" && !body.managerId) {
        // admin creating a rep without a manager - that's fine
      }

      const parsed = insertUserSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid user data", errors: parsed.error.flatten() });
      }
      const existing = await storage.getUserByUsername(parsed.data.username);
      if (existing) {
        return res.status(409).json({ message: "Username already taken" });
      }
      const user = await storage.createUser(parsed.data);
      res.status(201).json(sanitizeUser(user));
    } catch (err) {
      console.error("Create user error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/users/:id", requireAdminOrManager, async (req, res) => {
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
        if (req.body.role && req.body.role !== "sales_rep" && targetUser.id !== currentUser.id) {
          return res.status(403).json({ message: "Managers can only assign sales_rep role" });
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

  app.delete("/api/users/:id", requireAdminOrManager, async (req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
