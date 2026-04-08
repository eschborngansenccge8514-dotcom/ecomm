import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './landing.module.css';
import { 
  ArrowRight, 
  Monitor, 
  ShoppingBag, 
  Package, 
  Zap, 
  Check,
  BarChart3,
  Globe2,
  Shield,
  Smartphone,
  Cpu,
  LineChart,
  Boxes,
  Users
} from 'lucide-react';

export default function LandingPage() {
  const pillars = [
    {
      title: 'Global Storefronts',
      description: 'Create hyper-optimized, beautiful digital storefronts that convert visitors into loyal customers.',
      icon: <Monitor size={28} strokeWidth={1.5} />,
      tag: 'Build'
    },
    {
      title: 'Omnichannel Sales',
      description: 'One synchronized platform to sell across web, mobile, social, and physical retail locations.',
      icon: <ShoppingBag size={28} strokeWidth={1.5} />,
      tag: 'Sell'
    },
    {
      title: 'Intelligent Operations',
      description: 'Centralize inventory routing, automated fulfillment, and real-time staff management.',
      icon: <Package size={28} strokeWidth={1.5} />,
      tag: 'Manage'
    },
    {
      title: 'Infinite Scale',
      description: 'Enterprise-grade infrastructure designed to seamlessly handle massive traffic spikes.',
      icon: <Zap size={28} strokeWidth={1.5} />,
      tag: 'Grow'
    }
  ];

  const comprehensiveFeatures = [
    { name: 'Native Cloud POS', icon: <Monitor size={18} /> },
    { name: 'Multi-warehouse Sync', icon: <Boxes size={18} /> },
    { name: 'Real-time Analytics', icon: <LineChart size={18} /> },
    { name: 'Global Payments', icon: <Globe2 size={18} /> },
    { name: 'Fraud Protection', icon: <Shield size={18} /> },
    { name: 'Mobile Management', icon: <Smartphone size={18} /> },
    { name: 'AI Recommendations', icon: <Cpu size={18} /> },
    { name: 'CRM & Loyalty', icon: <Users size={18} /> }
  ];

  const logos = [
    'ACME CORP', 'NOVA TECH', 'LUMINA', 'QUANTUM', 'VERTEX', 'NEXUS'
  ];

  return (
    <div className={styles.landingContainer}>
      <header className={styles.glassNav}>
        <div className={styles.navContainer}>
          <Link href="/landing" className={styles.logoWrapper}>
            <div className={styles.logoBox}>M</div>
            <span className={styles.logoText}>MerchantOS</span>
          </Link>
          <div className={styles.navLinks}>
            <Link href="#" className={styles.navLink}>Platform</Link>
            <Link href="#" className={styles.navLink}>Solutions</Link>
            <Link href="#" className={styles.navLink}>Developers</Link>
            <Link href="#" className={styles.navLink}>Pricing</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-semibold text-zinc-300 hover:text-white px-4 transition-colors">Log in</Link>
            <Link href="/register" className={styles.primaryCTA}>Start free trial</Link>
          </div>
        </div>
      </header>

      <main className={styles.content}>
        {/* HERO */}
        <section className={styles.heroSection}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>The operating system for modern commerce</h1>
            <p className={styles.heroSubtitle}>
              Millions of the world's most successful brands trust MerchantOS to sell, ship, and process payments globally. Experience unparalleled speed and control.
            </p>
            <div className={styles.ctaGroup}>
              <Link href="/register" className={styles.primaryCTA}>Start free trial</Link>
              <Link href="#" className={styles.secondaryCTA}>Explore platform <ArrowRight size={18} /></Link>
            </div>
          </div>
          <div className={styles.heroMockupWrapper}>
            <Image 
              src="/dashboard-mockup.png" 
              alt="Dashboard Preview" 
              width={1000} 
              height={700} 
              className={styles.mockupImage}
              priority
            />
          </div>
        </section>

        {/* LOGOS */}
        <section className={styles.trustSection}>
          <div className={styles.logoStrip}>
            {logos.map((logo, i) => (
              <span key={i} className={styles.trustLogo}>{logo}</span>
            ))}
          </div>
        </section>

        {/* PILLARS */}
        <section className={styles.pillarsSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Platform Core</span>
            <h2 className={styles.sectionTitle}>Built for every stage of your business</h2>
          </div>
          <div className={styles.pillarsGrid}>
            {pillars.map((pillar, idx) => (
              <div key={idx} className={styles.pillarCard}>
                <div className={styles.pillarIcon}>{pillar.icon}</div>
                <h3 className={styles.pillarTitle}>{pillar.title}</h3>
                <p className={styles.pillarDesc}>{pillar.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SPLIT FEATURES */}
        <section className={styles.splitFeaturesWrapper}>
          <div className={styles.splitFeature}>
            <div className={styles.splitImageWrapper}>
              <div className="bg-[#0a0a0a] border border-white/10 p-8 rounded-2xl shadow-2xl w-full max-w-md relative z-10">
                <div className="absolute inset-0 bg-gradient-to-br from-[#00e599]/10 to-transparent rounded-2xl pointer-events-none"></div>
                <div className="flex justify-between items-center mb-6 relative z-10">
                  <h4 className="font-bold text-white text-lg">Live Inventory</h4>
                  <span className="text-[#00e599] bg-[#00e599]/10 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-[#00e599]/30">Synced</span>
                </div>
                <div className="space-y-5 relative z-10">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex gap-4 items-center border-b border-white/5 pb-5 last:border-0 last:pb-0">
                      <div className="w-12 h-12 bg-white/5 rounded-xl border border-white/10"></div>
                      <div className="flex-1">
                        <div className="h-2.5 w-24 bg-white/20 rounded mb-2"></div>
                        <div className="h-2 w-16 bg-white/10 rounded"></div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-white">240 unit</div>
                        <div className="text-xs text-zinc-500 mt-1">Updated just now</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <span className={styles.sectionTag}>Command Center</span>
              <h3 className={styles.splitTitle}>Control your entire inventory in real-time</h3>
              <p className={styles.splitDesc}>
                Whether you have one store or a hundred, our global inventory engine keeps your stock levels perfectly in sync across every sales channel.
              </p>
              <ul className="space-y-4 mb-8 text-zinc-300">
                {['Multi-location synchronous tracking', 'Automated ML-driven stock alerts', 'One-click supplier PO generation'].map((item, i) => (
                  <li key={i} className="flex gap-3 items-center font-medium">
                    <div className="bg-[#00e599]/20 p-1 rounded-full">
                      <Check size={16} className="text-[#00e599]" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register" className={styles.primaryCTA}>Explore Inventory</Link>
            </div>
          </div>

          <div className={styles.splitFeature}>
            <div className={styles.splitImageWrapper}>
              <div className="bg-[#0a0a0a] border border-white/10 p-8 rounded-2xl shadow-2xl w-full max-w-md relative z-10">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-2xl pointer-events-none"></div>
                <div className="flex justify-between items-start mb-8 relative z-10">
                  <div>
                    <div className="text-zinc-400 text-sm font-medium mb-1">Total Revenue</div>
                    <h4 className="font-bold text-4xl text-white tracking-tight">$84,200.00</h4>
                  </div>
                  <div className="bg-indigo-500/20 p-3 rounded-xl border border-indigo-500/30">
                    <BarChart3 size={24} className="text-indigo-400" />
                  </div>
                </div>
                <div className="h-40 bg-white/5 rounded-xl border border-white/10 flex items-end gap-3 p-5 relative z-10">
                  {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                    <div key={i} className="relative flex-1 group">
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-black text-xs font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">${h}k</div>
                      <div className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-sm transition-all duration-500 hover:opacity-80" style={{ height: `${h}%` }}></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <span className={styles.sectionTag}>Financial Engine</span>
              <h3 className={styles.splitTitle}>World-class checkout that converts at scale</h3>
              <p className={styles.splitDesc}>
                Offer your customers the fastest, most frictionless checkout experience on the planet. Built for massive volume and microsecond latency.
              </p>
              <ul className="space-y-4 mb-8 text-zinc-300">
                {['Native 130+ currency support', 'Dynamic localized payment methods', 'One-tap Shop Pay enabled'].map((item, i) => (
                  <li key={i} className="flex gap-3 items-center font-medium">
                    <div className="bg-[#00e599]/20 p-1 rounded-full">
                      <Check size={16} className="text-[#00e599]" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register" className={styles.primaryCTA}>Explore Checkout</Link>
            </div>
          </div>
        </section>

        {/* DENSE GRID */}
        <section className={styles.denseSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Ecosystem</span>
            <h2 className={styles.sectionTitle}>Everything else you need to succeed</h2>
          </div>
          <div className={styles.denseGrid}>
            {comprehensiveFeatures.map((feature, i) => (
              <div key={i} className={styles.denseItem}>
                <div className="text-[#00e599] bg-[#00e599]/10 p-2 rounded-lg ring-1 ring-[#00e599]/20">
                  {feature.icon}
                </div>
                {feature.name}
              </div>
            ))}
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className={styles.bottomCTA}>
          <h2 className={styles.bottomCTATitle}>Grow your business with MerchantOS</h2>
          <p className={styles.bottomCTADesc}>
            Join millions of businesses worldwide. Try MerchantOS free for 14 days, no credit card required.
          </p>
          <div className={styles.emailInputWrapper}>
            <input 
              type="email" 
              placeholder="Enter your email address" 
              className={styles.emailInput}
            />
            <button className={`${styles.primaryCTA} py-4 px-8 text-lg`}>Start free trial</button>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className="max-w-xs">
            <Link href="/landing" className={`${styles.logoWrapper} mb-6`}>
              <div className={styles.logoBox}>M</div>
              <span className={styles.logoText}>MerchantOS</span>
            </Link>
            <p className="text-zinc-400 text-sm leading-relaxed mt-4">
              The only platform you need to build, manage, and scale your commerce business globally.
            </p>
          </div>
          <div className={styles.footerLinks}>
            <div className={styles.footerCol}>
              <h4>Company</h4>
              <ul>
                <li><Link href="#">About</Link></li>
                <li><Link href="#">Careers</Link></li>
                <li><Link href="#">Press</Link></li>
                <li><Link href="#">Sustainability</Link></li>
              </ul>
            </div>
            <div className={styles.footerCol}>
              <h4>Products</h4>
              <ul>
                <li><Link href="#">Point of Sale</Link></li>
                <li><Link href="#">Global Payments</Link></li>
                <li><Link href="#">B2B Wholesale</Link></li>
                <li><Link href="#">Checkout</Link></li>
              </ul>
            </div>
            <div className={styles.footerCol}>
              <h4>Developers</h4>
              <ul>
                <li><Link href="#">API Documentation</Link></li>
                <li><Link href="#">Community Forums</Link></li>
                <li><Link href="#">App Marketplace</Link></li>
                <li><Link href="#">Changelog</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <div className={styles.footerBottomLinks}>
            <Link href="#">Terms of Service</Link>
            <Link href="#">Privacy Policy</Link>
            <Link href="#">Sitemap</Link>
          </div>
          <p>© {new Date().getFullYear()} MerchantOS Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
