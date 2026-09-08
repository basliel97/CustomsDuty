"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api-client";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/spinner";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface RevenueRow {
  branch_code: string;
  total_payable: number;
  count: number;
}

interface HsFrequencyRow {
  hs_code: string;
  total_qty: number;
  total_cif: number;
}

interface OfficerRow {
  officer_id: string;
  count: number;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [revenue, setRevenue] = useState<RevenueRow[]>([]);
  const [hsFreq, setHsFreq] = useState<HsFrequencyRow[]>([]);
  const [officers, setOfficers] = useState<OfficerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  useEffect(() => {
    const promises: Promise<unknown>[] = [
      api.get<RevenueRow[]>("/reports/revenue").then((res) => setRevenue((res.data ?? []) as RevenueRow[])).catch(() => setRevenue([])),
      api.get<HsFrequencyRow[]>("/reports/hs-frequency").then((res) => setHsFreq((res.data ?? []) as HsFrequencyRow[])).catch(() => setHsFreq([])),
    ];

    if (isSuperAdmin) {
      promises.push(
        api
          .get<OfficerRow[]>("/reports/officer-performance")
          .then((res) => setOfficers((res.data ?? []) as OfficerRow[]))
          .catch(() => setOfficers([]))
      );
    }

    Promise.all(promises).finally(() => setLoading(false));
  }, [isSuperAdmin]);

  if (loading) return <PageLoader label="Loading reports..." />;

  return (
    <RequireAuth roles={["TARIFF_SPECIALIST", "SUPER_ADMIN"]}>
      <AppShell>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-500">System analytics and insights</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Branch</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="-mx-5 overflow-x-auto px-5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                        <th className="py-2 pr-4">Branch</th>
                        <th className="py-2 pr-4 text-right">Count</th>
                        <th className="py-2 text-right">Total Payable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenue.map((r) => (
                        <tr key={r.branch_code} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="py-3 pr-4 font-medium text-gray-900">{r.branch_code}</td>
                          <td className="py-3 pr-4 text-right text-gray-700">{formatNumber(r.count)}</td>
                          <td className="py-3 text-right font-medium text-gray-900">{formatCurrency(r.total_payable)}</td>
                        </tr>
                      ))}
                      {revenue.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-sm text-gray-500">
                            No revenue data available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>HS Code Frequency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="-mx-5 overflow-x-auto px-5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                        <th className="py-2 pr-4">HS Code</th>
                        <th className="py-2 pr-4 text-right">Quantity</th>
                        <th className="py-2 text-right">Total CIF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hsFreq.map((r) => (
                        <tr key={r.hs_code} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="py-3 pr-4 font-mono font-medium text-gray-900">{r.hs_code}</td>
                          <td className="py-3 pr-4 text-right text-gray-700">{formatNumber(r.total_qty)}</td>
                          <td className="py-3 text-right font-medium text-gray-900">{formatCurrency(r.total_cif)}</td>
                        </tr>
                      ))}
                      {hsFreq.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-sm text-gray-500">
                            No HS frequency data available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {isSuperAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle>Officer Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="-mx-5 overflow-x-auto px-5">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                          <th className="py-2 pr-4">Officer ID</th>
                          <th className="py-2 text-right">Assessments</th>
                        </tr>
                      </thead>
                      <tbody>
                        {officers.map((r) => (
                          <tr key={r.officer_id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                            <td className="py-3 pr-4 font-mono font-medium text-gray-900">{r.officer_id}</td>
                            <td className="py-3 text-right text-gray-700">{formatNumber(r.count)}</td>
                          </tr>
                        ))}
                        {officers.length === 0 && (
                          <tr>
                            <td colSpan={2} className="py-8 text-center text-sm text-gray-500">
                              No officer performance data available.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
