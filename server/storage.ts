import { eq, inArray, or } from "drizzle-orm";
import { db } from "./db";
import { users, leads, territories, type InsertUser, type User } from "@shared/schema";
import bcrypt from "bcryptjs";

export async function createUser(data: InsertUser): Promise<User> {
  const hashedPassword = await bcrypt.hash(data.password, 10);
  const [user] = await db
    .insert(users)
    .values({ ...data, password: hashedPassword })
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
  const [user] = await db.select().from(users).where(eq(users.email, email));
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
  if (currentUser.role === "admin") {
    const teamMembers = await getUsersByManagerId(currentUser.id);
    return [currentUser, ...teamMembers];
  }
  return [currentUser];
}

export async function updateUser(id: string, data: Partial<Omit<User, "id" | "createdAt">>): Promise<User | undefined> {
  const updateData: any = { ...data, updatedAt: new Date() };
  if (data.password) {
    updateData.password = await bcrypt.hash(data.password, 10);
  }
  const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
  return user;
}

export async function deleteUser(id: string): Promise<boolean> {
  const result = await db.delete(users).where(eq(users.id, id)).returning();
  return result.length > 0;
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password);
}

export async function getLeadsByUserRole(user: User): Promise<any[]> {
  if (user.role === "owner") {
    return db.select().from(leads);
  }
  if (user.role === "admin") {
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

export async function seedAdminUser(): Promise<void> {
  const existing = await getUserByEmail("admin@knockbase.com");
  if (!existing) {
    await createUser({
      username: "admin",
      password: "admin123",
      fullName: "Admin User",
      role: "owner",
      email: "admin@knockbase.com",
      phone: "",
    });
    console.log("Default owner user created (email: admin@knockbase.com, password: admin123)");
  }
}
