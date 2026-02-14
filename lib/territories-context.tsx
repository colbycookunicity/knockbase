import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { Territory, Coordinate } from "./types";
import {
  getTerritories,
  saveTerritory as storageSaveTerritory,
  updateTerritory as storageUpdateTerritory,
  deleteTerritory as storageDeleteTerritory,
} from "./storage";

interface TerritoriesContextValue {
  territories: Territory[];
  isLoading: boolean;
  addTerritory: (territory: Omit<Territory, "id" | "createdAt" | "updatedAt">) => Promise<Territory>;
  updateTerritory: (id: string, updates: Partial<Territory>) => Promise<void>;
  removeTerritory: (id: string) => Promise<void>;
  getTerritoryForPoint: (point: Coordinate) => Territory | null;
}

const TerritoriesContext = createContext<TerritoriesContextValue | null>(null);

function pointInPolygon(point: Coordinate, polygon: Coordinate[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].latitude;
    const yi = polygon[i].longitude;
    const xj = polygon[j].latitude;
    const yj = polygon[j].longitude;
    const intersect =
      yi > point.longitude !== yj > point.longitude &&
      point.latitude < ((xj - xi) * (point.longitude - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function TerritoriesProvider({ children }: { children: ReactNode }) {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getTerritories().then((data) => {
      setTerritories(data);
      setIsLoading(false);
    });
  }, []);

  const addTerritory = async (
    territory: Omit<Territory, "id" | "createdAt" | "updatedAt">
  ) => {
    const newTerritory = await storageSaveTerritory(territory);
    setTerritories((prev) => [...prev, newTerritory]);
    return newTerritory;
  };

  const updateTerritory = async (id: string, updates: Partial<Territory>) => {
    await storageUpdateTerritory(id, updates);
    setTerritories((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t))
    );
  };

  const removeTerritory = async (id: string) => {
    await storageDeleteTerritory(id);
    setTerritories((prev) => prev.filter((t) => t.id !== id));
  };

  const getTerritoryForPoint = (point: Coordinate): Territory | null => {
    for (const territory of territories) {
      if (pointInPolygon(point, territory.points)) {
        return territory;
      }
    }
    return null;
  };

  const value = useMemo(
    () => ({
      territories,
      isLoading,
      addTerritory,
      updateTerritory,
      removeTerritory,
      getTerritoryForPoint,
    }),
    [territories, isLoading]
  );

  return (
    <TerritoriesContext.Provider value={value}>{children}</TerritoriesContext.Provider>
  );
}

export function useTerritories() {
  const context = useContext(TerritoriesContext);
  if (!context) {
    throw new Error("useTerritories must be used within a TerritoriesProvider");
  }
  return context;
}
