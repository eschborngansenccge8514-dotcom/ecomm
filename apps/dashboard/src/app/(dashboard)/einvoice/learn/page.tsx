'use client'

import React from 'react'
import { 
  Building2, 
  Globe, 
  ShieldCheck, 
  Clock, 
  FileText, 
  HelpCircle, 
  Layers, 
  AlertTriangle,
  CreditCard,
  Target,
  ChevronRight,
  ArrowLeft
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const TOPICS = [
  {
    title: 'What is e-Invoice?',
    icon: Globe,
    desc: 'LHDN\'s digital validation system for all business transactions in Malaysia.',
    color: 'text-blue-600 bg-blue-50'
  },
  {
    title: 'Which phase am I in?',
    icon: Target,
    desc: 'Enforcement timelines based on your annual revenue, from Aug 2024 to July 2025.',
    color: 'text-rose-600 bg-rose-50'
  },
  {
    title: 'B2B vs B2C',
    icon: Layers,
    desc: 'Understand when you need individual validation vs monthly consolidation.',
    color: 'text-emerald-600 bg-emerald-50'
  },
  {
    title: 'The 72-hour Rule',
    icon: Clock,
    desc: 'The strict window for cancelling an invoice after it has been validated.',
    color: 'text-amber-600 bg-amber-50'
  },
  {
    title: 'Credit & Debit Notes',
    icon: FileText,
    desc: 'How to correct mistakes after the 72-hour cancellation window has passed.',
    color: 'text-indigo-600 bg-indigo-50'
  },
  {
    title: 'LHDN UUID',
    icon: ShieldCheck,
    desc: 'The unique signature that proves your invoice is legally compliant.',
    color: 'text-purple-600 bg-purple-50'
  },
  {
    title: 'SST in e-Invoice',
    icon: CreditCard,
    desc: 'How Sales & Service Tax works within the new digital submission framework.',
    color: 'text-pink-600 bg-pink-50'
  },
  {
    title: 'Digital Certificate',
    icon: ShieldCheck,
    desc: 'Your business\'s digital "stamp" required to sign all LHDN submissions.',
    color: 'text-cyan-600 bg-cyan-50'
  },
  {
    title: 'Common Error Codes',
    icon: AlertTriangle,
    desc: 'A guide to resolving the most frequent rejection reasons from LHDN.',
    color: 'text-orange-600 bg-orange-50'
  },
  {
    title: 'Penalties',
    icon: AlertTriangle,
    desc: 'Understanding the legal risks and fines for non-compliance with e-invoicing.',
    color: 'text-red-600 bg-red-50'
  }
]

export default function LearnPage() {
  const router = useRouter()

  return (
    <div className="space-y-12 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-4">
         <button onClick={() => router.push('/einvoice')} className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-widest mb-2">
            <ArrowLeft size={14} /> Back to Hub
         </button>
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2">
               <h1 className="text-4xl font-black text-gray-900 tracking-tight">Compliance Center</h1>
               <p className="text-gray-500 font-medium max-w-lg leading-relaxed">
                  Everything you need to know about e-Invoicing in Malaysia, 
                  explained in plain language for business owners.
               </p>
            </div>
            <div className="hidden lg:block">
               <div className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 font-bold text-xs uppercase tracking-widest">
                  <ShieldCheck size={16} /> Verified Information
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {TOPICS.map((topic, i) => {
            const Icon = topic.icon
            return (
              <div 
                key={i} 
                className="group p-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-100 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
              >
                 <div className="relative z-10 flex flex-col h-full gap-6">
                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500", topic.color)}>
                       <Icon size={28} />
                    </div>
                    
                    <div className="space-y-2 flex-1">
                       <h3 className="text-xl font-bold text-gray-900 tracking-tight font-sans">{topic.title}</h3>
                       <p className="text-sm text-gray-500 font-medium leading-relaxed">
                          {topic.desc}
                       </p>
                    </div>

                    <button className="flex items-center gap-2 text-xs font-black text-gray-900 uppercase tracking-widest group-hover:gap-4 transition-all">
                       Learn More <ChevronRight size={14} />
                    </button>
                 </div>
              </div>
            )
         })}
      </div>

      <div className="bg-gray-900 rounded-[3rem] p-12 text-white flex flex-col md:flex-row items-center justify-between gap-12 relative overflow-hidden">
         <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <HelpCircle size={300} />
         </div>
         
         <div className="space-y-6 relative z-10">
            <h2 className="text-3xl font-black tracking-tight leading-tight max-w-md">
               Still have questions? Our AI Agent is here.
            </h2>
            <p className="text-gray-400 font-medium max-w-sm leading-relaxed">
               Ask about MSIC codes, TIN lookups, or specific LHDN regulations and get answers instantly.
            </p>
            <button className="px-8 py-3 bg-white text-gray-900 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-gray-100 transition-all shadow-xl shadow-white/5">
               Start Chat Support
            </button>
         </div>

         <div className="bg-white/10 backdrop-blur-md rounded-[2.5rem] p-8 border border-white/10 max-w-md w-full relative z-10">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-6">Expert Resources</h4>
            <ul className="space-y-4">
              {[
                { title: 'Official LHDN Guidelines', link: 'MyInvois Portal' },
                { title: 'API Documentation', link: 'UBL 2.1 Standard' },
                { title: 'Tax Consultant Directory', link: 'Verified Partners' }
              ].map((res, i) => (
                <li key={i} className="flex items-center justify-between group cursor-pointer">
                  <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">{res.title}</span>
                  <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{res.link}</div>
                </li>
              ))}
            </ul>
         </div>
      </div>
    </div>
  )
}
