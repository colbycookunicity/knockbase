import { eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "./db";
import { users, leads, territories, orgUnits, type InsertUser, type InsertOrgUnit, type User } from "@shared/schema";

export async function createUser(data: InsertUser): Promise<User> {
  const [user] = await db
    .insert(users)
    .values({ ...data, password: "" })
    .returning();
  return user;
}

export async function getUserById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.username, username));
  return user;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(ilike(users.email, email));
  return user;
}

export async function getAllUsers(): Promise<User[]> {
  return db.select().from(users);
}

export async function getUsersByManagerId(managerId: string): Promise<User[]> {
  return db.select().from(users).where(eq(users.managerId, managerId));
}

export async function getVisibleUsers(currentUser: User): Promise<User[]> {
  if (currentUser.role === "owner") {
    return db.select().from(users);
  }
  if (currentUser.role === "manager") {
    const teamMembers = await getUsersByManagerId(currentUser.id);
    return [currentUser, ...teamMembers];
  }
  return [currentUser];
}

export async function updateUser(id: string, data: Partial<Omit<User, "id" | "createdAt">>): Promise<User | undefined> {
  const { password, ...updateData } = data as any;
  const [user] = await db.update(users).set({ ...updateData, updatedAt: new Date() }).where(eq(users.id, id)).returning();
  return user;
}

export async function deleteUser(id: string): Promise<boolean> {
  const result = await db.delete(users).where(eq(users.id, id)).returning();
  return result.length > 0;
}

export async function getLeadsByUserRole(user: User): Promise<any[]> {
  if (user.role === "owner") {
    return db.select().from(leads);
  }
  if (user.role === "manager") {
    const teamMembers = await getUsersByManagerId(user.id);
    const teamIds = [user.id, ...teamMembers.map((m) => m.id)];
    return db.select().from(leads).where(inArray(leads.userId, teamIds));
  }
  return db.select().from(leads).where(eq(leads.userId, user.id));
}

export async function getLeadsByUserId(userId: string, role: string): Promise<any[]> {
  const user = await getUserById(userId);
  if (!user) return [];
  return getLeadsByUserRole(user);
}

// Admin leads: returns leads with rep info joined
export async function getAdminLeads(currentUser: User): Promise<any[]> {
  const roleLeads = await getLeadsByUserRole(currentUser);
  if (roleLeads.length === 0) return [];

  // Get all users that could own these leads
  const visibleUsers = await getVisibleUsers(currentUser);
  const userMap = new Map(visibleUsers.map((u) => [u.id, u]));

  return roleLeads.map((lead: any) => {
    const rep = userMap.get(lead.userId);
    return {
      ...lead,
      repName: rep?.fullName || "Unknown",
      repEmail: rep?.email || "",
    };
  });
}

// Team stats: per-rep performance metrics
export async function getTeamStats(currentUser: User): Promise<any[]> {
  const visibleUsers = await getVisibleUsers(currentUser);
  const repsAndManagers = visibleUsers.filter((u) => u.role === "rep" || u.role === "manager");

  // Get all leads for these users
  const allLeads = await getLeadsByUserRole(currentUser);

  // Group leads by userId
  const leadsByUser = new Map<string, any[]>();
  for (const lead of allLeads) {
    const userId = lead.userId;
    if (!leadsByUser.has(userId)) leadsByUser.set(userId, []);
    leadsByUser.get(userId)!.push(lead);
  }

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return repsAndManagers.map((user) => {
    const userLeads = leadsByUser.get(user.id) || [];
    const contactStatuses = ["callback", "appointment", "sold", "follow_up", "not_interested"];

    const totalLeads = userLeads.length;
    const doorsKnocked = userLeads.filter((l: any) => l.knockedAt).length;
    const contacts = userLeads.filter((l: any) => contactStatuses.includes(l.status)).length;
    const appointments = userLeads.filter((l: any) => l.status === "appointment").length;
    const sales = userLeads.filter((l: any) => l.status === "sold").length;
    const contactRate = doorsKnocked > 0 ? Math.round((contacts / doorsKnocked) * 100) : 0;
    const closeRate = contacts > 0 ? Math.round((sales / contacts) * 100) : 0;

    // Today stats
    const todayLeads = userLeads.filter((l: any) => l.knockedAt && l.knockedAt.startsWith(todayStr));
    const todayDoors = todayLeads.length;
    const todaySales = todayLeads.filter((l: any) => l.status === "sold").length;

    // Week stats
    const weekLeads = userLeads.filter((l: any) => l.knockedAt && new Date(l.knockedAt) >= weekAgo);
    const weekDoors = weekLeads.length;
    const weekSales = weekLeads.filter((l: any) => l.status === "sold").length;

    // Last activity
    const sortedByUpdate = [...userLeads].sort(
      (a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    const lastActivity = sortedByUpdate[0]?.updatedAt || null;

    return {
      userId: user.id,
      repName: user.fullName,
      repEmail: user.email,
      role: user.role,
      isActive: user.isActive,
      managerId: user.managerId,
      totalLeads,
      doorsKnocked,
      contacts,
      appointments,
      sales,
      contactRate,
      closeRate,
      todayDoors,
      todaySales,
      weekDoors,
      weekSales,
      lastActivity,
    };
  });
}

export async function createLead(data: any): Promise<any> {
  const [lead] = await db.insert(leads).values(data).returning();
  return lead;
}

export async function updateLead(id: string, data: any): Promise<any> {
  const [lead] = await db
    .update(leads)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(leads.id, id))
    .returning();
  return lead;
}

export async function deleteLead(id: string): Promise<boolean> {
  const result = await db.delete(leads).where(eq(leads.id, id)).returning();
  return result.length > 0;
}

// Reassign a lead to a different rep
export async function reassignLead(leadId: string, newUserId: string): Promise<any> {
  const [lead] = await db
    .update(leads)
    .set({ userId: newUserId, updatedAt: new Date() })
    .where(eq(leads.id, leadId))
    .returning();
  return lead;
}

export async function getAllTerritories(): Promise<any[]> {
  return db.select().from(territories);
}

export async function createTerritory(data: any): Promise<any> {
  const [territory] = await db.insert(territories).values(data).returning();
  return territory;
}

export async function updateTerritory(id: string, data: any): Promise<any> {
  const [territory] = await db
    .update(territories)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(territories.id, id))
    .returning();
  return territory;
}

export async function deleteTerritory(id: string): Promise<boolean> {
  const result = await db.delete(territories).where(eq(territories.id, id)).returning();
  return result.length > 0;
}

// Org unit CRUD
export async function getAllOrgUnits(): Promise<any[]> {
  return db.select().from(orgUnits);
}

export async function getOrgUnitById(id: string): Promise<any | undefined> {
  const [unit] = await db.select().from(orgUnits).where(eq(orgUnits.id, id));
  return unit;
}

export async function createOrgUnit(data: InsertOrgUnit): Promise<any> {
  const [unit] = await db.insert(orgUnits).values(data).returning();
  return unit;
}

export async function updateOrgUnit(id: string, data: Partial<InsertOrgUnit>): Promise<any | undefined> {
  const [unit] = await db
    .update(orgUnits)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(orgUnits.id, id))
    .returning();
  return unit;
}

export async function deleteOrgUnit(id: string): Promise<boolean> {
  const result = await db.delete(orgUnits).where(eq(orgUnits.id, id)).returning();
  return result.length > 0;
}

export async function runMigrations(): Promise<void> {
  const { pool } = await import("./db");
  // Add last_login_at column if it doesn't exist
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP
  `).catch(() => {});

  // Add org_unit_id column to users if it doesn't exist
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS org_unit_id VARCHAR
  `).catch(() => {});

  // Create org_units table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS org_units (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'team',
      parent_id VARCHAR,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `).catch(() => {});

  // Rename role "admin" to "manager" for existing users
  await pool.query(`
    UPDATE users SET role = 'manager' WHERE role = 'admin'
  `).catch(() => {});
}

export async function seedAdminUser(): Promise<void> {
  const existing = await getUserByEmail("colby.cook@unicity.com");
  if (!existing) {
    await createUser({
      username: "colby",
      fullName: "Colby Cook",
      role: "owner",
      email: "colby.cook@unicity.com",
      phone: "",
    });
    console.log("Default owner user created (email: colby.cook@unicity.com, login via OTP)");
  } else if (existing.role !== "owner") {
    await updateUser(existing.id, { role: "owner" });
    console.log("Updated colby.cook@unicity.com to owner role");
  }
}
