import React from 'react';
import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import styles from './pricing.module.css';
import { Copyright } from '@/components/public/Copyright';

export default function PricingPage() {
  const plans = [
    {
      name: 'Starter',
      price: '$29',
      description: 'Perfect for new businesses getting started with global commerce.',
      features: [
        'up to 1,000 monthly orders',
        'Standard Checkout',
        'Direct Bank Transfers',
        'Basic Inventory Tracking',
        '24/7 Email Support',
        '1 Admin Account'
      ],
      cta: 'Start with Starter',
      popular: false
    },
    {
      name: 'Professional',
      price: '$99',
      description: 'Advanced features for growing brands scaling their operations.',
      features: [
        'up to 10,000 monthly orders',
        'Optimized High-Speed Checkout',
        'Multi-currency Support',
        'Advanced Inventory Synced',
        'Priority Phone Support',
        '5 Admin Accounts',
        'API Access'
      ],
      cta: 'Start with Pro',
      popular: true
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      description: 'Custom infrastructure and tailored support for global scale.',
      features: [
        'Unlimited monthly orders',
        'Dedicated Infrastructure',
        'White-labeled Experience',
        'Custom Integrations',
        'Dedicated Account Manager',
        'Unlimited Admin Accounts',
        'SLA Guaranteed'
      ],
      cta: 'Contact Sales',
      popular: false
    }
  ];

  const faqs = [
    {
      q: 'Can I change my plan later?',
      a: 'Yes, you can upgrade or downgrade your plan at any time. If you upgrade, the new rate will be prorated for the remainder of your billing cycle.'
    },
    {
      q: 'Are there any hidden transaction fees?',
      a: 'We believe in transparent pricing. We don\'t charge any hidden fees. Standard payment processing fees from providers like Stripe or PayPal may still apply.'
    },
    {
      q: 'What counts as an order?',
      a: 'An order is any transaction processed through our system, regardless of the sales channel (Online, POS, or API).'
    },
    {
      q: 'Do you offer a free trial?',
      a: 'Absolutely! You can try any of our plans free for 14 days. No credit card is required to start your trial.'
    }
  ];

  return (
    <div className={styles.pricingContainer}>
      <div className={styles.gridPattern}></div>
      <header className="absolute top-0 left-0 right-0 h-20 flex items-center justify-between px-8 md:px-16 z-50">
        <Link href="/landing" className="flex items-center gap-3 no-underline">
          <div className="w-9 h-9 bg-gradient-to-br from-[#00e599] to-[#008060] rounded-lg flex items-center justify-center text-black font-extrabold text-lg shadow-[0_0_15px_rgba(0,229,153,0.3)]">M</div>
          <span className="text-white font-extrabold text-xl tracking-tight">MerchantOS</span>
        </Link>
        <div className="hidden md:flex gap-8">
          <Link href="/platform" className="text-zinc-400 hover:text-white transition-colors">Platform</Link>
          <Link href="/solutions" className="text-zinc-400 hover:text-white transition-colors">Solutions</Link>
          <Link href="/pricing" className="text-white font-semibold">Pricing</Link>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors">Log in</Link>
          <Link href="/register" className="bg-[#00e599] text-black px-5 py-2.5 rounded-xl font-bold text-sm hover:scale-105 transition-transform">Start free trial</Link>
        </div>
      </header>

      <main className={styles.content}>
        <section className={styles.header}>
          <span className={styles.tag}>Flexible Pricing</span>
          <h1 className={styles.title}>Simple plans for every scale</h1>
          <p className={styles.subtitle}>
            Choose the right plan for your business. From early-stage startups to global enterprises, we have you covered.
          </p>
        </section>

        <section className={styles.pricingGrid}>
          {plans.map((plan, i) => (
            <div key={i} className={`${styles.pricingCard} ${plan.popular ? styles.popularCard : ''}`}>
              <div className={styles.cardHeader}>
                <h2 className={plan.popular ? 'text-[#00e599] font-bold text-xl mb-2' : styles.planName}>{plan.name}</h2>
                <div className={styles.price}>
                  <span className={styles.amount}>{plan.price}</span>
                  {plan.price !== 'Custom' && <span className={styles.period}>/mo</span>}
                </div>
                <p className={styles.description}>{plan.description}</p>
              </div>

              <ul className={styles.featuresList}>
                {plan.features.map((feature, idx) => (
                  <li key={idx} className={styles.featureItem}>
                    <Check size={18} className={styles.checkIcon} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link 
                href={plan.name === 'Enterprise' ? '/contact' : '/register'} 
                className={`${styles.ctaButton} ${plan.popular ? styles.primaryButton : styles.secondaryButton}`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </section>

        <section className={styles.faqSection}>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold mb-4">Frequently Asked Questions</h2>
            <p className="text-zinc-400">Everything you need to know about our plans and billing.</p>
          </div>
          <div className={styles.faqGrid}>
            {faqs.map((faq, i) => (
              <div key={i} className={styles.faqItem}>
                <h3>{faq.q}</h3>
                <p>{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-24 p-12 rounded-[32px] bg-gradient-to-br from-indigo-500/10 to-transparent border border-white/5 text-center">
          <h2 className="text-3xl font-bold mb-6">Need a custom solution?</h2>
          <p className="text-zinc-400 mb-8 max-w-2xl mx-auto">
            Our enterprise tea works with the world's largest retailers to build bespoke commerce infrastructure. Let's talk about your requirements.
          </p>
          <Link href="/contact" className="inline-flex items-center gap-2 text-[#00e599] font-bold text-lg hover:gap-4 transition-all">
            Talk to our sales team <ArrowRight size={20} />
          </Link>
        </section>
      </main>

      <footer className="mt-20 border-t border-white/5 py-12 px-8 flex justify-between items-center text-zinc-500 text-sm">
        <Copyright suffix="" />
        <div className="flex gap-8">
          <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
          <Link href="#" className="hover:text-white transition-colors">Terms</Link>
          <Link href="#" className="hover:text-white transition-colors">Status</Link>
        </div>
      </footer>
    </div>
  );
}
