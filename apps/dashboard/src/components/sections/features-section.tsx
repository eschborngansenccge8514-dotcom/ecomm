// apps/dashboard/src/components/sections/features-section.tsx

const FEATURES = [
  {
    icon: '🏪',
    title: 'Unified POS + Online Store',
    description: 'One inventory. Sell in-store and online simultaneously — no manual syncing ever.',
  },
  {
    icon: '🤖',
    title: 'AI Agent Workforce',
    description: 'Six specialised AI agents handle customer service, inventory, fulfillment, finance, content, and analytics automatically.',
  },
  {
    icon: '📦',
    title: 'Multi-Channel Marketplace',
    description: 'List and sync products to Shopee, Lazada, TikTok Shop, and Google Merchant from one dashboard.',
  },
  {
    icon: '📊',
    title: 'Built-in Accounting',
    description: 'Double-entry accounting with SST compliance, auto-posted from every sale. No separate accounting software needed.',
  },
  {
    icon: '🛵',
    title: 'Smart Fulfillment',
    description: 'Auto-books the cheapest courier via EasyParcel and Lalamove. Customers get real-time tracking.',
  },
  {
    icon: '🧾',
    title: 'MyInvois E-Invoice',
    description: "Fully compliant with Malaysia's mandatory e-invoicing requirement — automated with zero manual work.",
  },
] as const;

export function FeaturesSection() {
  return (
    <section id="features" className="bg-white py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Everything your business needs — nothing it doesn't
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            Stop paying for 6 separate tools. Hyperlocal replaces all of them.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-gray-100 bg-gray-50
                         p-8 transition hover:border-[#01696f]/30 hover:bg-[#01696f]/5"
            >
              <span className="text-4xl" role="img" aria-label={feature.title}>
                {feature.icon}
              </span>
              <h3 className="mt-4 text-xl font-semibold text-gray-900">
                {feature.title}
              </h3>
              <p className="mt-2 text-gray-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
