"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Clock4, ShieldAlert, Landmark } from "lucide-react";
import { api } from "@/lib/api-client";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { PageLoader } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface VerifyData {
  valid: boolean;
  status?: string;
  statusLabel?: string;
  color?: string;
  assessmentNumber?: string;
  declarantName?: string;
  declarantTin?: string;
  totalTaxPaid?: number;
  currency?: string;
  approvedAt?: string | null;
  branchLocation?: string | null;
  reason?: string;
}

function maskTin(tin?: string): string {
  if (!tin) return "—";
  if (tin.length <= 4) return "****";
  return `****${tin.slice(-4)}`;
}

export default function VerifyPage() {
  const { hash } = useParams<{ hash: string }>();
  const [data, setData] = useState<VerifyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hash) return;
    api
      .get<VerifyData>(`/verify/${encodeURIComponent(hash)}`)
      .then((res) => setData(res.data ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : "Verification failed"));
  }, [hash]);

  let content = <PageLoader label="Verifying QR code..." />;

  if (error) {
    content = (
      <ResultCard tone="red" icon={<ShieldAlert className="h-12 w-12" aria-hidden />} title="INVALID / NOT FOUND" sub="This QR code could not be verified against the customs system.">
        <p className="text-sm text-gray-600">{error}</p>
      </ResultCard>
    );
  } else if (data) {
    if (data.color === "green") {
      content = (
        <ResultCard tone="green" icon={<CheckCircle2 className="h-12 w-12" aria-hidden />} title="PAID & CLEARED" sub={data.statusLabel ?? "PAID & CLEARED"}>
          <dl className="mt-5 space-y-2 border-t border-emerald-100 pt-4 text-sm">
            <Row label="Assessment No." value={data.assessmentNumber ?? "—"} />
            <Row label="Declarant" value={data.declarantName ?? "—"} />
            <Row label="TIN" value={maskTin(data.declarantTin)} />
            <Row label="Total Tax Paid" value={formatCurrency(data.totalTaxPaid ?? 0, data.currency ?? "ETB")} />
            {data.approvedAt ? <Row label="Approved" value={new Date(data.approvedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} /> : null}
            <Row label="Branch" value={data.branchLocation ?? "—"} />
          </dl>
        </ResultCard>
      );
    } else if (data.color === "yellow") {
      content = (
        <ResultCard tone="yellow" icon={<Clock4 className="h-12 w-12" aria-hidden />} title="UNDER REVIEW" sub={data.statusLabel ?? "APPROVED - PENDING PAYMENT"}>
          <dl className="mt-5 space-y-2 border-t border-amber-100 pt-4 text-sm">
            <Row label="Assessment No." value={data.assessmentNumber ?? "—"} />
            <Row label="Declarant" value={data.declarantName ?? "—"} />
            <Row label="TIN" value={maskTin(data.declarantTin)} />
            <Row label="Total Tax" value={formatCurrency(data.totalTaxPaid ?? 0, data.currency ?? "ETB")} />
          </dl>
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            This assessment is approved but payment has not been confirmed. Clearance may not proceed until payment is completed.
          </p>
        </ResultCard>
      );
    } else {
      content = (
        <ResultCard tone="red" icon={<ShieldAlert className="h-12 w-12" aria-hidden />} title="INVALID / NOT FOUND" sub={data.reason ?? "This QR code is not recognized."}>
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            If this is an official assessment notice, please contact the issuing customs branch.
          </p>
        </ResultCard>
      );
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <SiteHeader />
      <main className="flex flex-1 items-start justify-center px-4 py-14">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-center gap-2 text-gray-400">
            <Landmark className="h-4 w-4" aria-hidden />
            <span className="text-xs font-medium uppercase tracking-wider">Ethiopian Customs Commission — QR Verification</span>
          </div>
          {content}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function ResultCard({ tone, icon, title, sub, children }: { tone: "green" | "yellow" | "red"; icon: React.ReactNode; title: string; sub: string; children: React.ReactNode }) {
  const tones = {
    green: { wrap: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    yellow: { wrap: "border-amber-200 bg-amber-50 text-amber-700" },
    red: { wrap: "border-red-200 bg-red-50 text-red-700" },
  }[tone];

  return (
    <Card className={tones.wrap}>
      <CardContent className="flex flex-col items-center py-10 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white text-current shadow-sm" aria-hidden>
          {icon}
        </div>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm font-medium text-gray-600">{sub}</p>
        <div className="mt-4 w-full">{children}</div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  );
}