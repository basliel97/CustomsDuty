"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";

export interface CalcItem {
  hs_code: string;
  description_en: string;
  quantity: string;
  unit_price_foreign: string;
  freight_foreign: string;
  insurance_foreign: string;
}

interface HsSearchResult {
  code: string;
  description_en: string;
  duty_rate: number;
}

interface ForexRate {
  currency: string;
  exchange_rate_to_etb: number;
}

interface CalcSummary {
  totalCifEtb: number;
  totalDutyEtb: number;
  totalExciseEtb: number;
  totalVatEtb: number;
  totalSurtaxEtb: number;
  totalWithholdingEtb: number;
  scanningFee: number;
  grandTotalPayable: number;
}

const EXEMPTIONS = [
  { value: "NONE", label: "None", hint: "Standard commercial import" },
  { value: "DIASPORA", label: "Diaspora", hint: "Duty-eligible up to entitlement for returning citizens" },
  { value: "INVESTMENT", label: "Investment", hint: "Capital goods for licensed investors (EIC approval)" },
  { value: "DIPLOMATIC", label: "Diplomatic", hint: "Diplomatic missions & staff privileges" },
];

function emptyItem(): CalcItem {
  return { hs_code: "", description_en: "", quantity: "1", unit_price_foreign: "", freight_foreign: "0", insurance_foreign: "0" };
}

function toNumber(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function TaxCalculator() {
  const { user } = useAuth();
  const [items, setItems] = useState<CalcItem[]>([emptyItem()]);
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState("");
  const [exemption, setExemption] = useState("NONE");

  const [forexRates, setForexRates] = useState<ForexRate[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<HsSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [summary, setSummary] = useState<CalcSummary | null>(null);
  const [appliedExemption, setAppliedExemption] = useState<string>("");
  const [calcError, setCalcError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api
      .get<ForexRate[]>("/forex")
      .then((res) => {
        const rates = (res.data ?? []) as ForexRate[];
        setForexRates(rates);
        const usd = rates.find((r) => r.currency === "USD");
        if (usd) setExchangeRate(String(usd.exchange_rate_to_etb));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(() => {
      setSearchLoading(true);
      api
        .get<HsSearchResult[]>(`/hs-codes/search?q=${encodeURIComponent(q)}`)
        .then((res) => setSearchResults((res.data ?? []) as HsSearchResult[]))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 250);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery]);

  const payload = useMemo(() => {
    const parsed = items.map((it) => ({
      hs_code: it.hs_code.trim(),
      quantity: toNumber(it.quantity),
      unit_price_foreign: toNumber(it.unit_price_foreign),
      freight_foreign: toNumber(it.freight_foreign),
      insurance_foreign: toNumber(it.insurance_foreign),
    }));
    const rate = toNumber(exchangeRate);
    const validItems = parsed.filter((i) => /^\d{4}\.\d{2}\.\d{2}$/.test(i.hs_code) && i.quantity > 0);
    if (validItems.length === 0 || rate <= 0) return null;
    return { currency, exchange_rate: rate, exemption_type: exemption, items: validItems };
  }, [items, currency, exchangeRate, exemption]);

  const runCalculation = useCallback(() => {
    if (!payload) {
      setSummary(null);
      setCalcError(null);
      return;
    }
    setCalculating(true);
    api
      .post<{ summary: CalcSummary; appliedExemption: string }>("/calculate", payload)
      .then((res) => {
        setSummary(res.data?.summary ?? null);
        setAppliedExemption(res.data?.appliedExemption ?? "");
        setCalcError(null);
      })
      .catch((err) => {
        setSummary(null);
        setCalcError(err instanceof Error ? err.message : "Calculation failed");
      })
      .finally(() => setCalculating(false));
  }, [payload]);

  useEffect(() => {
    if (calcTimer.current) clearTimeout(calcTimer.current);
    calcTimer.current = setTimeout(runCalculation, 300);
    return () => {
      if (calcTimer.current) clearTimeout(calcTimer.current);
    };
  }, [runCalculation]);

  const addHsCode = (code: HsSearchResult) => {
    setItems((prev) => [...prev, { ...emptyItem(), hs_code: code.code, description_en: code.description_en }]);
    setSearchQuery("");
    setSearchOpen(false);
  };

  const updateItem = (index: number, patch: Partial<CalcItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => (prev.length === 1 ? [emptyItem()] : prev.filter((_, i) => i !== index)));
  };

  const pickCurrency = (code: string) => {
    setCurrency(code);
    const rate = forexRates.find((r) => r.currency === code);
    if (rate) setExchangeRate(String(rate.exchange_rate_to_etb));
  };

  const maxByCode = (code: string) => forexRates.find((r) => r.currency === code);

  const breakdown = useMemo(() => {
    if (!summary) return [];
    return [
      { label: "Customs Duty", value: summary.totalDutyEtb, color: "bg-blue-500" },
      { label: "Excise Tax", value: summary.totalExciseEtb, color: "bg-purple-500" },
      { label: "VAT", value: summary.totalVatEtb, color: "bg-violet-500" },
      { label: "Sur-Tax", value: summary.totalSurtaxEtb, color: "bg-amber-500" },
      { label: "Withholding", value: summary.totalWithholdingEtb, color: "bg-cyan-500" },
      { label: "Scanning Fee", value: summary.scanningFee, color: "bg-gray-400" },
    ];
  }, [summary]);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Left column: inputs */}
      <div className="space-y-6 lg:col-span-3">
        <Card>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="hs-search" className="text-base font-semibold">
                Step 1 — Find an HS Code
              </Label>
              <p className="mb-2 text-xs text-gray-500">Search by commodity name or 8-digit HS code, then add an item.</p>
              <div className="relative">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
                  <Input
                    id="hs-search"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                    placeholder="e.g. smartphones, 8517.13.00, laptops..."
                    className="pl-9"
                    autoComplete="off"
                  />
                </div>
                {searchOpen && searchQuery.trim().length >= 2 && (
                  <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {searchLoading ? (
                      <div className="flex items-center justify-center gap-2 px-4 py-3 text-sm text-gray-500">
                        <Spinner className="h-4 w-4" /> Searching...
                      </div>
                    ) : searchResults.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-500">No matching HS codes.</p>
                    ) : (
                      <ul>
                        {searchResults.map((r) => (
                          <li key={r.code}>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                addHsCode(r);
                              }}
                              className="flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left hover:bg-blue-50"
                            >
                              <span>
                                <span className="block text-sm font-medium text-gray-900">{r.code}</span>
                                <span className="block text-xs text-gray-500">{r.description_en}</span>
                              </span>
                              <span className="mt-0.5 whitespace-nowrap text-xs font-medium text-blue-700">Duty {(r.duty_rate * 100).toFixed(0)}%</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label className="mb-2 text-base font-semibold">Step 2 — Item Details</Label>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className={cn("rounded-lg border border-gray-200 p-4", index === items.length - 1 && "border-blue-200 bg-blue-50/40")}>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">Item {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="col-span-2">
                        <Label htmlFor={`hs-${index}`} className="text-xs">
                          HS Code
                        </Label>
                        <Input
                          id={`hs-${index}`}
                          value={item.hs_code}
                          onChange={(e) => updateItem(index, { hs_code: e.target.value })}
                          placeholder="XXXX.XX.XX"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor={`meta-${index}`} className="text-xs">
                          Description
                        </Label>
                        <Input
                          id={`meta-${index}`}
                          value={item.description_en}
                          onChange={(e) => updateItem(index, { description_en: e.target.value })}
                          placeholder="Optional"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`qty-${index}`} className="text-xs">
                          Quantity
                        </Label>
                        <Input
                          id={`qty-${index}`}
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(index, { quantity: e.target.value })}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`price-${index}`} className="text-xs">
                          Unit Price ({currency})
                        </Label>
                        <Input
                          id={`price-${index}`}
                          type="number"
                          min={0}
                          value={item.unit_price_foreign}
                          onChange={(e) => updateItem(index, { unit_price_foreign: e.target.value })}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`freight-${index}`} className="text-xs">
                          Freight ({currency})
                        </Label>
                        <Input
                          id={`freight-${index}`}
                          type="number"
                          min={0}
                          value={item.freight_foreign}
                          onChange={(e) => updateItem(index, { freight_foreign: e.target.value })}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`ins-${index}`} className="text-xs">
                          Insurance ({currency})
                        </Label>
                        <Input
                          id={`ins-${index}`}
                          type="number"
                          min={0}
                          value={item.insurance_foreign}
                          onChange={(e) => updateItem(index, { insurance_foreign: e.target.value })}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, emptyItem()])}>
                  <Plus className="h-4 w-4" aria-hidden /> Add Another Item
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select id="currency" value={currency} onChange={(e) => pickCurrency(e.target.value)}>
                  {forexRates.map((r) => (
                    <option key={r.currency} value={r.currency}>
                      {r.currency} = ETB {formatNumber(r.exchange_rate_to_etb)}
                    </option>
                  ))}
                  {forexRates.length === 0 ? <option value="USD">USD</option> : null}
                </Select>
              </div>
              <div>
                <Label htmlFor="exchange-rate">Exchange Rate (ETB / {currency})</Label>
                <Input id="exchange-rate" type="number" min={0} step="0.0001" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="effective-date">Source</Label>
                <Input id="effective-date" value={maxByCode(currency) ? "NBE" : "Manual"} disabled />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Label className="mb-2 text-base font-semibold">Step 3 — Exemption Type</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {EXEMPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border p-3",
                    exemption === opt.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <input
                    type="radio"
                    name="exemption"
                    value={opt.value}
                    checked={exemption === opt.value}
                    onChange={() => setExemption(opt.value)}
                    className="mt-0.5 h-4 w-4 accent-blue-600"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">{opt.label}</span>
                    <span className="block text-xs text-gray-500">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right column: live breakdown */}
      <div className="lg:col-span-2">
        <div className="sticky top-6 space-y-4">
          <Card>
            <CardContent>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Live Tax Breakdown</h3>
                {calculating ? (
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Spinner className="h-3.5 w-3.5" /> Updating
                  </span>
                ) : null}
              </div>

              {summary ? (
                <div className="space-y-3" aria-live="polite">
                  {breakdown.map((row) => (
                    <div key={row.label}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-gray-600">{row.label}</span>
                        <span className="font-medium text-gray-900">{formatCurrency(row.value)}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={cn("h-full rounded-full transition-all duration-300", row.color)}
                          style={{ width: `${(row.value / summary.grandTotalPayable) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                    <span className="text-sm font-semibold text-gray-900">TOTAL PAYABLE</span>
                    <span className="text-lg font-bold text-blue-700">{formatCurrency(summary.grandTotalPayable)}</span>
                  </div>

                  {appliedExemption && appliedExemption !== "NONE" ? (
                    <p className="rounded-md bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700">
                      Exemption applied: {appliedExemption.replaceAll("_", " ")}
                    </p>
                  ) : (
                    <p className="rounded-md bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                      CIF value {formatCurrency(summary.totalCifEtb)} — all rates applied
                    </p>
                  )}
                </div>
              ) : calcError ? (
                <Alert tone="error" title="Could not calculate">
                  {calcError}
                </Alert>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 px-3 py-8 text-center text-sm text-gray-500">
                  Add an item with an HS code, quantity, and price to see your live estimate.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-2">
            {user ? (
              <Link href="/assessments/new" className="block w-full">
                <Button className="w-full" size="lg">
                  Submit Official Assessment
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/register" className="block w-full">
                  <Button className="w-full" variant="outline" size="md">
                    Create Account to Save &amp; Submit
                  </Button>
                </Link>
                <Link href="/login" className="block w-full">
                  <Button className="w-full" size="md">
                    Sign in to Submit Official Assessment
                  </Button>
                </Link>
              </>
            )}
            <p className="pt-1 text-center text-xs text-gray-400">
              Estimates are indicative until an official assessment is issued by the customs office.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}