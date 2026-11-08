import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";
import type { ExpertMe, PublicSettings, UserOut } from "./types";

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => apiGet<UserOut | null>("/auth/me"), retry: false, staleTime: 60_000 });
}

export function useExpertMe(enabled = true) {
  return useQuery({ queryKey: ["expert-me"], queryFn: () => apiGet<ExpertMe>("/expert/me"), enabled, retry: false });
}

export function usePublicSettings() {
  return useQuery({ queryKey: ["settings-public"], queryFn: () => apiGet<PublicSettings>("/settings/public"), staleTime: 60_000 });
}

export const dashboardPath = (role: UserOut["role"]) => (role === "admin" ? "/admin" : role === "expert" ? "/expert/dashboard" : "/profile");
