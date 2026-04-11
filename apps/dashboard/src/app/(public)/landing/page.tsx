// apps/dashboard/src/app/(public)/landing/page.tsx
import Script from 'next/script';
import { HeroSection } from '@/components/sections/hero-section';
import { FeaturesSection } from '@/components/sections/features-section';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { CookieBanner } from '@/components/cookie-banner';
import { organizationSchema, softwareApplicationSchema, faqSchema } from '@/lib/landing/structured-data';
import { FAQS } from '@/lib/landing/constants';

// Below-fold sections deferred for performance
import { PricingSection } from '@/components/sections/pricing-section';
import { FAQSection } from '@/components/sections/faq-section';

export const metadata = {
  title: 'Hyperlocal — Merchant OS for Malaysian Businesses',
  description: 'All-in-one merchant operating system for Malaysian SMEs. POS, online store, Shopee/Lazada sync, built-in accounting, MyInvois e-invoice, and AI agents — one platform.',
};

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(FAQS as any)) }}
      />
      
      <div className="flex flex-col min-h-screen bg-white selection:bg-[#01696f]/30 selection:text-[#01696f]">
        <Navbar />
        
        <main className="flex-grow">
          <HeroSection />
          
          {/* Social Proof Bar placeholder */}
          <div className="bg-gray-50 border-y border-gray-100 py-12 overflow-hidden">
            <div className="mx-auto max-w-7xl px-4">
              <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-8">
                Trusted by 5,000+ Malaysian Merchants
              </p>
              <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-8 opacity-40 grayscale transition-all hover:grayscale-0 hover:opacity-100">
                 {['Shopee', 'Lazada', 'TikTok Shop', 'Maybank', 'Billplz', 'MyInvois'].map(logo => (
                   <span key={logo} className="text-xl font-black text-gray-800 tracking-tighter">{logo}</span>
                 ))}
              </div>
            </div>
          </div>

          <FeaturesSection />

          {/* Problem Section */}
          <section className="bg-gray-900 py-24 text-white">
            <div className="mx-auto max-w-4xl px-4 text-center">
              <h2 className="text-3xl font-bold mb-8">Running a business shouldn't feel like this.</h2>
              <div className="grid md:grid-cols-3 gap-8">
                {[
                  { title: 'Fragmented Tools', desc: 'Syncing data between 5 different apps every day.' },
                  { title: 'Manual Work', desc: 'Wasting hours on accounting and inventory counting.' },
                  { title: 'Hidden Costs', desc: 'Paying for multiple subscriptions that don\'t talk to each other.' }
                ].map(item => (
                  <div key={item.title} className="p-6 rounded-2xl bg-white/5 border border-white/10">
                    <div className="text-red-400 mb-4 text-2xl group-hover:scale-110 transition">✕</div>
                    <h3 className="font-bold mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-400">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* AI Agent Section */}
          <section className="py-24 bg-white">
            <div className="mx-auto max-w-6xl px-4">
              <div className="flex flex-col md:flex-row items-center gap-16">
                <div className="flex-1">
                  <span className="text-[#01696f] font-bold tracking-widest uppercase text-xs">AI-Powered Workforce</span>
                  <h2 className="text-4xl font-extrabold mt-4 mb-6 leading-tight">Your business, run by AI Agents.</h2>
                  <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                    Hyperlocal doesn't just give you tools; it gives you a workforce. Our AI agents handle customer service, 
                    inventory reordering, and financial reporting around the clock.
                  </p>
                  <ul className="space-y-4">
                    {['Customer Service Agent handles 90% of queries', 'Inventory Agent auto-generates POs based on sales velocity', 'Accounting Agent auto-posts SST journal entries'].map(text => (
                      <li key={text} className="flex gap-3 items-start">
                        <span className="bg-[#01696f]/10 text-[#01696f] p-1 rounded-full text-xs">✓</span>
                        <span className="text-gray-700 font-medium">{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex-1 bg-gray-50 rounded-3xl p-8 border border-gray-100 shadow-xl relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition">
                     <div className="w-64 h-64 rounded-full bg-[#01696f]"></div>
                   </div>
                   <div className="relative z-10 space-y-4">
                     {[
                       { agent: 'SupportBot', msg: 'Order #4122 has been shipped via Lalamove.' },
                       { agent: 'InventoryBot', msg: 'Stock for "Iced Latte" is low. Creating PO for Supplier A.' },
                       { agent: 'FinanceBot', msg: 'Daily reconciliation complete. SST variance: 0%.' }
                     ].map(msg => (
                       <div key={msg.agent} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 flex gap-4 animate-in fade-in slide-in-from-right duration-500">
                         <div className="w-10 h-10 rounded-full bg-[#01696f]/10 flex items-center justify-center text-xs font-bold text-[#01696f]">AI</div>
                         <div>
                           <div className="text-xs font-bold text-gray-900">{msg.agent}</div>
                           <div className="text-sm text-gray-500 mt-1">{msg.msg}</div>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
              </div>
            </div>
          </section>

          {/* Metrics Section */}
          <section className="bg-gray-50 py-24">
            <div className="mx-auto max-w-7xl px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { label: 'Orders Processed', value: '1.2M+' },
                { label: 'Active Merchants', value: '5,000+' },
                { label: 'Staff Hours Saved', value: '250k+' },
                { label: 'SST Compliance', value: '100%' }
              ].map(stat => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl md:text-5xl font-black text-[#01696f] mb-2">{stat.value}</div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{stat.label}</div>
                </div>
              ))}
            </div>
          </section>

          <PricingSection />
          
          {/* Testimonials Section */}
          <section className="py-24 bg-white">
             <div className="mx-auto max-w-4xl px-4 text-center">
               <h2 className="text-3xl font-bold mb-12">Built for Malaysian business owners.</h2>
               <div className="grid md:grid-cols-2 gap-8 text-left">
                 {[
                   { name: 'Sarah Tan', biz: 'The Coffee Nook, KL', quote: 'Hyperlocal replaced my bookkeeper and my POS. It saves me at least 15 hours a week that I now spend with my family.' },
                   { name: 'Ahmad Rizwan', biz: 'Rizwan Gadgets, JB', quote: 'The Shopee and Lazada sync is magic. I no longer have to worry about overselling or manual inventory updates.' }
                 ].map(item => (
                   <div key={item.name} className="p-8 rounded-3xl bg-gray-50 border border-gray-100 relative">
                     <span className="absolute top-6 left-8 text-6xl text-[#01696f]/10 font-serif leading-none">"</span>
                     <p className="relative z-10 text-gray-600 mb-6 italic">{item.quote}</p>
                     <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-full bg-[#01696f]/20"></div>
                       <div>
                         <div className="text-sm font-bold text-gray-900">{item.name}</div>
                         <div className="text-xs text-gray-400">{item.biz}</div>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
          </section>

          <FAQSection />
          
          {/* Final CTA Section */}
          <section className="bg-[#01696f] py-24 text-white">
            <div className="mx-auto max-w-4xl px-4 text-center">
              <h2 className="text-3xl md:text-5xl font-extrabold mb-6">
                Ready to automate your business?
              </h2>
              <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
                Join thousands of merchants who have replaced their manual work with the Hyperlocal Merchant OS.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <a
                  href="/register"
                  className="rounded-full bg-[#a8f0e8] text-[#01696f] px-10 py-5 text-lg font-bold shadow-2xl transition hover:scale-105 active:scale-95"
                >
                  Start Your 14-Day Free Trial
                </a>
              </div>
              <p className="mt-6 text-sm text-white/40">
                No credit card required · Instant setup · Cancel anytime
              </p>
            </div>
          </section>
        </main>
        
        <Footer />
        <CookieBanner />
      </div>
    </>
  );
}
