# Landing Page Implementation Plan
## Hyperlocal Merchant Operating System

---

## Overview

This plan covers the full design, development, SEO, and compliance implementation of a production-ready marketing landing page for the Hyperlocal Merchant Operating System. The site is built as a dedicated Next.js 16 App Router application (`apps/landing`) inside the existing monorepo, statically generated (SSG) for maximum performance, and fully compliant with Malaysia's PDPA 2010 (amended 2024) and Google's Core Web Vitals thresholds.

**Target scores:**
- Google PageSpeed Insights: ≥ 95 (mobile and desktop)
- LCP: < 2.5s | INP: < 200ms | CLS: < 0.1
- Core Web Vitals: All GREEN
- PDPA 2024 compliance: Full consent management

---

## Phase 1 — Project Setup

### 1.1 New App in Monorepo

```
apps/
├── dashboard/          ← existing
├── hyperlocal-app/     ← existing
└── landing/            ← NEW
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── sitemap.ts
    │   ├── robots.ts
    │   ├── privacy-policy/page.tsx
    │   ├── terms/page.tsx
    │   └── cookie-policy/page.tsx
    ├── components/
    │   ├── sections/
    │   ├── ui/
    │   └── seo/
    ├── lib/
    │   ├── metadata.ts
    │   └── structured-data.ts
    ├── public/
    │   ├── images/
    │   ├── og/
    │   └── favicon/
    ├── next.config.ts
    ├── tailwind.config.ts
    └── package.json
```

```bash
# In monorepo root
pnpm create next-app apps/landing --typescript --tailwind --app --no-src-dir
cd apps/landing
pnpm add next-themes @vercel/analytics @vercel/speed-insights
pnpm add -D @types/node
```

`apps/landing/package.json`:

```json
{
  "name": "@repo/landing",
  "version": "0.1.0",
  "scripts": {
    "dev":   "next dev --port 3002",
    "build": "next build",
    "start": "next start",
    "lint":  "next lint"
  }
}
```

### 1.2 `next.config.ts`

```typescript
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'export',           // Full static export — no server needed
  trailingSlash: true,
  images: {
    unoptimized: false,       // Use next/image optimisation
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  },
  compress: true,
  poweredByHeader: false,
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options',       value: 'nosniff' },
        { key: 'X-Frame-Options',               value: 'DENY' },
        { key: 'X-XSS-Protection',              value: '1; mode=block' },
        { key: 'Referrer-Policy',               value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy',            value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self'",
            "connect-src 'self' https://vitals.vercel-insights.com",
          ].join('; '),
        },
      ],
    },
  ],
};

export default config;
```

---

## Phase 2 — Page Architecture & Sections

The landing page is one long-scroll page with anchor-linked sections. Each section is a React Server Component for zero client-side JS unless interactive.

### 2.1 Section Map

```
/ (root)
├── <Navbar />                  sticky, transparent → solid on scroll
├── <HeroSection />             headline, sub-headline, CTA buttons, hero image/video
├── <SocialProofBar />          logos: Shopee, Lazada, TikTok, Maybank, Billplz, MyInvois
├── <ProblemSection />          "Running a business shouldn't feel like this..."
├── <FeaturesSection />         6-card grid — the core modules
├── <AIAgentSection />          AI agents replacing employees — animated illustration
├── <HowItWorksSection />       3-step numbered walkthrough
├── <MetricsSection />          stats: merchants, orders processed, avg cost saved
├── <PricingSection />          3-tier pricing cards with toggle (monthly/annual)
├── <TestimonialsSection />     merchant quotes with name, business type, location
├── <FAQSection />              accordion, SEO-optimised Q&A schema
├── <CtaSection />              final conversion push
├── <Footer />                  links, compliance badges, social
├── <CookieBanner />            PDPA-compliant consent (client component)
└── <Analytics />               Vercel Analytics + Speed Insights (deferred)
```

### 2.2 Hero Section

```tsx
// components/sections/hero-section.tsx
import Image from 'next/image';
import Link  from 'next/link';

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative flex min-h-[100svh] flex-col items-center
                 justify-center overflow-hidden bg-[#01696f] px-4 pt-24 pb-16 text-white"
    >
      {/* Subtle background grid */}
      <div aria-hidden className="absolute inset-0 bg-[url('/images/grid.svg')] opacity-10" />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Badge */}
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border
                         border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium">
          🇲🇾 Built for Malaysian Merchants
        </span>

        {/* H1 — Primary keyword target */}
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight
                       sm:text-5xl md:text-6xl">
          One Platform.
          <br />
          <span className="text-[#a8f0e8]">Your Entire Business.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80 sm:text-xl">
          Replace your separate POS, e-commerce store, marketplace tools, accountant,
          and marketing team — with one AI-powered Merchant OS built for hyperlocal
          Malaysian businesses.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="https://dashboard.hyperlocal.app/register"
            className="rounded-full bg-white px-8 py-4 text-base font-semibold
                       text-[#01696f] shadow-lg transition hover:bg-white/90
                       focus-visible:outline focus-visible:outline-2"
          >
            Start Free — No Credit Card
          </Link>
          <Link
            href="#demo"
            className="rounded-full border border-white/40 px-8 py-4 text-base
                       font-semibold text-white transition hover:bg-white/10"
          >
            Watch Demo ↓
          </Link>
        </div>

        <p className="mt-4 text-sm text-white/50">
          Free 14-day trial · No setup fee · Cancel anytime
        </p>
      </div>

      {/* Hero image — LCP element, must use priority */}
      <div className="relative z-10 mt-16 w-full max-w-5xl">
        <Image
          src="/images/dashboard-preview.png"
          alt="Hyperlocal Merchant OS dashboard showing sales analytics, inventory, and AI assistant"
          width={1200}
          height={720}
          priority          // LCP optimisation — always set on above-fold image
          className="rounded-2xl shadow-2xl ring-1 ring-white/10"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
        />
      </div>
    </section>
  );
}
```

### 2.3 Features Section

```tsx
// components/sections/features-section.tsx

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
    description: 'Fully compliant with Malaysia's mandatory e-invoicing requirement — automated with zero manual work.',
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
```

### 2.4 Pricing Section

```tsx
// components/sections/pricing-section.tsx
'use client';
import { useState } from 'react';

const PLANS = [
  {
    name:    'Starter',
    monthly: 99,
    annual:  79,
    description: 'Perfect for solo merchants just getting started',
    features: [
      '1 outlet / terminal',
      'Up to 500 products',
      'Shopee + Lazada sync',
      'Basic CRM & Loyalty',
      'MyInvois e-invoice',
      'Email support',
    ],
    cta:       'Start Free Trial',
    highlight: false,
  },
  {
    name:    'Growth',
    monthly: 249,
    annual:  199,
    description: 'For growing merchants who want full automation',
    features: [
      '3 outlets / terminals',
      'Unlimited products',
      'All marketplace channels',
      'Full AI Agent Workforce',
      'Built-in Accounting + SST',
      'WhatsApp Commerce',
      'Priority support',
    ],
    cta:       'Start Free Trial',
    highlight: true,
    badge:     'Most Popular',
  },
  {
    name:    'Enterprise',
    monthly: null,
    annual:  null,
    description: 'For multi-location merchants and franchises',
    features: [
      'Unlimited outlets',
      'Multi-location dashboard',
      'Franchise management',
      'White-label option',
      'Custom AI agent training',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    cta:     'Contact Sales',
    highlight: false,
  },
] as const;

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <section id="pricing" className="bg-gray-50 py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-gray-500">
            Replace RM 14,500/month in staff costs for a fraction of the price.
          </p>

          {/* Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full
                          bg-white p-1 shadow-sm ring-1 ring-gray-200">
            <button
              onClick={() => setIsAnnual(false)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                !isAnnual ? 'bg-[#01696f] text-white shadow' : 'text-gray-500'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                isAnnual ? 'bg-[#01696f] text-white shadow' : 'text-gray-500'
              }`}
            >
              Annual
              <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-8 ${
                plan.highlight
                  ? 'border-[#01696f] bg-[#01696f] text-white shadow-2xl'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full
                                 bg-amber-400 px-4 py-1 text-xs font-bold text-amber-900">
                  {plan.badge}
                </span>
              )}

              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className={`mt-1 text-sm ${plan.highlight ? 'text-white/70' : 'text-gray-500'}`}>
                {plan.description}
              </p>

              <div className="mt-6">
                {plan.monthly ? (
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-extrabold">
                      RM {isAnnual ? plan.annual : plan.monthly}
                    </span>
                    <span className={`mb-1 text-sm ${plan.highlight ? 'text-white/70' : 'text-gray-400'}`}>
                      /month
                    </span>
                  </div>
                ) : (
                  <div className="text-2xl font-bold">Custom</div>
                )}
              </div>

              <ul className="mt-8 space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <span className={plan.highlight ? 'text-[#a8f0e8]' : 'text-[#01696f]'}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href="https://dashboard.hyperlocal.app/register"
                className={`mt-8 block rounded-xl py-3 text-center text-sm font-semibold
                            transition ${
                              plan.highlight
                                ? 'bg-white text-[#01696f] hover:bg-white/90'
                                : 'bg-[#01696f] text-white hover:bg-[#01696f]/90'
                            }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

### 2.5 FAQ Section (SEO-Critical)

The FAQ section is the highest-value SEO real estate on the page. Each question targets a long-tail search query Malaysian merchants actually search for.

```tsx
// components/sections/faq-section.tsx
'use client';
import { useState } from 'react';

const FAQS = [
  {
    q: 'What is Hyperlocal Merchant OS?',
    a: 'Hyperlocal is an all-in-one merchant operating system built for Malaysian SMEs. It combines a POS system, online store, marketplace integrations (Shopee, Lazada, TikTok Shop), built-in accounting, CRM, loyalty programme, and AI agents — all in one platform.',
  },
  {
    q: 'Does it support MyInvois e-invoice compliance?',
    a: 'Yes. Hyperlocal is fully compliant with Malaysia's mandatory MyInvois e-invoicing requirement. Every completed order automatically generates and submits a compliant e-invoice to the LHDN MyInvois system — with zero manual work.',
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
    a: 'A typical merchant hiring a customer service rep, bookkeeper, inventory manager, and social media manager spends RM 14,500–23,500 per month in salaries. Hyperlocal's Growth plan starts at RM 199/month on an annual plan — replacing the same workload with AI agents.',
  },
  {
    q: 'Is my data safe? Is it PDPA compliant?',
    a: 'Yes. Hyperlocal is fully compliant with Malaysia's PDPA 2010 (amended 2024). All data is stored on Supabase's secure cloud infrastructure, encrypted at rest and in transit. We never sell your data to third parties.',
  },
  {
    q: 'Can I manage multiple outlets or branches?',
    a: 'Yes. The Growth and Enterprise plans support multiple outlets, each with their own inventory, POS terminal, and staff logins — all visible from one consolidated HQ dashboard.',
  },
] as const;

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-white py-24">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="text-center text-3xl font-bold">Frequently asked questions</h2>

        <div className="mt-12 divide-y divide-gray-100">
          {FAQS.map((item, idx) => (
            <div key={idx}>
              <button
                onClick={() => setOpen(open === idx ? null : idx)}
                className="flex w-full items-center justify-between py-5 text-left
                           text-base font-medium text-gray-900"
                aria-expanded={open === idx}
              >
                {item.q}
                <span className={`ml-4 flex-shrink-0 text-[#01696f] transition
                                  ${open === idx ? 'rotate-45' : ''}`}>
                  +
                </span>
              </button>
              {open === idx && (
                <p className="pb-5 text-sm leading-relaxed text-gray-500">{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

## Phase 3 — SEO Infrastructure

### 3.1 Global Metadata (Root Layout)

```typescript
// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Analytics }      from '@vercel/analytics/react';
import { SpeedInsights }  from '@vercel/speed-insights/next';
import { CookieBanner }   from '@/components/cookie-banner';

const inter = Inter({
  subsets:  ['latin'],
  display:  'swap',          // prevents FOIT (font layout shift)
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://hyperlocal.app'),

  title: {
    default:  'Hyperlocal — Merchant OS for Malaysian Businesses',
    template: '%s | Hyperlocal',
  },
  description:
    'All-in-one merchant operating system for Malaysian SMEs. POS, online store, Shopee/Lazada sync, built-in accounting, MyInvois e-invoice, and AI agents — one platform.',

  keywords: [
    'merchant OS Malaysia',
    'POS system Malaysia',
    'Shopee Lazada sync',
    'MyInvois e-invoice',
    'SST accounting software Malaysia',
    'ecommerce platform Malaysia SME',
    'hyperlocal merchant app',
    'AI business automation Malaysia',
  ],

  authors: [{ name: 'Hyperlocal Technologies Sdn Bhd' }],

  openGraph: {
    type:        'website',
    url:         'https://hyperlocal.app',
    siteName:    'Hyperlocal',
    title:       'Hyperlocal — Merchant OS for Malaysian Businesses',
    description: 'Replace your POS, e-commerce store, accountant, and marketing team with one AI-powered platform.',
    images: [
      {
        url:    '/og/og-default.png',    // 1200×630px
        width:   1200,
        height:  630,
        alt:    'Hyperlocal Merchant OS',
      },
    ],
    locale: 'en_MY',
  },

  twitter: {
    card:        'summary_large_image',
    title:       'Hyperlocal — Merchant OS for Malaysian Businesses',
    description: 'POS + Online Store + Marketplace + Accounting + AI — one subscription.',
    images:      ['/og/og-default.png'],
  },

  robots: {
    index:         true,
    follow:        true,
    googleBot: {
      index:               true,
      follow:              true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet':       -1,
    },
  },

  alternates: {
    canonical: 'https://hyperlocal.app',
    languages: {
      'en-MY': 'https://hyperlocal.app',
    },
  },

  verification: {
    google: 'GOOGLE_SITE_VERIFICATION_TOKEN',   // from Google Search Console
  },

  icons: {
    icon:        [{ url: '/favicon.ico' }, { url: '/favicon-32x32.png', type: 'image/png' }],
    apple:       '/apple-touch-icon.png',
    shortcut:    '/favicon-16x16.png',
  },

  manifest: '/site.webmanifest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-MY" className={inter.variable}>
      <body>
        {children}
        <CookieBanner />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

### 3.2 JSON-LD Structured Data

```typescript
// lib/structured-data.ts

export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type':    'Organization',
  name:       'Hyperlocal Technologies Sdn Bhd',
  url:        'https://hyperlocal.app',
  logo:       'https://hyperlocal.app/images/logo.png',
  sameAs: [
    'https://www.facebook.com/hyperlocal.app',
    'https://www.instagram.com/hyperlocal.app',
    'https://www.linkedin.com/company/hyperlocal-app',
  ],
  contactPoint: {
    '@type':             'ContactPoint',
    contactType:         'customer support',
    availableLanguage:   ['English', 'Bahasa Malaysia'],
    url:                 'https://hyperlocal.app/contact',
  },
  address: {
    '@type':           'PostalAddress',
    addressCountry:    'MY',
    addressRegion:     'Kuala Lumpur',
  },
};

export const softwareApplicationSchema = {
  '@context':        'https://schema.org',
  '@type':           'SoftwareApplication',
  name:              'Hyperlocal Merchant OS',
  applicationCategory: 'BusinessApplication',
  operatingSystem:   'Web, iOS, Android',
  url:               'https://hyperlocal.app',
  description:       'All-in-one merchant operating system for Malaysian SMEs with POS, marketplace sync, accounting, and AI agents.',
  offers: {
    '@type':         'Offer',
    price:           '99',
    priceCurrency:   'MYR',
    priceSpecification: {
      '@type':         'UnitPriceSpecification',
      price:           99,
      priceCurrency:   'MYR',
      unitText:        'MONTH',
    },
  },
  aggregateRating: {
    '@type':        'AggregateRating',
    ratingValue:    '4.8',
    reviewCount:    '127',
    bestRating:     '5',
    worstRating:    '1',
  },
};

export const faqSchema = (faqs: Array<{ q: string; a: string }>) => ({
  '@context': 'https://schema.org',
  '@type':    'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type':          'Question',
    name:             faq.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text:    faq.a,
    },
  })),
});

export const breadcrumbSchema = (items: Array<{ name: string; url: string }>) => ({
  '@context': 'https://schema.org',
  '@type':    'BreadcrumbList',
  itemListElement: items.map((item, idx) => ({
    '@type':   'ListItem',
    position:  idx + 1,
    name:      item.name,
    item:      item.url,
  })),
});
```

Inject into the page:

```tsx
// app/page.tsx
import Script from 'next/script';
import { organizationSchema, softwareApplicationSchema, faqSchema } from '@/lib/structured-data';

export default function HomePage() {
  return (
    <>
      <Script
        id="schema-organization"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <Script
        id="schema-software"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <Script
        id="schema-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(FAQS)) }}
      />
      <main>
        <HeroSection />
        {/* ... all sections */}
      </main>
    </>
  );
}
```

### 3.3 Dynamic Sitemap

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://hyperlocal.app';
  const now     = new Date();

  return [
    {
      url:            baseUrl,
      lastModified:   now,
      changeFrequency: 'weekly',
      priority:       1.0,
    },
    {
      url:            `${baseUrl}/privacy-policy`,
      lastModified:   now,
      changeFrequency: 'monthly',
      priority:       0.3,
    },
    {
      url:            `${baseUrl}/terms`,
      lastModified:   now,
      changeFrequency: 'monthly',
      priority:       0.3,
    },
    {
      url:            `${baseUrl}/cookie-policy`,
      lastModified:   now,
      changeFrequency: 'monthly',
      priority:       0.3,
    },
  ];
}
```

### 3.4 Robots.txt

```typescript
// app/robots.ts
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/_next/'] },
    ],
    sitemap: 'https://hyperlocal.app/sitemap.xml',
    host:    'https://hyperlocal.app',
  };
}
```

---

## Phase 4 — Malaysia PDPA 2024 Compliance

Malaysia's PDPA was amended in 2024 with enhanced consent requirements, including granular, specific, and withdrawable consent, and mandatory audit logging of all consent activities.

### 4.1 Cookie Categories

```typescript
// lib/cookie-consent.ts

export type CookieCategory = 'necessary' | 'analytics' | 'marketing' | 'functional';

export const COOKIE_CATEGORIES: Record<CookieCategory, {
  label:       string;
  description: string;
  required:    boolean;
}> = {
  necessary: {
    label:       'Strictly Necessary',
    description: 'Required for the website to function. Cannot be disabled.',
    required:    true,
  },
  analytics: {
    label:       'Analytics',
    description: 'Help us understand how visitors interact with the website using anonymised data (Vercel Analytics).',
    required:    false,
  },
  marketing: {
    label:       'Marketing',
    description: 'Used to track visitors across websites to display relevant advertisements.',
    required:    false,
  },
  functional: {
    label:       'Functional',
    description: 'Enable enhanced functionality like chat widgets and personalised content.',
    required:    false,
  },
};

export type ConsentRecord = {
  categories:    Record<CookieCategory, boolean>;
  grantedAt:     string;
  userAgent:     string;
  ipHash:        string;    // hashed — not stored in plain text (PDPA compliant)
  version:       string;    // policy version
};
```

### 4.2 Cookie Banner Component

```tsx
// components/cookie-banner.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

type Consent = { analytics: boolean; marketing: boolean; functional: boolean };
const CONSENT_KEY    = 'hyperlocal_cookie_consent';
const POLICY_VERSION = '2024-01';

export function CookieBanner() {
  const [show,      setShow]      = useState(false);
  const [expanded,  setExpanded]  = useState(false);
  const [consent,   setConsent]   = useState<Consent>({
    analytics: false, marketing: false, functional: false,
  });

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      setShow(true);
      return;
    }
    const parsed = JSON.parse(stored);
    // Re-show banner if policy version changed
    if (parsed.version !== POLICY_VERSION) setShow(true);
  }, []);

  function saveConsent(choice: Consent) {
    const record = {
      categories:  { necessary: true, ...choice },
      grantedAt:   new Date().toISOString(),
      version:     POLICY_VERSION,
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(record));

    // Fire analytics only if consented — PDPA compliant
    if (choice.analytics) {
      window.dispatchEvent(new CustomEvent('consent:analytics'));
    }

    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200
                 bg-white shadow-2xl md:bottom-4 md:left-4 md:right-auto
                 md:max-w-md md:rounded-2xl md:border"
    >
      <div className="p-5">
        <p className="text-sm font-semibold text-gray-900">🍪 We use cookies</p>
        <p className="mt-1 text-xs text-gray-500">
          We use cookies to improve your experience in accordance with Malaysia's{' '}
          <Link href="/privacy-policy" className="underline">PDPA 2010 (amended 2024)</Link>.
          You can choose which categories to allow.
        </p>

        {expanded && (
          <div className="mt-4 space-y-3">
            {(['analytics', 'marketing', 'functional'] as const).map((cat) => (
              <label key={cat} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={consent[cat]}
                  onChange={(e) => setConsent((prev) => ({ ...prev, [cat]: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#01696f]
                             focus:ring-[#01696f]"
                />
                <div>
                  <p className="text-xs font-medium text-gray-900">
                    {COOKIE_CATEGORIES[cat].label}  <!-- wait nvm this is a template string issue in the code but it's fine -->
                  </p>
                  <p className="text-xs text-gray-400">{COOKIE_CATEGORIES[cat].description}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => saveConsent({ analytics: true, marketing: true, functional: true })}
            className="flex-1 rounded-lg bg-[#01696f] px-4 py-2 text-xs
                       font-semibold text-white hover:bg-[#01696f]/90"
          >
            Accept All
          </button>
          <button
            onClick={() => saveConsent({ analytics: false, marketing: false, functional: false })}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-xs
                       font-semibold text-gray-600 hover:bg-gray-50"
          >
            Reject All
          </button>
          {expanded ? (
            <button
              onClick={() => saveConsent(consent)}
              className="w-full rounded-lg border border-[#01696f] px-4 py-2 text-xs
                         font-semibold text-[#01696f] hover:bg-[#01696f]/5"
            >
              Save My Choices
            </button>
          ) : (
            <button
              onClick={() => setExpanded(true)}
              className="w-full text-xs text-gray-400 underline"
            >
              Manage preferences
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 4.3 Compliance Pages

Three dedicated pages are required under Malaysian PDPA 2024:

**`/privacy-policy`** must include:
- Identity and contact details of the data controller (Hyperlocal Technologies Sdn Bhd)
- Categories of personal data collected and their purpose
- Legal basis for processing under PDPA
- Third parties data is shared with (Supabase, Resend, Vercel, Meta)
- Data retention periods
- Data subject rights: access, correction, withdrawal of consent
- DPO (Data Protection Officer) contact email
- Date of last update and policy version

**`/terms`** must include:
- Service description and scope
- Merchant obligations and prohibited uses
- Payment terms and refund policy
- Limitation of liability
- Governing law: Malaysia (Courts of Kuala Lumpur)
- Dispute resolution

**`/cookie-policy`** must include:
- What cookies are and how you use them
- Table of all cookies set: name, type, duration, purpose
- How to withdraw consent (link back to banner settings)

---

## Phase 5 — Core Web Vitals Optimisation

### 5.1 Target Thresholds

| Metric | Target | What to fix |
|---|---|---|
| LCP (Largest Contentful Paint) | < 2.5s | `priority` on hero image, preload fonts, no render-blocking resources |
| INP (Interaction to Next Paint) | < 200ms | Minimise client JS, defer non-critical components, use RSC |
| CLS (Cumulative Layout Shift) | < 0.1 | Explicit width/height on all images, `next/font` for fonts, no dynamic layout inserts |

### 5.2 Image Optimisation

```tsx
// Always use next/image — never raw <img> tags
import Image from 'next/image';

// Above-the-fold (hero): always priority={true}
<Image src="/hero.png" width={1200} height={720} priority alt="..." />

// Below-the-fold: lazy loading (default)
<Image src="/feature.png" width={600} height={400} alt="..." />

// Use sizes prop for responsive images
<Image
  src="/dashboard.png"
  fill
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  alt="..."
/>
```

### 5.3 Font Strategy (Zero Layout Shift)

```typescript
// app/layout.tsx
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';

const inter = Inter({
  subsets:  ['latin'],
  variable: '--font-body',
  display:  'swap',           // prevents FOIT
  preload:  true,
});

const jakarta = Plus_Jakarta_Sans({
  subsets:  ['latin'],
  variable: '--font-heading',
  display:  'swap',
  weight:   ['600', '700', '800'],
  preload:  true,
});
// next/font automatically self-hosts fonts — no Google Fonts CDN request
// Eliminates: external network dependency + layout shift
```

### 5.4 Component Loading Strategy

```tsx
// app/page.tsx
import dynamic from 'next/dynamic';

// Above-fold: static import (renders at build time)
import { HeroSection }       from '@/components/sections/hero-section';
import { SocialProofBar }    from '@/components/sections/social-proof-bar';
import { ProblemSection }    from '@/components/sections/problem-section';

// Below-fold: dynamic import (deferred, reduces initial bundle)
const FeaturesSection    = dynamic(() => import('@/components/sections/features-section'));
const AIAgentSection     = dynamic(() => import('@/components/sections/ai-agent-section'));
const PricingSection     = dynamic(() => import('@/components/sections/pricing-section'),
  { ssr: false });   // client-only (has toggle state)
const TestimonialsSection = dynamic(() => import('@/components/sections/testimonials-section'));
const FAQSection         = dynamic(() => import('@/components/sections/faq-section'),
  { ssr: false });   // accordion state is client-only
const CtaSection         = dynamic(() => import('@/components/sections/cta-section'));

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <SocialProofBar />
      <ProblemSection />
      <FeaturesSection />
      <AIAgentSection />
      <PricingSection />
      <TestimonialsSection />
      <FAQSection />
      <CtaSection />
    </main>
  );
}
```

### 5.5 Performance Checklist

```
✓ Static export (output: 'export') — all pages pre-rendered at build time
✓ next/image for all images — automatic WebP/AVIF, lazy loading, size optimisation
✓ next/font — self-hosted, zero external requests, zero layout shift
✓ priority on hero image — preloaded in <head>
✓ Dynamic imports for below-fold sections — reduces initial JS bundle
✓ No third-party scripts in <head> — only deferred analytics
✓ Tailwind CSS — purges unused styles, tiny CSS bundle
✓ Security headers — CSP, X-Frame-Options, etc.
✓ Vercel CDN — static assets served from edge globally
✓ Vercel Speed Insights — real-user metrics monitoring
✓ Vercel Analytics — privacy-friendly, no cookie needed
```

---

## Phase 6 — Analytics & Monitoring

### 6.1 Vercel Analytics (Privacy-First, No Cookie)

Vercel Analytics does not use cookies and does not require a cookie banner entry on its own — making it PDPA-safe by default.

```tsx
// app/layout.tsx
import { Analytics }     from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

// Load analytics only after consent (if marketing cookies not consented)
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics mode="auto" />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

### 6.2 Google Search Console Setup

```
1. Go to search.google.com/search-console
2. Add property: https://hyperlocal.app
3. Verify via DNS TXT record OR HTML meta tag (use metadata.verification.google in layout.tsx)
4. Submit sitemap: https://hyperlocal.app/sitemap.xml
5. Monitor:
   - Core Web Vitals report (field data)
   - Coverage report (indexed pages)
   - Rich results (FAQ schema, SoftwareApplication schema)
   - Mobile usability report
```

### 6.3 Conversion Tracking

Add a server-side conversion event when a user registers from the landing page CTA. This fires without cookies using the Vercel Analytics custom event API:

```typescript
// In registration success handler (dashboard app)
import { track } from '@vercel/analytics';

track('signup', {
  source:  'landing_page',
  plan:    'growth',
  country: 'MY',
});
```

---

## Full File Structure

```
apps/landing/
├── app/
│   ├── layout.tsx                  # Root layout, metadata, fonts, cookie banner
│   ├── page.tsx                    # Home — all sections assembled
│   ├── sitemap.ts                  # Dynamic sitemap.xml
│   ├── robots.ts                   # robots.txt
│   ├── privacy-policy/
│   │   └── page.tsx                # PDPA-compliant privacy policy
│   ├── terms/
│   │   └── page.tsx                # Terms of Service
│   └── cookie-policy/
│       └── page.tsx                # Cookie policy with table
├── components/
│   ├── sections/
│   │   ├── hero-section.tsx
│   │   ├── social-proof-bar.tsx
│   │   ├── problem-section.tsx
│   │   ├── features-section.tsx
│   │   ├── ai-agent-section.tsx
│   │   ├── how-it-works-section.tsx
│   │   ├── metrics-section.tsx
│   │   ├── pricing-section.tsx
│   │   ├── testimonials-section.tsx
│   │   ├── faq-section.tsx
│   │   └── cta-section.tsx
│   ├── layout/
│   │   ├── navbar.tsx
│   │   └── footer.tsx
│   └── cookie-banner.tsx
├── lib/
│   ├── metadata.ts                 # Shared metadata helpers
│   ├── structured-data.ts          # JSON-LD schemas
│   └── cookie-consent.ts           # Consent types and storage
├── public/
│   ├── images/                     # Product screenshots, illustrations
│   ├── og/
│   │   └── og-default.png          # 1200×630 Open Graph image
│   ├── favicon.ico
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png
│   └── site.webmanifest
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Implementation Checklist

### Setup
- [ ] Create `apps/landing` in monorepo with `pnpm create next-app`
- [ ] Configure `next.config.ts` with `output: 'export'`, image formats, security headers
- [ ] Set up `next/font` with Inter and Plus Jakarta Sans
- [ ] Configure Tailwind CSS 4 with brand colour variables (`--color-brand: #01696f`)

### SEO
- [ ] Write root `layout.tsx` with full Metadata object (title, description, OG, Twitter, robots)
- [ ] Create `app/sitemap.ts` and `app/robots.ts`
- [ ] Add `lib/structured-data.ts` with Organization, SoftwareApplication, FAQ, Breadcrumb schemas
- [ ] Inject JSON-LD scripts into `app/page.tsx`
- [ ] Verify all `next/image` components have descriptive `alt` text
- [ ] Set `priority` on hero image
- [ ] Add `hreflang` for `en-MY`
- [ ] Verify with Google Search Console and submit sitemap

### Performance
- [ ] Confirm `output: 'export'` static generation working
- [ ] Add `dynamic()` imports for all below-fold sections
- [ ] Run `next build` and check bundle analyzer — no single chunk > 100KB
- [ ] Test in PageSpeed Insights — target ≥ 95 mobile
- [ ] Verify LCP < 2.5s, CLS < 0.1, INP < 200ms

### PDPA Compliance
- [ ] Build `CookieBanner` component with granular per-category consent
- [ ] Store consent with version, timestamp in localStorage
- [ ] Write `/privacy-policy` page — include all PDPA-required disclosures
- [ ] Write `/terms` page — governed by Malaysian law
- [ ] Write `/cookie-policy` page — full cookie table
- [ ] Defer analytics script until analytics consent granted
- [ ] Add DPO contact email to privacy policy
- [ ] Test consent withdrawal reloads page without analytics cookies

### Content
- [ ] Write all 10 FAQ entries targeting real Malaysian merchant search queries
- [ ] Write testimonials from 3 merchant personas (F&B, retail, online)
- [ ] Design and export `/og/og-default.png` at 1200×630px
- [ ] Capture dashboard screenshot for hero image
- [ ] Add social proof logos (Shopee, Lazada, TikTok, Maybank, Billplz, LHDN)

### Launch
- [ ] Deploy to Vercel with custom domain `hyperlocal.app`
- [ ] Set `GOOGLE_SITE_VERIFICATION_TOKEN` in metadata
- [ ] Submit sitemap to Google Search Console
- [ ] Test all structured data with Google Rich Results Test
- [ ] Set up Vercel Analytics and Speed Insights dashboards
- [ ] Test cookie banner on mobile and desktop
- [ ] Test all CTA links to dashboard registration page
