"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Archive, X } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api-client";
import type { HsCode } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";

const defaultForm = {
  code: "",
  description_en: "",
  unit_of_measurement: "PCS",
  duty_rate: 0,
  excise_rate: 0,
  vat_rate: 15,
  surtax_rate: 10,
  withholding_rate: 3,
  is_active: true,
  is_capital_goods: false,
  is_raw_material: false,
};

export default function HsCodesPage() {
  const [codes, setCodes] = useState<HsCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<HsCode | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  function fetchCodes() {
    api
      .get<HsCode[]>("/hs-codes")
      .then((res) => setCodes((res.data ?? []) as HsCode[]))
      .catch(() => setCodes([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchCodes();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(defaultForm);
    setShowForm(true);
    setError("");
  }

  function openEdit(c: HsCode) {
    setEditing(c);
    setForm({
      code: c.code,
      description_en: c.description_en,
      unit_of_measurement: c.unit_of_measurement,
      duty_rate: c.duty_rate,
      excise_rate: c.excise_rate,
      vat_rate: c.vat_rate,
      surtax_rate: c.surtax_rate,
      withholding_rate: c.withholding_rate,
      is_active: c.is_active,
      is_capital_goods: c.is_capital_goods,
      is_raw_material: c.is_raw_material,
    });
    setShowForm(true);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await api.put(`/hs-codes/${editing.id}`, form);
      } else {
        await api.post("/hs-codes", form);
      }
      setShowForm(false);
      fetchCodes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(c: HsCode) {
    if (!confirm(`Archive HS code ${c.code}?`)) return;
    try {
      await api.delete(`/hs-codes/${c.id}`);
      fetchCodes();
    } catch {
      // silently ignore
    }
  }

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const filtered = codes.filter(
    (c) =>
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.description_en.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <PageLoader label="Loading HS codes..." />;

  return (
    <RequireAuth roles={["TARIFF_SPECIALIST", "SUPER_ADMIN"]}>
      <AppShell>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">HS Codes</h1>
              <p className="text-sm text-gray-500">Manage tariff classifications</p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden /> Create HS Code
            </Button>
          </div>

          {showForm && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{editing ? "Edit HS Code" : "Create HS Code"}</CardTitle>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </CardHeader>
              <CardContent>
                {error && (
                  <Alert tone="error" className="mb-4">
                    {error}
                  </Alert>
                )}
                <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label htmlFor="code">Code (XXXX.XX.XX)</Label>
                    <Input id="code" value={form.code} onChange={(e) => updateField("code", e.target.value)} required pattern="\d{4}\.\d{2}\.\d{2}" placeholder="0101.21.00" />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-2">
                    <Label htmlFor="description_en">Description</Label>
                    <Input id="description_en" value={form.description_en} onChange={(e) => updateField("description_en", e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="unit">Unit of Measurement</Label>
                    <Input id="unit" value={form.unit_of_measurement} onChange={(e) => updateField("unit_of_measurement", e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="duty_rate">Duty Rate (%)</Label>
                    <Input id="duty_rate" type="number" step="0.01" min="0" value={form.duty_rate} onChange={(e) => updateField("duty_rate", Number(e.target.value))} required />
                  </div>
                  <div>
                    <Label htmlFor="excise_rate">Excise Rate (%)</Label>
                    <Input id="excise_rate" type="number" step="0.01" min="0" value={form.excise_rate} onChange={(e) => updateField("excise_rate", Number(e.target.value))} required />
                  </div>
                  <div>
                    <Label htmlFor="vat_rate">VAT Rate (%)</Label>
                    <Input id="vat_rate" type="number" step="0.01" min="0" value={form.vat_rate} onChange={(e) => updateField("vat_rate", Number(e.target.value))} required />
                  </div>
                  <div>
                    <Label htmlFor="surtax_rate">Surtax Rate (%)</Label>
                    <Input id="surtax_rate" type="number" step="0.01" min="0" value={form.surtax_rate} onChange={(e) => updateField("surtax_rate", Number(e.target.value))} required />
                  </div>
                  <div>
                    <Label htmlFor="withholding_rate">Withholding Rate (%)</Label>
                    <Input id="withholding_rate" type="number" step="0.01" min="0" value={form.withholding_rate} onChange={(e) => updateField("withholding_rate", Number(e.target.value))} required />
                  </div>
                  <div className="flex items-end gap-6">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={form.is_active} onChange={(e) => updateField("is_active", e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                      Active
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={form.is_capital_goods} onChange={(e) => updateField("is_capital_goods", e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                      Capital Goods
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={form.is_raw_material} onChange={(e) => updateField("is_raw_material", e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                      Raw Material
                    </label>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving..." : editing ? "Update" : "Create"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>All HS Codes ({filtered.length})</CardTitle>
              <Input
                placeholder="Search codes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
            </CardHeader>
            <CardContent>
              <div className="-mx-5 overflow-x-auto px-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                      <th className="py-2 pr-4">Code</th>
                      <th className="py-2 pr-4">Description</th>
                      <th className="py-2 pr-4 text-right">Duty %</th>
                      <th className="py-2 pr-4 text-right">Excise %</th>
                      <th className="py-2 pr-4 text-right">VAT %</th>
                      <th className="py-2 pr-4 text-right">Surtax %</th>
                      <th className="py-2 pr-4 text-right">WHT %</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="py-3 pr-4 font-mono font-medium text-gray-900">{c.code}</td>
                        <td className="py-3 pr-4 text-gray-700 max-w-xs truncate">{c.description_en}</td>
                        <td className="py-3 pr-4 text-right text-gray-700">{c.duty_rate}%</td>
                        <td className="py-3 pr-4 text-right text-gray-700">{c.excise_rate}%</td>
                        <td className="py-3 pr-4 text-right text-gray-700">{c.vat_rate}%</td>
                        <td className="py-3 pr-4 text-right text-gray-700">{c.surtax_rate}%</td>
                        <td className="py-3 pr-4 text-right text-gray-700">{c.withholding_rate}%</td>
                        <td className="py-3 pr-4">
                          <Badge tone={c.is_active ? "green" : "gray"}>{c.is_active ? "Active" : "Inactive"}</Badge>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleArchive(c)} title="Archive">
                              <Archive className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-sm text-gray-500">
                          No HS codes found.
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
