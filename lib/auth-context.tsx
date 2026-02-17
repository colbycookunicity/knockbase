import React, { createContext, useContext, useMemo, useCallback, ReactNode } from "react";
import { apiRequest, getQueryFn, queryClient } from "./query-client";
import { useQuery, useMutation } from "@tanstack/react-query";

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: "owner" | "admin" | "rep";
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
  isOwner: boolean;
  isAdmin: boolean;
  canManageUsers: boolean;
  login: (email: string, password: string) => Promise<User>;
  requestOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<User>;
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
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      const data = await res.json();
      return data.user as User;
    },
    onSuccess: (userData) => {
      queryClient.setQueryData(["/api/auth/me"], userData);
    },
  });

  const requestOtpMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      await apiRequest("POST", "/api/auth/otp/request", { email });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      const res = await apiRequest("POST", "/api/auth/otp/verify", { email, code });
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

  const login = useCallback(async (email: string, password: string) => {
    return loginMutation.mutateAsync({ email, password });
  }, []);

  const requestOtp = useCallback(async (email: string) => {
    return requestOtpMutation.mutateAsync({ email });
  }, []);

  const verifyOtp = useCallback(async (email: string, code: string) => {
    return verifyOtpMutation.mutateAsync({ email, code });
  }, []);

  const logout = useCallback(async () => {
    return logoutMutation.mutateAsync();
  }, []);

  const value = useMemo(
    () => ({
      user: user ?? null,
      isLoading,
      isAuthenticated: !!user,
      isOwner: user?.role === "owner",
      isAdmin: user?.role === "admin",
      canManageUsers: user?.role === "owner" || user?.role === "admin",
      login,
      requestOtp,
      verifyOtp,
      logout,
    }),
    [user, isLoading, login, requestOtp, verifyOtp, logout]
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
