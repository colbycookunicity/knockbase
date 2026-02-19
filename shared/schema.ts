import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, doublePrecision, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().default(""),
  password: text("password").notNull().default(""),
  fullName: text("full_name").notNull().default(""),
  role: text("role").notNull().default("rep"),
  managerId: varchar("manager_id"),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().default(""),
  orgUnitId: varchar("org_unit_id"),
  shopifyStaffName: text("shopify_staff_name"),
  isActive: text("is_active").notNull().default("true"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const leads = pgTable("leads", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  address: text("address").notNull().default(""),
  latitude: doublePrecision("latitude").notNull().default(0),
  longitude: doublePrecision("longitude").notNull().default(0),
  status: text("status").notNull().default("untouched"),
  notes: text("notes").notNull().default(""),
  tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`),
  followUpDate: text("follow_up_date"),
  appointmentDate: text("appointment_date"),
  knockedAt: text("knocked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orgUnits = pgTable("org_units", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull().default("team"), // region, area, team
  parentId: varchar("parent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const territories = pgTable("territories", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  color: text("color").notNull(),
  points: jsonb("points").notNull().default(sql`'[]'::jsonb`),
  assignedRep: text("assigned_rep").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  fullName: true,
  role: true,
  managerId: true,
  orgUnitId: true,
  shopifyStaffName: true,
  email: true,
  phone: true,
});

export const insertOrgUnitSchema = createInsertSchema(orgUnits).pick({
  name: true,
  type: true,
  parentId: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertOrgUnit = z.infer<typeof insertOrgUnitSchema>;
export type User = typeof users.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Territory = typeof territories.$inferSelect;
export type OrgUnit = typeof orgUnits.$inferSelect;
