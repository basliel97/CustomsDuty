import Link from "next/link";
import { Zap, Download, ShieldCheck, Calculator as CalcIcon } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { TaxCalculator } from "@/components/calculator/tax-calculator";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <SiteHeader />

      <main className="flex-1">
        <section className="border-b border-gray-200 bg-gradient-to-b from-blue-50 to-gray-50">
          <div className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6">
            <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Ethiopian Customs Duty <span className="text-blue-600">Calculator</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
              Calculate customs duty, excise, VAT, sur-tax, and withholding for imports into Ethiopia — instantly, against
              current NBE rates and HS code tariff schedules.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a href="#calculator" className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700">
                <CalcIcon className="h-4 w-4" aria-hidden /> Start Calculating
              </a>
              <Link href="/verify/demo" className="inline-flex h-11 items-center rounded-lg border border-gray-300 bg-white px-6 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                QR Lookup
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div id="calculator" className="scroll-mt-24">
            <TaxCalculator />
          </div>
        </section>

        <section className="border-t border-gray-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-3">
            {[
              {
                icon: Zap,
                title: "Real-Time Calculation",
                desc: "Instant tax breakdowns that update as you type, using current NBE daily exchange rates and 8-digit HS code schedules.",
              },
              {
                icon: ShieldCheck,
                title: "Cascading Tax Engine",
                desc: "Accurate Ethiopian customs math in the correct statutory order: CIF, Duty, Excise, VAT, Sur-Tax, and Withholding.",
              },
              {
                icon: Download,
                title: "Official Assessment + QR",
                desc: "Approved assessments carry a signed QR code for instant verification at customs exit gates and bank cashiers.",
              },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-gray-200 bg-gray-50 p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <f.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mb-2 font-semibold text-gray-900">{f.title}</h3>
                <p className="text-sm text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}