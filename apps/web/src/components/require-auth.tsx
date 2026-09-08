"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { PageLoader } from "@/components/ui/spinner";

export function RequireAuth({ roles, children, label }: { roles?: string[]; children: ReactNode; label?: string }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (roles && !roles.includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [loading, user, roles, router]);

  if (loading || !user) return <PageLoader label={label ?? "Checking your session..."} />;
  if (roles && !roles.includes(user.role)) return <PageLoader label="Redirecting..." />;
  return <>{children}</>;
}