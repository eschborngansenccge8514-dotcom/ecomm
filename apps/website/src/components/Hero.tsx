'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, ArrowRight } from 'lucide-react'

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="container relative z-10">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-bold mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Launching Malaysia's Easiest Platform
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1]"
          >
            E-Commerce <span className="gradient-text">Made Easy</span> for Everyone.
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-text-secondary leading-relaxed mb-12 max-w-2xl"
          >
            Manage your store, automate support with AI, and handle local delivery with Senang Store. The all-in-one solution for modern merchants.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4"
          >
            <button className="btn btn-primary group">
              Start Free Trial
              <ChevronRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="btn btn-secondary group">
              View Demo
              <ArrowRight size={18} className="ml-2 text-text-tertiary group-hover:text-text-primary transition-colors" />
            </button>
          </motion.div>
        </div>

        {/* Stats Strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-16 flex flex-wrap justify-center gap-x-12 gap-y-4"
        >
          {[
            { value: '5,000+', label: 'Active Merchants' },
            { value: 'RM 2M+', label: 'GMV Processed' },
            { value: '99.9%', label: 'Uptime SLA' },
            { value: '< 2 min', label: 'Avg. Setup Time' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-text-primary">{stat.value}</div>
              <div className="text-xs text-text-tertiary font-medium mt-0.5">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Dashboard Mockup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="mt-16 relative mx-auto max-w-5xl"
        >
          <div className="absolute -inset-4 bg-gradient-to-tr from-emerald-500/10 to-blue-500/10 rounded-[2.5rem] blur-2xl" />
          <div className="relative glass p-3 rounded-[2rem] border border-gray-100 overflow-hidden shadow-2xl">
            {/* Browser chrome */}
            <div className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-300" />
                  <div className="w-3 h-3 rounded-full bg-yellow-300" />
                  <div className="w-3 h-3 rounded-full bg-green-300" />
                </div>
                <div className="flex-1 mx-4 h-6 bg-gray-100 rounded-md flex items-center px-3">
                  <span className="text-xs text-gray-400 font-mono">dashboard.senang.store</span>
                </div>
              </div>
              {/* Dashboard UI */}
              <div className="bg-white p-6 grid grid-cols-4 gap-4 min-h-[320px]">
                {/* Sidebar */}
                <div className="col-span-1 flex flex-col gap-3">
                  <div className="h-8 w-24 bg-emerald-600 rounded-lg" />
                  {['Orders', 'Products', 'Customers', 'Analytics', 'AI Agent'].map((item, i) => (
                    <div key={item} className={`h-8 rounded-lg flex items-center px-3 text-xs font-medium ${i === 0 ? 'bg-emerald-50 text-emerald-700' : 'text-gray-400'}`}>
                      <div className={`w-2 h-2 rounded-full mr-2 ${i === 0 ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                      {item}
                    </div>
                  ))}
                </div>
                {/* Main content */}
                <div className="col-span-3 flex flex-col gap-4">
                  {/* Stat cards */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Revenue', value: 'RM 12,430', change: '+18%', color: 'emerald' },
                      { label: 'Orders', value: '284', change: '+12%', color: 'blue' },
                      { label: 'Customers', value: '1,029', change: '+9%', color: 'indigo' },
                    ].map((card) => (
                      <div key={card.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <div className="text-xs text-gray-400 mb-1">{card.label}</div>
                        <div className="text-base font-bold text-gray-800">{card.value}</div>
                        <div className="text-xs text-emerald-600 font-semibold mt-1">{card.change}</div>
                      </div>
                    ))}
                  </div>
                  {/* Orders table */}
                  <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden flex-1">
                    <div className="px-4 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500 bg-white">Recent Orders</div>
                    {['#1042 — Aisyah R.', '#1041 — Hafiz M.', '#1040 — Priya S.'].map((row, i) => (
                      <div key={row} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 last:border-0">
                        <span className="text-xs text-gray-600 font-mono">{row}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${i === 0 ? 'bg-emerald-50 text-emerald-700' : i === 1 ? 'bg-blue-50 text-blue-700' : 'bg-yellow-50 text-yellow-700'}`}>
                          {i === 0 ? 'Delivered' : i === 1 ? 'Shipped' : 'Processing'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Decorative Blobs */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[600px] h-[600px] bg-emerald-50 rounded-full blur-[120px] opacity-60 pointer-events-none" />
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-50 rounded-full blur-[120px] opacity-60 pointer-events-none" />
    </section>
  )
}
