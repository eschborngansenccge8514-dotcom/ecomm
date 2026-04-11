import React from 'react';
import Link from 'next/link';
import { 
  Building2, 
  ShoppingBag, 
  Truck, 
  Globe2, 
  Check, 
  ArrowRight,
  TrendingUp,
  Store,
  Briefcase
} from 'lucide-react';
import styles from './solutions.module.css';
import { Copyright } from '@/components/public/Copyright';

export default function SolutionsPage() {
  const solutions = [
    {
      title: 'Enterprise Retail',
      desc: 'Scalable infrastructure for global brands with complex omnichannel requirements.',
      icon: <Building2 size={32} />,
      features: ['Headless Commerce API', 'Multi-tenant Org Architecture', 'Custom ERP Integrations', 'Dedicated Account Support'],
      cta: 'Explore Enterprise'
    },
    {
      title: 'DTC Brands',
      desc: 'Optimized for high-growth digital brands that need speed, scale, and customizability.',
      icon: <ShoppingBag size={32} />,
      features: ['One-tap Checkout', 'Native Loyalty & CRM', 'Global Payment Methods', 'Advanced Analytics'],
      cta: 'Explore DTC'
    },
    {
      title: 'B2B Wholesale',
      desc: 'Modernize your wholesale operations with automated ordering and inventory sync.',
      icon: <Truck size={32} />,
      features: ['Custom Price Lists', 'Bulk Ordering Portals', 'Quote-to-Order Workflow', 'Credit Limit Management'],
      cta: 'Explore B2B'
    },
    {
      title: 'Global Expansion',
      desc: 'Launch into new markets with localized experiences and cross-border logistics.',
      icon: <Globe2 size={32} />,
      features: ['Multi-currency Support', 'Localized Tax Compliance', 'Cross-border Fulfillment', 'GDPR & Privacy Ready'],
      cta: 'Explore Global'
    }
  ];

  return (
    <div className={styles.solutionsContainer}>
      <div className={styles.gridPattern}></div>
      
      <nav className={styles.nav}>
        <Link href="/landing" className="flex items-center gap-3 no-underline">
          <div className="w-9 h-9 bg-gradient-to-br from-[#00e599] to-[#008060] rounded-lg flex items-center justify-center text-black font-extrabold text-lg">M</div>
          <span className="text-white font-extrabold text-xl tracking-tight">MerchantOS</span>
        </Link>
        <div className="hidden md:flex gap-8">
          <Link href="/platform" className="text-zinc-400 hover:text-white transition-colors">Platform</Link>
          <Link href="/solutions" className="text-white font-semibold">Solutions</Link>
          <Link href="/pricing" className="text-zinc-400 hover:text-white transition-colors">Pricing</Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-semibold text-zinc-400 hover:text-white">Log in</Link>
          <Link href="/register" className="bg-[#fb923c] text-black px-5 py-2 rounded-xl font-bold text-sm hover:scale-105 transition-transform">Start trial</Link>
        </div>
      </nav>

      <main>
        <header className={styles.hero}>
          <span className={styles.tag}>Built for your business</span>
          <h1 className={styles.title}>Solutions for every industry</h1>
          <p className={styles.subtitle}>
            Whether you are a global retailer or a fast-growing DTC brand, MerchantOS provides the tools you need to excel in modern commerce.
          </p>
        </header>

        <section className={styles.solutionsGrid}>
          {solutions.map((sol, i) => (
            <div key={i} className={styles.solutionCard}>
              <div className={styles.cardIcon}>{sol.icon}</div>
              <h2 className={styles.cardTitle}>{sol.title}</h2>
              <p className={styles.cardDesc}>{sol.desc}</p>
              <ul className={styles.featuresList}>
                {sol.features.map((feat, idx) => (
                  <li key={idx} className={styles.featureItem}>
                    <Check size={18} className={styles.featureCheck} />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
              <Link href="#" className={styles.ctaLink}>
                {sol.cta} <ArrowRight size={20} />
              </Link>
            </div>
          ))}
        </section>

        <section className="bg-zinc-900/50 py-24 border-t border-b border-white/5">
          <div className="max-w-6xl mx-auto px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-4xl font-bold mb-6">Can't find what you're looking for?</h2>
                <p className="text-zinc-400 text-lg mb-8">
                  Our team specializes in building custom solutions for complex commerce scenarios. Contact us to discuss your specific requirements.
                </p>
                <div className="flex gap-4">
                  <Link href="/register" className="bg-white text-black px-8 py-4 rounded-2xl font-bold text-lg">Contact Sales</Link>
                  <Link href="#" className="border border-white/10 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-white/5 transition-all">Documentation</Link>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: <TrendingUp />, label: 'Marketplaces' },
                  { icon: <Store />, label: 'Pop-up Shops' },
                  { icon: <Briefcase />, label: 'Service Business' },
                  { icon: <ShoppingBag />, label: 'Subscription' }
                ].map((item, i) => (
                  <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center hover:border-orange-500/50 transition-colors">
                    <div className="text-orange-400 mb-3 flex justify-center">{item.icon}</div>
                    <div className="font-bold">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-20 text-center text-zinc-500 border-t border-white/5">
        <Copyright suffix="Tailored for success." />
      </footer>
    </div>
  );
}
