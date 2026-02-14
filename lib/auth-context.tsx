import React, { createContext, useContext, useMemo, useCallback, ReactNode } from "react";
import { apiRequest, getQueryFn, queryClient } from "./query-client";
import { useQuery, useMutation } from "@tanstack/react-query";

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: "admin" | "manager" | "sales_rep";
  managerId: string | null;
  email: string;
  phone: string;
  isActive: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isManager: boolean;
  canManageUsers: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: Infinity,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", { username, password });
      const data = await res.json();
      return data.user as User;
    },
    onSuccess: (userData) => {
      queryClient.setQueryData(["/api/auth/me"], userData);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
    },
  });

  const login = useCallback(async (username: string, password: string) => {
    return loginMutation.mutateAsync({ username, password });
  }, []);

  const logout = useCallback(async () => {
    return logoutMutation.mutateAsync();
  }, []);

  const value = useMemo(
    () => ({
      user: user ?? null,
      isLoading,
      isAuthenticated: !!user,
      isAdmin: user?.role === "admin",
      isManager: user?.role === "manager",
      canManageUsers: user?.role === "admin" || user?.role === "manager",
      login,
      logout,
    }),
    [user, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
