'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { 
  LayoutDashboard, Bot, MapPin, 
  Truck, Barcode, FileText, 
  Globe, ShieldCheck, Zap
} from 'lucide-react'

const features = [
  {
    title: 'Integrated Dashboard',
    desc: 'The center of your business. Manage orders, customers, and analytics in one clean interface.',
    icon: LayoutDashboard,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  {
    title: 'AI Support Agent',
    desc: 'Automate customer support 24/7. Our AI understands your products and helps customers instantly.',
    icon: Bot,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    title: 'Hyperlocal Reach',
    desc: 'Connect with customers in your neighborhood and grow your local presence effortlessly.',
    icon: MapPin,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
  },
  {
    title: 'Smart Logistics',
    desc: 'Seamless integration with Lalamove and local delivery networks for rapid fulfillment.',
    icon: Truck,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
  },
  {
    title: 'Barcode Inventory',
    desc: 'Scan, track, and manage your stock with professional-grade barcode integration.',
    icon: Barcode,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  {
    title: 'Auto E-Invoicing',
    desc: 'Stay compliant with automated tax and e-invoicing for every transaction.',
    icon: FileText,
    iconBg: 'bg-cyan-50',
    iconColor: 'text-cyan-600',
  }
]

export default function Features() {
  return (
    <section id="features" className="py-32 bg-bg-secondary relative overflow-hidden">
      <div className="container relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-4">Core Platform</h2>
          <h3 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Everything You Need.</h3>
          <p className="text-lg text-text-secondary">
            Powerful tools for modern commerce, designed to be as simple as possible.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <motion.div 
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass p-8 rounded-[2.5rem] border border-gray-100/50 hover:border-brand-primary/20 hover:shadow-xl transition-all group"
            >
              <div className={`w-14 h-14 rounded-2xl ${f.iconBg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                 <f.icon className={f.iconColor} size={28} />
              </div>
              <h4 className="text-xl font-bold mb-4">{f.title}</h4>
              <p className="text-text-secondary leading-relaxed text-sm">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

       {/* Decorative */}
       <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-100 rounded-full blur-[100px]" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-100 rounded-full blur-[100px]" />
       </div>
    </section>
  )
}
