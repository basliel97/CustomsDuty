"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/layout/app-shell";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "CNY", "CAD", "INR", "SAR", "TRY", "JPY"];

const EXEMPTION_TYPES = [
  { value: "NONE", label: "None" },
  { value: "DIASPORA", label: "Diaspora" },
  { value: "INVESTMENT", label: "Investment" },
  { value: "DIPLOMATIC", label: "Diplomatic" },
];

interface ItemRow {
  hs_code: string;
  item_description: string;
  quantity: string;
  unit_price_foreign: string;
  freight_foreign: string;
  insurance_foreign: string;
}

function emptyItem(): ItemRow {
  return { hs_code: "", item_description: "", quantity: "1", unit_price_foreign: "", freight_foreign: "0", insurance_foreign: "0" };
}

function toNumber(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export default function NewAssessmentPage() {
  const router = useRouter();

  const [declarantName, setDeclarantName] = useState("");
  const [declarantTin, setDeclarantTin] = useState("");
  const [declarantPhone, setDeclarantPhone] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState("");
  const [exemptionType, setExemptionType] = useState("NONE");
  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ path: (string | number)[]; message: string }[]>([]);

  useEffect(() => {
    api
      .get<{ currency: string; exchange_rate_to_etb: number }[]>("/forex")
      .then((res) => {
        const rates = (res.data ?? []) as { currency: string; exchange_rate_to_etb: number }[];
        const usd = rates.find((r) => r.currency === "USD");
        if (usd) setExchangeRate(String(usd.exchange_rate_to_etb));
      })
      .catch(() => {});
  }, []);

  const updateItem = (index: number, patch: Partial<ItemRow>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => (prev.length <= 1 ? [emptyItem()] : prev.filter((_, i) => i !== index)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, emptyItem()]);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setValidationErrors([]);

    if (declarantTin.length < 10) {
      setValidationErrors([{ path: ["declarant_tin"], message: "TIN must be at least 10 characters" }]);
      return;
    }

    const payload = {
      declarant_name: declarantName,
      declarant_tin: declarantTin,
      declarant_phone: declarantPhone || undefined,
      branch_id: "5a2588a6-e385-450b-982a-6b25d8c9c84e", // default branch for now
      currency,
      exchange_rate_applied: toNumber(exchangeRate),
      exemption_type: exemptionType,
      items: items.map((it) => ({
        hs_code: it.hs_code,
        item_description: it.item_description,
        quantity: toNumber(it.quantity),
        unit_price_foreign: toNumber(it.unit_price_foreign),
        freight_foreign: toNumber(it.freight_foreign),
        insurance_foreign: toNumber(it.insurance_foreign),
      })),
    };

    setSubmitting(true);
    try {
      const res = await api.post<{ id: string }>("/assessments", payload);
      router.push(`/assessments/${res.data!.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues && err.issues.length > 0) {
          setValidationErrors(err.issues);
        } else {
          setError(err.message);
        }
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RequireAuth roles={["IMPORTER"]}>
      <AppShell>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Assessment</h1>
            <p className="text-sm text-gray-500">Create a new customs declaration draft</p>
          </div>

          {error ? (
            <Alert tone="error" title="Submission failed">
              {error}
            </Alert>
          ) : null}

          {validationErrors.length > 0 ? (
            <Alert tone="error" title="Validation errors">
              <ul className="list-disc space-y-0.5 pl-4">
                {validationErrors.map((ve, i) => (
                  <li key={i}>{ve.path.map(String).join(".")}: {ve.message}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Declarant Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="declarant_name">Declarant Name *</Label>
                  <Input id="declarant_name" value={declarantName} onChange={(e) => setDeclarantName(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="declarant_tin">TIN *</Label>
                  <Input id="declarant_tin" value={declarantTin} onChange={(e) => setDeclarantTin(e.target.value)} required minLength={10} />
                </div>
                <div>
                  <Label htmlFor="declarant_phone">Phone</Label>
                  <Input id="declarant_phone" value={declarantPhone} onChange={(e) => setDeclarantPhone(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="exchange_rate">Exchange Rate (ETB / {currency})</Label>
                  <Input id="exchange_rate" type="number" min={0} step="0.0001" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="exemption_type">Exemption Type</Label>
                  <Select id="exemption_type" value={exemptionType} onChange={(e) => setExemptionType(e.target.value)}>
                    {EXEMPTION_TYPES.map((et) => (
                      <option key={et.value} value={et.value}>{et.label}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Items</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4" aria-hidden /> Add Item
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className={cn("rounded-lg border border-gray-200 p-4", index === items.length - 1 && "border-blue-200 bg-blue-50/40")}>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">Item {index + 1}</span>
                    {items.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="col-span-2">
                      <Label htmlFor={`hs-${index}`} className="text-xs">HS Code *</Label>
                      <Input id={`hs-${index}`} value={item.hs_code} onChange={(e) => updateItem(index, { hs_code: e.target.value })} placeholder="XXXX.XX.XX" className="h-9 text-sm" required />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor={`desc-${index}`} className="text-xs">Description *</Label>
                      <Input id={`desc-${index}`} value={item.item_description} onChange={(e) => updateItem(index, { item_description: e.target.value })} className="h-9 text-sm" required />
                    </div>
                    <div>
                      <Label htmlFor={`qty-${index}`} className="text-xs">Quantity *</Label>
                      <Input id={`qty-${index}`} type="number" min={1} value={item.quantity} onChange={(e) => updateItem(index, { quantity: e.target.value })} className="h-9 text-sm" required />
                    </div>
                    <div>
                      <Label htmlFor={`price-${index}`} className="text-xs">Unit Price ({currency}) *</Label>
                      <Input id={`price-${index}`} type="number" min={0} step="0.01" value={item.unit_price_foreign} onChange={(e) => updateItem(index, { unit_price_foreign: e.target.value })} className="h-9 text-sm" required />
                    </div>
                    <div>
                      <Label htmlFor={`freight-${index}`} className="text-xs">Freight ({currency})</Label>
                      <Input id={`freight-${index}`} type="number" min={0} step="0.01" value={item.freight_foreign} onChange={(e) => updateItem(index, { freight_foreign: e.target.value })} className="h-9 text-sm" />
                    </div>
                    <div>
                      <Label htmlFor={`ins-${index}`} className="text-xs">Insurance ({currency})</Label>
                      <Input id={`ins-${index}`} type="number" min={0} step="0.01" value={item.insurance_foreign} onChange={(e) => updateItem(index, { insurance_foreign: e.target.value })} className="h-9 text-sm" />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => router.push("/assessments")}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Draft"}
            </Button>
          </div>
        </form>
      </AppShell>
    </RequireAuth>
  );
}
