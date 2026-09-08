"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api-client";
import type { AuditLog } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/spinner";

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchLogs = useCallback(
    (p: number) => {
      setLoading(true);
      const params = new URLSearchParams({ limit: "50", page: String(p) });
      if (actionFilter) params.set("action", actionFilter);
      if (entityFilter) params.set("entity", entityFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      api
        .get<AuditLog[]>(`/audit?${params.toString()}`)
        .then((res) => {
          setLogs((res.data ?? []) as AuditLog[]);
          setTotalPages(res.meta?.pages ?? 1);
        })
        .catch(() => setLogs([]))
        .finally(() => setLoading(false));
    },
    [actionFilter, entityFilter, fromDate, toDate]
  );

  useEffect(() => {
    fetchLogs(page);
  }, [page, fetchLogs]);

  function handleFilterChange() {
    setPage(1);
    fetchLogs(1);
  }

  if (loading && logs.length === 0) return <PageLoader label="Loading audit logs..." />;

  return (
    <RequireAuth roles={["SUPER_ADMIN"]}>
      <AppShell>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
            <p className="text-sm text-gray-500">Track all system activity</p>
          </div>

          <Card>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <Label htmlFor="action">Action</Label>
                  <Input
                    id="action"
                    placeholder="e.g. CREATE"
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="entity">Entity</Label>
                  <Input
                    id="entity"
                    placeholder="e.g. assessment"
                    value={entityFilter}
                    onChange={(e) => setEntityFilter(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="from">From Date</Label>
                  <Input
                    id="from"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="to">To Date</Label>
                  <Input
                    id="to"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleFilterChange} className="w-full">
                    Apply Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Audit Entries</CardTitle>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
            </CardHeader>
            <CardContent>
              <div className="-mx-5 overflow-x-auto px-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                      <th className="py-2 pr-4">Timestamp</th>
                      <th className="py-2 pr-4">User</th>
                      <th className="py-2 pr-4">Action</th>
                      <th className="py-2 pr-4">Entity</th>
                      <th className="py-2 pr-4">Entity ID</th>
                      <th className="py-2">IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString("en-ET")}
                        </td>
                        <td className="py-3 pr-4 font-medium text-gray-900">{log.user_email ?? "—"}</td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-gray-700">{log.entity_name ?? "—"}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-gray-500">{log.entity_id ?? "—"}</td>
                        <td className="py-3 font-mono text-xs text-gray-500">{log.ip_address ?? "—"}</td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-sm text-gray-500">
                          No audit logs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
