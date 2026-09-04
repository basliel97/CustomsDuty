export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">CustomsDuty Pro</h1>
            <p className="text-sm text-gray-500">Ethiopian Customs Tax Calculator</p>
          </div>
          <nav className="flex gap-4">
            <a href="/calculator" className="text-sm font-medium text-gray-700 hover:text-gray-900">
              Calculator
            </a>
            <a href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-800">
              Login
            </a>
          </nav>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Ethiopian Customs Duty Calculator
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Calculate customs duties, excise tax, VAT, sur-tax, and withholding tax
            for imports into Ethiopia. Free to use for estimates.
          </p>
          <a
            href="/calculator"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Start Calculating
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <span className="text-blue-600 font-bold">$</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Real-Time Calculation</h3>
            <p className="text-sm text-gray-600">
              Get instant tax breakdowns based on current NBE exchange rates and HS code tariff schedules.
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <span className="text-green-600 font-bold">%</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Cascading Tax Engine</h3>
            <p className="text-sm text-gray-600">
              Accurate Ethiopian customs math: CIF, Duty, Excise, VAT, Sur-Tax, and Withholding.
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <span className="text-purple-600 font-bold">QR</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">QR Verification</h3>
            <p className="text-sm text-gray-600">
              Official assessments include signed QR codes for instant verification at customs gates.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
