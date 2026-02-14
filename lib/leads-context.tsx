import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { Lead, LeadStatus } from "./types";
import * as Storage from "./storage";

interface LeadsContextValue {
  leads: Lead[];
  isLoading: boolean;
  addLead: (lead: Omit<Lead, "id" | "createdAt" | "updatedAt">) => Promise<Lead>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  dispositionLead: (id: string, status: LeadStatus, notes?: string) => Promise<void>;
  refreshLeads: () => Promise<void>;
}

const LeadsContext = createContext<LeadsContextValue | null>(null);

export function LeadsProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshLeads = useCallback(async () => {
    const data = await Storage.getLeads();
    setLeads(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshLeads();
  }, [refreshLeads]);

  const addLead = useCallback(async (lead: Omit<Lead, "id" | "createdAt" | "updatedAt">) => {
    const newLead = await Storage.saveLead(lead);
    setLeads((prev) => [...prev, newLead]);
    return newLead;
  }, []);

  const updateLead = useCallback(async (id: string, updates: Partial<Lead>) => {
    await Storage.updateLead(id, updates);
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l))
    );
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    await Storage.deleteLead(id);
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const dispositionLead = useCallback(
    async (id: string, status: LeadStatus, notes?: string) => {
      const updates: Partial<Lead> = {
        status,
        knockedAt: new Date().toISOString(),
      };
      if (notes !== undefined) {
        updates.notes = notes;
      }
      await Storage.updateLead(id, updates);
      setLeads((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l
        )
      );
    },
    []
  );

  const value = useMemo(
    () => ({ leads, isLoading, addLead, updateLead, deleteLead, dispositionLead, refreshLeads }),
    [leads, isLoading, addLead, updateLead, deleteLead, dispositionLead, refreshLeads]
  );

  return <LeadsContext.Provider value={value}>{children}</LeadsContext.Provider>;
}

export function useLeads() {
  const context = useContext(LeadsContext);
  if (!context) {
    throw new Error("useLeads must be used within a LeadsProvider");
  }
  return context;
}
