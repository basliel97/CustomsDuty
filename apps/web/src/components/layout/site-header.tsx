"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Landmark, Calculator } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Landmark className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-lg font-bold text-gray-900">
            CustomsDuty<span className="text-blue-600">Pro</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-2 md:flex" aria-label="Primary">
          <Link
            href="/calculator"
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              pathname === "/calculator" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Calculator className="h-4 w-4" aria-hidden /> Calculator
            </span>
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  Go to Dashboard
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                Login
              </Link>
              <Link href="/register">
                <Button size="sm">Create Account</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}