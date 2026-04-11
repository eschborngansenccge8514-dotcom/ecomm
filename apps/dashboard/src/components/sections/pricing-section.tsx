// apps/dashboard/src/components/sections/pricing-section.tsx
'use client';
import { useState } from 'react';

interface PricingPlan {
  readonly name: string;
  readonly monthly: number | null;
  readonly annual: number | null;
  readonly description: string;
  readonly features: readonly string[];
  readonly cta: string;
  readonly highlight: boolean;
  readonly badge?: string;
}

const PLANS: readonly PricingPlan[] = [
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
                href="/register"
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
