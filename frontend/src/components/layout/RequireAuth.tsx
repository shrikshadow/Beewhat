import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useMe } from "@/lib/hooks";
import type { Role } from "@/lib/types";
import { PageLoader } from "@/components/common/States";

export default function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { data: me, isLoading, isError } = useMe();
  const loc = useLocation();
  if (isLoading) return <PageLoader />;
  if (isError || !me) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (roles && !roles.includes(me.role)) return <Navigate to="/home" replace />;
  return <>{children}</>;
}
