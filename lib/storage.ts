import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { Lead, DailyStats, LeadStatus } from "./types";

const LEADS_KEY = "@knockbase_leads";
const STATS_KEY = "@knockbase_stats";

export async function getLeads(): Promise<Lead[]> {
  const data = await AsyncStorage.getItem(LEADS_KEY);
  return data ? JSON.parse(data) : [];
}

export async function saveLead(lead: Omit<Lead, "id" | "createdAt" | "updatedAt">): Promise<Lead> {
  const leads = await getLeads();
  const now = new Date().toISOString();
  const newLead: Lead = {
    ...lead,
    id: Crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  leads.push(newLead);
  await AsyncStorage.setItem(LEADS_KEY, JSON.stringify(leads));
  return newLead;
}

export async function updateLead(id: string, updates: Partial<Lead>): Promise<Lead | null> {
  const leads = await getLeads();
  const index = leads.findIndex((l) => l.id === id);
  if (index === -1) return null;
  leads[index] = {
    ...leads[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(LEADS_KEY, JSON.stringify(leads));
  return leads[index];
}

export async function deleteLead(id: string): Promise<boolean> {
  const leads = await getLeads();
  const filtered = leads.filter((l) => l.id !== id);
  if (filtered.length === leads.length) return false;
  await AsyncStorage.setItem(LEADS_KEY, JSON.stringify(filtered));
  return true;
}

export async function getDailyStats(): Promise<DailyStats[]> {
  const data = await AsyncStorage.getItem(STATS_KEY);
  return data ? JSON.parse(data) : [];
}

export function computeTodayStats(leads: Lead[]): DailyStats {
  const today = new Date().toISOString().split("T")[0];
  const todayLeads = leads.filter((l) => {
    if (!l.knockedAt) return false;
    return l.knockedAt.startsWith(today);
  });

  return {
    date: today,
    doorsKnocked: todayLeads.length,
    contacts: todayLeads.filter((l) =>
      ["callback", "appointment", "sold", "follow_up", "not_interested"].includes(l.status)
    ).length,
    appointments: todayLeads.filter((l) => l.status === "appointment").length,
    sales: todayLeads.filter((l) => l.status === "sold").length,
    notHome: todayLeads.filter((l) => l.status === "not_home").length,
    notInterested: todayLeads.filter((l) => l.status === "not_interested").length,
    callbacks: todayLeads.filter((l) => l.status === "callback").length,
  };
}

export function computeWeekStats(leads: Lead[]): DailyStats {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekLeads = leads.filter((l) => {
    if (!l.knockedAt) return false;
    return new Date(l.knockedAt) >= weekAgo;
  });

  return {
    date: "week",
    doorsKnocked: weekLeads.length,
    contacts: weekLeads.filter((l) =>
      ["callback", "appointment", "sold", "follow_up", "not_interested"].includes(l.status)
    ).length,
    appointments: weekLeads.filter((l) => l.status === "appointment").length,
    sales: weekLeads.filter((l) => l.status === "sold").length,
    notHome: weekLeads.filter((l) => l.status === "not_home").length,
    notInterested: weekLeads.filter((l) => l.status === "not_interested").length,
    callbacks: weekLeads.filter((l) => l.status === "callback").length,
  };
}

export function getStatusCounts(leads: Lead[]): Record<LeadStatus, number> {
  const counts: Record<LeadStatus, number> = {
    untouched: 0,
    not_home: 0,
    not_interested: 0,
    callback: 0,
    appointment: 0,
    sold: 0,
    follow_up: 0,
  };
  leads.forEach((l) => {
    counts[l.status]++;
  });
  return counts;
}
