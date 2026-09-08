"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api-client";
import type { ForexRate } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageLoader } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";

const CURRENCIES = ["USD", "EUR", "GBP", "CNY", "SAR", "AED", "JPY", "INR"];

export default function ForexPage() {
  const [rates, setRates] = useState<ForexRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);

  function fetchRates() {
    api
      .get<ForexRate[]>("/forex")
      .then((res) => setRates((res.data ?? []) as ForexRate[]))
      .catch(() => setRates([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchRates();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/forex", {
        currency,
        exchange_rate_to_etb: Number(exchangeRate),
        effective_date: effectiveDate,
      });
      setShowForm(false);
      setExchangeRate("");
      fetchRates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoader label="Loading forex rates..." />;

  return (
    <RequireAuth roles={["TARIFF_SPECIALIST", "SUPER_ADMIN"]}>
      <AppShell>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Forex Rates</h1>
              <p className="text-sm text-gray-500">Manage exchange rates to ETB</p>
            </div>
            <Button onClick={() => { setShowForm(!showForm); setError(""); }}>
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? "Cancel" : "Set Rate"}
            </Button>
          </div>

          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>Set Exchange Rate</CardTitle>
              </CardHeader>
              <CardContent>
                {error && (
                  <Alert tone="error" className="mb-4">
                    {error}
                  </Alert>
                )}
                <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="rate">Exchange Rate to ETB</Label>
                    <Input
                      id="rate"
                      type="number"
                      step="0.0001"
                      min="0"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(e.target.value)}
                      required
                      placeholder="e.g. 56.25"
                    />
                  </div>
                  <div>
                    <Label htmlFor="date">Effective Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="sm:col-span-3 flex justify-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving..." : "Save Rate"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Rate History ({rates.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="-mx-5 overflow-x-auto px-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                      <th className="py-2 pr-4">Currency</th>
                      <th className="py-2 pr-4 text-right">Rate to ETB</th>
                      <th className="py-2 pr-4">Effective Date</th>
                      <th className="py-2">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map((r) => (
                      <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="py-3 pr-4 font-medium text-gray-900">{r.currency}</td>
                        <td className="py-3 pr-4 text-right font-mono text-gray-700">{r.exchange_rate_to_etb}</td>
                        <td className="py-3 pr-4 text-gray-500">{new Date(r.effective_date).toLocaleDateString("en-ET")}</td>
                        <td className="py-3 text-gray-500">{r.source ?? "—"}</td>
                      </tr>
                    ))}
                    {rates.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-sm text-gray-500">
                          No forex rates configured yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
