"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, XCircle, CheckCircle, DollarSign } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/layout/app-shell";
import { api, ApiError } from "@/lib/api-client";
import type { Assessment } from "@/lib/types";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { PageLoader } from "@/components/ui/spinner";
import { formatCurrency, cn } from "@/lib/utils";

const OFFICER_ROLES = ["VALUATION_OFFICER", "TARIFF_SPECIALIST", "SUPER_ADMIN"];

const TAX_ROWS = [
  { key: "total_duty_etb", label: "Customs Duty", color: "bg-blue-500" },
  { key: "total_excise_etb", label: "Excise Tax", color: "bg-purple-500" },
  { key: "total_vat_etb", label: "VAT", color: "bg-violet-500" },
  { key: "total_surtax_etb", label: "Sur-Tax", color: "bg-amber-500" },
  { key: "total_withholding_etb", label: "Withholding", color: "bg-cyan-500" },
  { key: "total_scanning_fee_etb", label: "Scanning Fee", color: "bg-gray-400" },
] as const;

export default function AssessmentDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const id = params.id as string;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("BANK_TRANSFER");
  const [payBankName, setPayBankName] = useState("");
  const [payBankRef, setPayBankRef] = useState("");
  const [showPayForm, setShowPayForm] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get<Assessment>(`/assessments/${id}`)
      .then((res) => setAssessment(res.data ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load assessment"))
      .finally(() => setLoading(false));
  }, [id]);

  const isOfficer = user && OFFICER_ROLES.includes(user.role);
  const isImporter = user?.role === "IMPORTER";

  async function handleAction(endpoint: string, body?: unknown) {
    setActionLoading(true);
    setActionError(null);
    try {
      await api.post(endpoint, body);
      const res = await api.get<Assessment>(`/assessments/${id}`);
      setAssessment(res.data ?? null);
      setError(null);
      setShowRejectForm(false);
      setRejectReason("");
      setShowPayForm(false);
      setPayAmount("");
      setPayBankName("");
      setPayBankRef("");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <RequireAuth><AppShell><PageLoader label="Loading assessment..." /></AppShell></RequireAuth>;
  if (error || !assessment) {
    return (
      <RequireAuth>
        <AppShell>
          <Alert tone="error" title="Error">{error ?? "Assessment not found"}</Alert>
        </AppShell>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Link href="/assessments" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100">
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{assessment.assessment_number}</h1>
                <StatusBadge status={assessment.status} />
              </div>
            </div>
          </div>

          {actionError ? (
            <Alert tone="error" title="Action failed">{actionError}</Alert>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-5">
            <div className="space-y-6 lg:col-span-3">
              <Card>
                <CardHeader>
                  <CardTitle>Declaration Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div>
                      <dt className="text-gray-500">Declarant Name</dt>
                      <dd className="font-medium text-gray-900">{assessment.declarant_name}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">TIN</dt>
                      <dd className="font-medium text-gray-900">{assessment.declarant_tin}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Branch</dt>
                      <dd className="font-medium text-gray-900">{assessment.branch_id}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Currency / Rate</dt>
                      <dd className="font-medium text-gray-900">{assessment.currency} @ {assessment.exchange_rate_applied}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Exemption Type</dt>
                      <dd className="font-medium text-gray-900">{assessment.exemption_type.replaceAll("_", " ")}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Total CIF (ETB)</dt>
                      <dd className="font-medium text-gray-900">{formatCurrency(assessment.total_cif_etb)}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {assessment.items && assessment.items.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="-mx-5 overflow-x-auto px-5">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                            <th className="py-2 pr-3">#</th>
                            <th className="py-2 pr-3">HS Code</th>
                            <th className="py-2 pr-3">Description</th>
                            <th className="py-2 pr-3 text-right">Qty</th>
                            <th className="py-2 pr-3 text-right">Unit Price</th>
                            <th className="py-2 pr-3 text-right">CIF ETB</th>
                            <th className="py-2 pr-3 text-right">Duty</th>
                            <th className="py-2 pr-3 text-right">Excise</th>
                            <th className="py-2 pr-3 text-right">VAT</th>
                            <th className="py-2 pr-3 text-right">Surtax</th>
                            <th className="py-2 pr-3 text-right">WHT</th>
                            <th className="py-2 text-right">Total Tax</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assessment.items.map((item) => (
                            <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                              <td className="py-2.5 pr-3 text-gray-500">{item.line_number}</td>
                              <td className="py-2.5 pr-3 font-medium text-gray-900">{item.hs_code_id}</td>
                              <td className="py-2.5 pr-3 text-gray-700">{item.item_description}</td>
                              <td className="py-2.5 pr-3 text-right text-gray-700">{item.quantity}</td>
                              <td className="py-2.5 pr-3 text-right text-gray-700">{formatCurrency(item.unit_price_foreign)}</td>
                              <td className="py-2.5 pr-3 text-right font-medium text-gray-900">{formatCurrency(item.cif_etb)}</td>
                              <td className="py-2.5 pr-3 text-right text-gray-700">{formatCurrency(item.duty_amount)}</td>
                              <td className="py-2.5 pr-3 text-right text-gray-700">{formatCurrency(item.excise_amount)}</td>
                              <td className="py-2.5 pr-3 text-right text-gray-700">{formatCurrency(item.vat_amount)}</td>
                              <td className="py-2.5 pr-3 text-right text-gray-700">{formatCurrency(item.surtax_amount)}</td>
                              <td className="py-2.5 pr-3 text-right text-gray-700">{formatCurrency(item.withholding_amount)}</td>
                              <td className="py-2.5 text-right font-medium text-gray-900">{formatCurrency(item.total_item_tax_etb)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Tax Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {TAX_ROWS.map((row) => {
                    const value = (assessment[row.key as keyof Assessment] as number) ?? 0;
                    const total = assessment.total_payable_etb || 1;
                    return (
                      <div key={row.key}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-gray-600">{row.label}</span>
                          <span className="font-medium text-gray-900">{formatCurrency(value)}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={cn("h-full rounded-full transition-all duration-300", row.color)}
                            style={{ width: `${Math.min((value / total) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  <div className="border-t border-gray-200 pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">Total Payable</span>
                      <span className="text-lg font-bold text-blue-700">{formatCurrency(assessment.total_payable_etb)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Total Paid</span>
                      <span className="font-medium text-emerald-700">{formatCurrency(assessment.total_paid_etb)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Remaining Balance</span>
                      <span className="font-medium text-gray-900">{formatCurrency(assessment.remaining_balance_etb)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Dates</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Created</dt>
                      <dd className="text-gray-900">{new Date(assessment.created_at).toLocaleString("en-ET")}</dd>
                    </div>
                    {assessment.submitted_at ? (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Submitted</dt>
                        <dd className="text-gray-900">{new Date(assessment.submitted_at).toLocaleString("en-ET")}</dd>
                      </div>
                    ) : null}
                    {assessment.reviewed_at ? (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Reviewed</dt>
                        <dd className="text-gray-900">{new Date(assessment.reviewed_at).toLocaleString("en-ET")}</dd>
                      </div>
                    ) : null}
                  </dl>
                </CardContent>
              </Card>

              {isOfficer && assessment.status === "SUBMITTED" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Review Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-3">
                      <Button
                        variant="success"
                        disabled={actionLoading}
                        onClick={() => handleAction(`/assessments/${id}/approve`)}
                      >
                        <CheckCircle className="h-4 w-4" aria-hidden /> Approve
                      </Button>
                      <Button
                        variant="danger"
                        disabled={actionLoading}
                        onClick={() => setShowRejectForm(!showRejectForm)}
                      >
                        <XCircle className="h-4 w-4" aria-hidden /> Reject
                      </Button>
                    </div>
                    {showRejectForm ? (
                      <div className="space-y-3 rounded-lg border border-red-200 bg-red-50/50 p-3">
                        <Label htmlFor="reject-reason">Rejection Reason</Label>
                        <Textarea
                          id="reject-reason"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Provide a reason for rejection..."
                          rows={3}
                        />
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={actionLoading || !rejectReason.trim()}
                          onClick={() => handleAction(`/assessments/${id}/reject`, { reason: rejectReason })}
                        >
                          Confirm Rejection
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}

              {isOfficer && assessment.status === "APPROVED" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Record Payment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!showPayForm ? (
                      <Button onClick={() => setShowPayForm(true)}>
                        <DollarSign className="h-4 w-4" aria-hidden /> Mark as Paid
                      </Button>
                    ) : (
                      <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                        <div>
                          <Label htmlFor="pay-amount">Amount (ETB) *</Label>
                          <Input
                            id="pay-amount"
                            type="number"
                            min={0}
                            step="0.01"
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="pay-method">Payment Method *</Label>
                          <Select id="pay-method" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                            <option value="BANK_TRANSFER">Bank Transfer</option>
                            <option value="CASH">Cash</option>
                            <option value="MOBILE_MONEY">Mobile Money</option>
                            <option value="CHEQUE">Cheque</option>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="pay-bank">Bank Name</Label>
                          <Input id="pay-bank" value={payBankName} onChange={(e) => setPayBankName(e.target.value)} />
                        </div>
                        <div>
                          <Label htmlFor="pay-ref">Bank Reference</Label>
                          <Input id="pay-ref" value={payBankRef} onChange={(e) => setPayBankRef(e.target.value)} />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            disabled={actionLoading || !payAmount}
                            onClick={() =>
                              handleAction(`/assessments/${id}/pay`, {
                                amount_etb: parseFloat(payAmount) || 0,
                                payment_method: payMethod,
                                bank_name: payBankName || undefined,
                                bank_reference: payBankRef || undefined,
                              })
                            }
                          >
                            Confirm Payment
                          </Button>
                          <Button variant="outline" onClick={() => setShowPayForm(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : null}

              {isImporter && assessment.status === "DRAFT" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      onClick={() => handleAction(`/assessments/${id}/submit`)}
                      disabled={actionLoading}
                    >
                      <Send className="h-4 w-4" aria-hidden /> Submit for Review
                    </Button>
                    <Button
                      variant="outline"
                      disabled={actionLoading}
                      onClick={() => {
                        if (window.confirm("Are you sure you want to cancel this assessment?")) {
                          handleAction(`/assessments/${id}/cancel`);
                        }
                      }}
                    >
                      <XCircle className="h-4 w-4" aria-hidden /> Cancel Assessment
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              {isImporter && assessment.status === "SUBMITTED" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      disabled={actionLoading}
                      onClick={() => {
                        if (window.confirm("Are you sure you want to cancel this assessment?")) {
                          handleAction(`/assessments/${id}/cancel`);
                        }
                      }}
                    >
                      <XCircle className="h-4 w-4" aria-hidden /> Cancel Assessment
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
