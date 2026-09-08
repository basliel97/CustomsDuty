"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, ClipboardList } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api-client";
import type { Assessment } from "@/lib/types";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { formatCurrency, cn } from "@/lib/utils";

const STATUS_FILTERS = ["ALL", "DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PAID", "CANCELLED"];

export default function AssessmentsPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading assessments..." />}>
      <AssessmentsContent />
    </Suspense>
  );
}

function AssessmentsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentStatus = searchParams.get("status") ?? "ALL";
  const currentPage = Number(searchParams.get("page") ?? "1");

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const canCreate = user && user.role !== "VALUATION_OFFICER" && user.role !== "TARIFF_SPECIALIST";

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (currentStatus !== "ALL") params.set("status", currentStatus);
    if (currentPage > 1) params.set("page", String(currentPage));
    const qs = params.toString();
    api
      .get<Assessment[]>(`/assessments${qs ? `?${qs}` : ""}`)
      .then((res) => {
        setAssessments((res.data ?? []) as Assessment[]);
        setTotalPages(res.meta?.pages ?? 1);
      })
      .catch(() => {
        setAssessments([]);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
  }, [currentStatus, currentPage]);

  function setStatusFilter(status: string) {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    params.set("page", "1");
    router.push(`/assessments?${params.toString()}`);
  }

  function setPage(page: number) {
    const params = new URLSearchParams();
    if (currentStatus !== "ALL") params.set("status", currentStatus);
    params.set("page", String(page));
    router.push(`/assessments?${params.toString()}`);
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
              <p className="text-sm text-gray-500">Manage your customs declarations</p>
            </div>
            {canCreate ? (
              <Link href="/assessments/new">
                <Button>
                  <Plus className="h-4 w-4" aria-hidden /> New Assessment
                </Button>
              </Link>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  currentStatus === s
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {loading ? (
            <PageLoader label="Loading assessments..." />
          ) : assessments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12">
                <ClipboardList className="mb-3 h-10 w-10 text-gray-300" aria-hidden />
                <p className="text-sm text-gray-500">No assessments found.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>
                    {currentStatus === "ALL" ? "All Assessments" : currentStatus.charAt(0) + currentStatus.slice(1).toLowerCase()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>

              {totalPages > 1 ? (
                <div className="flex items-center justify-center gap-1">
                  <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                    Prev
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Button
                      key={p}
                      variant={p === currentPage ? "primary" : "outline"}
                      size="sm"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  ))}
                  <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
                    Next
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
