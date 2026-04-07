'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Bot, Sparkles, MessageSquare, ShieldCheck, Zap } from 'lucide-react'

export function AIHighlight() {
  return (
    <section id="ai" className="py-32 bg-white relative overflow-hidden">
      <div className="container grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative"
        >
          <div className="absolute -inset-4 bg-emerald-100/50 rounded-[3rem] blur-3xl opacity-60" />
          <div className="relative glass p-10 rounded-[2.5rem] border border-emerald-50">
             <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white mb-8">
               <Bot size={24} />
             </div>
             <h3 className="text-3xl font-bold mb-6">Built-in AI Assistant</h3>
             <p className="text-text-secondary leading-relaxed mb-8">
               Our AI isn't just a chatbot. It's an intelligent assistant that understands your product catalog, shipping rules, and customer history.
             </p>
             <ul className="space-y-4">
                {[
                  'Automated order tracking updates',
                  'Product recommendations for customers',
                  '24/7 instant support in multiple languages',
                  'Smart inventory alerts for merchants'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-medium text-text-primary">
                    <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                       <Sparkles size={12} />
                    </div>
                    {item}
                  </li>
                ))}
             </ul>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
           <h2 className="text-4xl font-bold tracking-tight">Scale Your Support <span className="gradient-text">Without Scaling Effort.</span></h2>
           <p className="text-lg text-text-secondary">
             Stop answering the same questions over and over. Let Senang Store AI handle the repetitive tasks so you can focus on building your brand.
           </p>
           <div className="flex gap-4 pt-4">
              <button className="btn btn-primary">Try AI Assistant</button>
              <button className="btn btn-secondary">Learn More</button>
           </div>
        </motion.div>
      </div>
    </section>
  )
}

export function CTASection() {
  return (
    <section className="py-24 bg-white relative">
      <div className="container">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative bg-emerald-600 rounded-[3rem] p-12 md:p-20 text-center text-white shadow-2xl shadow-emerald-200 overflow-hidden"
        >
          {/* Decorative Background */}
          <div className="absolute top-0 right-0 w-full h-full pointer-events-none opacity-10">
             <div className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white rounded-full blur-[100px]" />
             <div className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-white rounded-full blur-[100px]" />
          </div>

          <div className="relative z-10 max-w-2xl mx-auto space-y-8">
             <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-emerald-50 text-sm font-bold border border-white/10">
               <Zap size={16} /> Ready to Grow?
             </div>
             <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.2]">Join Thousands of Happy Merchants Today.</h2>
             <p className="text-emerald-50/80 leading-relaxed text-lg">
               Start your 14-day free trial. No credit card required. Cancel anytime.
             </p>
             <div className="pt-4">
                <button className="btn bg-white text-emerald-600 hover:bg-emerald-50 hover:shadow-xl hover:translate-y-[-2px] transition-all px-10 h-16 text-lg">
                  Start My Free Trial
                </button>
             </div>
             <p className="text-emerald-200 text-xs font-medium uppercase tracking-[0.2em] mt-8">
               Trusted by merchants across Malaysia & Southeast Asia
             </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
