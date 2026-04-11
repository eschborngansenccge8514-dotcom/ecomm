// apps/dashboard/src/lib/landing/constants.ts

export const FAQS = [
  {
    q: 'What is Hyperlocal Merchant OS?',
    a: 'Hyperlocal is an all-in-one merchant operating system built for Malaysian SMEs. It combines a POS system, online store, marketplace integrations (Shopee, Lazada, TikTok Shop), built-in accounting, CRM, loyalty programme, and AI agents — all in one platform.',
  },
  {
    q: 'Does it support MyInvois e-invoice compliance?',
    a: "Yes. Hyperlocal is fully compliant with Malaysia's mandatory MyInvois e-invoicing requirement. Every completed order automatically generates and submits a compliant e-invoice to the LHDN MyInvois system — with zero manual work.",
  },
  {
    q: 'Can I sync my products to Shopee and Lazada automatically?',
    a: 'Yes. Connect your Shopee, Lazada, TikTok Shop, and Google Merchant Center accounts once, and Hyperlocal automatically syncs product listings, prices, and stock levels across all channels in real time.',
  },
  {
    q: 'Does Hyperlocal handle SST (Sales and Service Tax)?',
    a: 'Yes. The built-in accounting module automatically calculates SST on every transaction, posts the correct journal entries, and generates a bi-monthly SST filing summary ready for submission to MyST.',
  },
  {
    q: 'What couriers does it support for delivery?',
    a: 'Hyperlocal integrates with EasyParcel (nationwide) and Lalamove (on-demand, same-day). The system auto-selects the best courier based on parcel weight, destination, and your configured preferences.',
  },
  {
    q: 'Can the AI replace my customer service staff?',
    a: 'The AI Customer Service Agent handles up to 90% of customer queries autonomously — order status, refunds, product questions, loyalty balance — escalating only complex cases to you via push notification for one-tap approval.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes. Every plan comes with a 14-day free trial with no credit card required. You get full access to all features during the trial period.',
  },
  {
    q: 'How much does Hyperlocal cost compared to hiring staff?',
    a: "A typical merchant hiring a customer service rep, bookkeeper, inventory manager, and social media manager spends RM 14,500–23,500 per month in salaries. Hyperlocal's Growth plan starts at RM 199/month on an annual plan — replacing the same workload with AI agents.",
  },
  {
    q: 'Is my data safe? Is it PDPA compliant?',
    a: "Yes. Hyperlocal is fully compliant with Malaysia's PDPA 2010 (amended 2024). All data is stored on Supabase's secure cloud infrastructure, encrypted at rest and in transit. We never sell your data to third parties.",
  },
  {
    q: 'Can I manage multiple outlets or branches?',
    a: 'Yes. The Growth and Enterprise plans support multiple outlets, each with their own inventory, POS terminal, and staff logins — all visible from one consolidated HQ dashboard.',
  },
] as const;
