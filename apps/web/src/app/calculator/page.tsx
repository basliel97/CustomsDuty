import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { TaxCalculator } from "@/components/calculator/tax-calculator";

export default function CalculatorPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <SiteHeader />
      <main className="flex-1">
        <div className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
            <h1 className="text-2xl font-bold text-gray-900">Import Duty Calculator</h1>
            <p className="mt-1 text-sm text-gray-500">
              Select HS codes, enter item values, and watch the full Ethiopian customs tax breakdown update in real time.
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <TaxCalculator />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}