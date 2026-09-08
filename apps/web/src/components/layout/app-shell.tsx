"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Landmark,
  LayoutDashboard,
  ClipboardList,
  Bell,
  BookOpen,
  Coins,
  Users,
  Database,
  BarChart3,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { NAV_PERMISSIONS, ROLE_LABELS } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const perms = NAV_PERMISSIONS[user.role] ?? NAV_PERMISSIONS.IMPORTER;

  const sections: { title?: string; items: NavItem[] }[] = [
    {
      items: [
        { href: perms.dashboard, label: "Dashboard", icon: LayoutDashboard },
        { href: "/assessments", label: "Assessments", icon: ClipboardList },
        ...(perms.notifications ? [{ href: "/notifications", label: "Notifications", icon: Bell as typeof LayoutDashboard }] : []),
      ],
    },
    {
      title: "Settings",
      items: [
        ...(perms.hsCodes ? [{ href: "/settings/hs-codes", label: "HS Codes", icon: BookOpen as typeof LayoutDashboard }] : []),
        ...(perms.forex ? [{ href: "/settings/forex", label: "Forex Rates", icon: Coins as typeof LayoutDashboard }] : []),
        ...(perms.users ? [{ href: "/settings/users", label: "Users", icon: Users as typeof LayoutDashboard }] : []),
      ],
    },
    {
      title: "Oversight",
      items: [
        ...(perms.audit ? [{ href: "/audit", label: "Audit Logs", icon: Database as typeof LayoutDashboard }] : []),
        ...(perms.reports ? [{ href: "/reports", label: "Reports", icon: BarChart3 as typeof LayoutDashboard }] : []),
      ],
    },
  ];

  const content = (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-gray-100 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Landmark className="h-4 w-4" aria-hidden />
        </span>
        <span className="text-base font-bold text-gray-900">CustomsDutyPro</span>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Sidebar">
        {sections.map((section, i) => (
          <div key={i}>
            {section.title ? <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{section.title}</p> : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                        active ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      )}
                    >
                      <item.icon className="h-4 w-4" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-gray-100 p-3">
        <div className="mb-2 rounded-lg bg-gray-50 px-3 py-2">
          <p className="truncate text-sm font-medium text-gray-900">{user.full_name || user.email}</p>
          <p className="text-xs text-gray-500">{ROLE_LABELS[user.role] ?? user.role}</p>
        </div>
        <button
          onClick={async () => {
            await logout();
            router.push("/");
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="h-4 w-4" aria-hidden /> Logout
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden">
        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <span className="text-sm font-bold text-gray-900">CustomsDutyPro</span>
        <span className="w-9" aria-hidden />
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="relative" onClick={() => setOpen(false)}>
            {content}
          </div>
        </div>
      ) : null}

      <div className="hidden lg:fixed lg:inset-y-0 lg:flex">{content}</div>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}