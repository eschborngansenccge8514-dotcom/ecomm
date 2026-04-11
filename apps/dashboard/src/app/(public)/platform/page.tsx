import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Check, 
  ArrowRight, 
  Globe, 
  ShieldCheck, 
  Zap, 
  Cpu, 
  BarChart3, 
  Layers 
} from 'lucide-react';
import styles from './platform.module.css';
import { Copyright } from '@/components/public/Copyright';

export default function PlatformPage() {
  const sections = [
    {
      title: 'Global Infrastructure',
      tag: 'Global Scale',
      desc: 'Built on a globally distributed network that ensures your store is always live, no matter where your customers are.',
      icon: <Globe size={24} />,
      features: [
        { title: 'Edge Delivery', desc: 'Content delivered from 200+ edge locations globally.' },
        { title: 'Auto-scaling', desc: 'Instantly scale to handle massive flash sale traffic.' },
        { title: '99.99% Uptime', desc: 'Enterprise-grade reliability you can trust.' }
      ],
      image: '/platform-hero.png',
      status: 'NETWORK STATUS: ACTIVE',
      label: 'Global Edge Network'
    },
    {
      title: 'Unified Commerce Engine',
      tag: 'Omnichannel',
      desc: 'Connect every touchpoint of your business into a single source of truth for inventory, orders, and customers.',
      icon: <Layers size={24} />,
      features: [
        { title: 'Real-time Sync', desc: 'Inventory levels stay accurate across all channels.' },
        { title: 'Single Dashboard', desc: 'Manage web, POS, and marketplace from one place.' },
        { title: 'Order Orchestration', desc: 'Automated routing to the best fulfillment center.' }
      ],
      image: '/platform-unified.png',
      status: 'CORE ENGINE: STABLE',
      label: 'Omnichannel Sync'
    },
    {
      title: 'Intelligent Automation',
      tag: 'Efficiency',
      desc: 'Leverage AI to automate repetitive tasks, from restocking alerts to customer support routing.',
      icon: <Cpu size={24} />,
      features: [
        { title: 'Smart Reordering', desc: 'Never run out of stock with predictive alerts.' },
        { title: 'Agentic Support', desc: 'AI agents that handle 80% of routine inquiries.' },
        { title: 'Dynamic Pricing', desc: 'Adjust prices based on demand and competition.' }
      ],
      image: '/platform-ai.png',
      status: 'AI ENGINE: PROCESSING',
      label: 'Agentic Intelligence'
    }
  ];

  return (
    <div className={styles.platformContainer}>
      <div className={styles.gridPattern}></div>
      
      <nav className={styles.nav}>
        <Link href="/landing" className="flex items-center gap-3 no-underline">
          <div className="w-9 h-9 bg-gradient-to-br from-[#00e599] to-[#008060] rounded-lg flex items-center justify-center text-black font-extrabold text-lg">M</div>
          <span className="text-white font-extrabold text-xl tracking-tight">MerchantOS</span>
        </Link>
        <div className="hidden md:flex gap-8">
          <Link href="/platform" className="text-white font-semibold">Platform</Link>
          <Link href="/solutions" className="text-zinc-400 hover:text-white transition-colors">Solutions</Link>
          <Link href="/pricing" className="text-zinc-400 hover:text-white transition-colors">Pricing</Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-semibold text-zinc-400 hover:text-white">Log in</Link>
          <Link href="/register" className="bg-white text-black px-5 py-2 rounded-xl font-bold text-sm">Start now</Link>
        </div>
      </nav>

      <main className={styles.content}>
        <section className={styles.hero}>
          <span className={styles.tag}>The Future of Commerce</span>
          <h1 className={styles.title}>Unified platform for the modern merchant</h1>
          <p className={styles.subtitle}>
            A complete ecosystem designed to help you build, grow, and scale your business without the technical overhead.
          </p>
          <div className="mt-12 flex justify-center gap-6">
            <Link href="/register" className="bg-[#00e599] text-black px-8 py-4 rounded-2xl font-bold text-lg hover:scale-105 transition-transform flex items-center gap-2">
              Get Started <ArrowRight size={20} />
            </Link>
          </div>
        </section>

        <section className={styles.statsGrid}>
          {[
            { label: 'Network Uptime', value: '99.9%' },
            { label: 'Orders Processed', value: '500M+' },
            { label: 'Supported Countries', value: '175+' },
            { label: 'API Latency', value: '<50ms' }
          ].map((stat, i) => (
            <div key={i} className={styles.statItem}>
              <div className={styles.statValue}>{stat.value}</div>
              <div className={styles.statLabel}>{stat.label}</div>
            </div>
          ))}
        </section>

        <section className={styles.featureSection}>
          {sections.map((section, i) => (
            <div key={i} className={styles.featureGrid}>
              <div className={styles.featureContent}>
                <span className={styles.tag} style={{ backgroundColor: 'rgba(0, 229, 153, 0.1)', color: '#00e599', borderColor: 'rgba(0, 229, 153, 0.2)' }}>
                  {section.tag}
                </span>
                <h2>{section.title}</h2>
                <p>{section.desc}</p>
                <div className={styles.featureList}>
                  {section.features.map((feat, idx) => (
                    <div key={idx} className={styles.featureItem}>
                      <div className={styles.featureItemIcon}>
                        <Check size={20} />
                      </div>
                      <div className={styles.featureItemText}>
                        <h4>{feat.title}</h4>
                        <p>{feat.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.visualWrapper}>
                <div className="bg-zinc-900 aspect-video rounded-3xl overflow-hidden border border-white/10 relative">
                  <Image 
                    src={section.image} 
                    alt={section.title} 
                    fill 
                    className="object-cover opacity-60"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                  <div className="absolute bottom-8 left-8">
                    <div className="text-[#00e599] font-mono text-xs mb-2">{section.status}</div>
                    <div className="text-white font-bold text-lg">{section.label}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className={styles.ctaSection}>
          <div className={styles.ctaBox}>
            <h2 className={styles.ctaTitle}>Ready to transform your business?</h2>
            <p className={styles.ctaDesc}>
              Join the new generation of merchants who are scaling faster and smarter with MerchantOS.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/register" className="bg-[#00e599] text-black px-10 py-5 rounded-2xl font-bold text-xl hover:shadow-[0_0_30px_rgba(0,229,153,0.3)] transition-all">
                Start your 14-day free trial
              </Link>
              <Link href="/pricing" className="bg-white/5 border border-white/10 text-white px-10 py-5 rounded-2xl font-bold text-xl hover:bg-white/10 transition-all">
                View Pricing
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-20 border-t border-white/5 bg-black/40 text-center text-zinc-500">
        <Copyright suffix="Built for scale." />
      </footer>
    </div>
  );
}
