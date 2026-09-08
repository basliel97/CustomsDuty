"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Clock4, CalendarClock, CircleDollarSign, PiggyBank, ClipboardList, Search } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api-client";
import type { Assessment, DashboardStats } from "@/lib/types";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  tone: string;
}

function StatCard({ label, value, icon: Icon, tone }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-gray-500">{label}</p>
          <p className="truncate text-xl font-bold text-gray-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ImporterDashboard() {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Assessment[]>("/assessments?limit=8")
      .then((res) => setAssessments((res.data ?? []) as Assessment[]))
      .catch(() => setAssessments([]))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const a of assessments) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
    return byStatus;
  }, [assessments]);

  if (loading) return <PageLoader label="Loading your dashboard..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
          <p className="text-sm text-gray-500">Welcome back, {user?.full_name ?? user?.email}</p>
        </div>
        <Link href="/assessments/new">
          <Button>
            <Plus className="h-4 w-4" aria-hidden /> New Assessment
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Drafts" value={formatNumber(counts.DRAFT ?? 0)} icon={ClipboardList} tone="bg-gray-100 text-gray-700" />
        <StatCard label="Submitted" value={formatNumber(counts.SUBMITTED ?? 0)} icon={Clock4} tone="bg-amber-100 text-amber-700" />
        <StatCard label="Approved" value={formatNumber((counts.APPROVED ?? 0) + (counts.PAID ?? 0))} icon={CalendarClock} tone="bg-blue-100 text-blue-700" />
        <StatCard label="Paid" value={formatNumber(counts.PAID ?? 0)} icon={PiggyBank} tone="bg-emerald-100 text-emerald-700" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Assessments</CardTitle>
        </CardHeader>
        <CardContent>
          {assessments.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              You have no assessments yet.{" "}
              <Link href="/assessments/new" className="font-medium text-blue-600 hover:text-blue-800">
                Create your first draft
              </Link>
            </div>
          ) : (
            <Table assessments={assessments} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Table({ assessments }: { assessments: Assessment[] }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
            <th className="py-2 pr-4">Assessment No.</th>
            <th className="py-2 pr-4">Declarant</th>
            <th className="py-2 pr-4">Currency</th>
            <th className="py-2 pr-4 text-right">Total (ETB)</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {assessments.map((a) => (
            <tr key={a.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
              <td className="py-3 pr-4">
                <Link href={`/assessments/${a.id}`} className="font-medium text-blue-600 hover:text-blue-800">
                  {a.assessment_number}
                </Link>
              </td>
              <td className="py-3 pr-4 text-gray-700">{a.declarant_name}</td>
              <td className="py-3 pr-4 text-gray-500">
                {a.currency} @ {a.exchange_rate_applied}
              </td>
              <td className="py-3 pr-4 text-right font-medium text-gray-900">{formatCurrency(a.total_payable_etb)}</td>
              <td className="py-3 pr-4">
                <StatusBadge status={a.status} />
              </td>
              <td className="py-3 text-gray-500">{new Date(a.created_at).toLocaleDateString("en-ET")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StaffDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pending, setPending] = useState<Assessment[]>([]);

  useEffect(() => {
    api
      .get<DashboardStats>("/dashboard/stats")
      .then((res) => setStats(res.data ?? null))
      .catch(() => setStats(null));
    api
      .get<Assessment[]>("/assessments?status=SUBMITTED&limit=5")
      .then((res) => setPending((res.data ?? []) as Assessment[]))
      .catch(() => setPending([]));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500">Live customs activity across all branches</p>
      </div>

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Pending Approval" value={formatNumber(stats.pendingApproval)} icon={Clock4} tone="bg-amber-100 text-amber-700" />
          <StatCard label="Submitted Today" value={formatNumber(stats.submittedToday)} icon={CalendarClock} tone="bg-blue-100 text-blue-700" />
          <StatCard label="Revenue Processed" value={formatCurrency(stats.totalPayableEtb)} icon={CircleDollarSign} tone="bg-violet-100 text-violet-700" />
          <StatCard label="Total Collected" value={formatCurrency(stats.totalCollectedEtb)} icon={PiggyBank} tone="bg-emerald-100 text-emerald-700" />
        </div>
      ) : (
        <PageLoader label="Loading stats..." />
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pending Queue</CardTitle>
            <Link href="/assessments?status=SUBMITTED" className="text-xs font-medium text-blue-600 hover:text-blue-800">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                <Search className="mx-auto mb-2 h-6 w-6 text-gray-300" aria-hidden />
                No pending assessments awaiting review.
              </div>
            ) : (
              <ul className="space-y-3">
                {pending.map((a) => (
                  <li key={a.id}>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3 hover:border-blue-200 hover:bg-blue-50/40">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          <Link href={`/assessments/${a.id}`} className="hover:text-blue-700">
                            {a.assessment_number}
                          </Link>
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {a.declarant_name} · {a.currency} {a.exchange_rate_applied} · {formatCurrency(a.total_payable_etb)}
                        </p>
                      </div>
                      <Link href={`/assessments/${a.id}`} className="shrink-0">
                        <Button variant="outline" size="sm">
                          Review
                        </Button>
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>System Snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                {[
                  ["Total Assessments", formatNumber(stats?.totalAssessments ?? 0)],
                  ["Active HS Codes", formatNumber(stats?.activeHsCodes ?? 0)],
                  ["Active Forex Rates", formatNumber(stats?.activeForexRates ?? 0)],
                  ["Active Users", formatNumber(stats?.activeUsers ?? 0)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="font-semibold text-gray-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          {stats && stats.statusBreakdown.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {stats.statusBreakdown.map((s) => (
                    <li key={s.status} className="flex items-center justify-between text-sm">
                      <StatusBadge status={s.status} />
                      <span className="font-semibold text-gray-900">{s.count}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isImporter = user?.role === "IMPORTER";
  return (
    <RequireAuth>
      <AppShell>{isImporter ? <ImporterDashboard /> : <StaffDashboard />}</AppShell>
    </RequireAuth>
  );
}