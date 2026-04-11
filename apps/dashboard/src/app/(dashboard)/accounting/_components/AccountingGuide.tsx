'use client'

import { useState } from 'react'
import { 
  BookOpen, 
  HelpCircle, 
  X, 
  CheckCircle2, 
  ArrowRight,
  ListTree,
  CalendarClock,
  FileText,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface GuideStep {
  title: string
  description: string
  icon: any
  href?: string
  color: string
  bg: string
}

interface AccountingGuideProps {
  context?: 'general' | 'pos' | 'coa' | 'periods' | 'expenses'
}

export function AccountingGuide({ context = 'general' }: AccountingGuideProps) {
  const [isOpen, setIsOpen] = useState(false)

  const contextMap: Record<string, GuideStep[]> = {
    general: [
      {
        title: '1. Setup Fiscal Periods',
        description: 'Define your reporting months. You must open a period to record transactions.',
        icon: CalendarClock,
        href: '/accounting/periods',
        color: 'text-purple-600',
        bg: 'bg-purple-50'
      },
      {
        title: '2. Chart of Accounts',
        description: 'Your categories for Assets, Liabilities, Income, and Expenses.',
        icon: ListTree,
        href: '/accounting/coa',
        color: 'text-blue-600',
        bg: 'bg-blue-50'
      },
      {
        title: '3. Automated Posting',
        description: 'Sales and purchases flow automatically into your ledger via journals.',
        icon: Zap,
        color: 'text-amber-600',
        bg: 'bg-amber-50'
      }
    ],
    pos: [
      {
        title: 'Session Management',
        description: 'Starting a session records your "Opening Cash". This is your float for the day.',
        icon: CalendarClock,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50'
      },
      {
        title: 'End of Day Batch',
        description: 'When you close a session, our agent summarizes all sales into ONE journal entry. This keeps your books clean.',
        icon: Zap,
        color: 'text-blue-600',
        bg: 'bg-blue-50'
      },
      {
        title: 'Cash Reconciliation',
        description: 'Providing a reason for shortages helps your accountant categorize "Cash Over/Short" automatically.',
        icon: HelpCircle,
        color: 'text-amber-600',
        bg: 'bg-amber-50'
      }
    ],
    coa: [
      {
        title: 'System Accounts',
        description: 'Accounts with a blue shield are used by automation. They MUST exist for the POS and Store to work.',
        icon: ListTree,
        color: 'text-blue-600',
        bg: 'bg-blue-50'
      },
      {
        title: 'Normal Balances',
        description: 'Assets & Expenses are usually Debits. Liabilities & Revenue are usually Credits.',
        icon: BookOpen,
        color: 'text-purple-600',
        bg: 'bg-purple-50'
      }
    ]
  }

  const steps = contextMap[context] || contextMap.general
  const title = context === 'pos' ? 'POS Accounting Guide' : context === 'coa' ? 'Chart of Accounts Guide' : 'Accounting Guide'

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 bg-blue-600 text-white p-4 rounded-2xl shadow-2xl hover:bg-blue-700 transition-all flex items-center gap-3 font-bold z-50 group hover:scale-105 border-4 border-white"
      >
        <HelpCircle size={24} />
        <span className="text-sm uppercase tracking-tighter">Guide: {context.toUpperCase()}</span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-100">
              <BookOpen size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">{title}</h2>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-0.5">Learn how the automation works</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors text-slate-400"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-4">
          <div className="grid gap-3">
            {steps.map((step, i) => (
              <div key={i} className="group relative flex items-start gap-5 p-5 rounded-3xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all">
                <div className={cn("w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-sm", step.bg, step.color)}>
                  <step.icon size={22} className="stroke-[2.5]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight mb-0.5">{step.title}</h3>
                  <p className="text-slate-500 text-xs font-bold leading-relaxed">{step.description}</p>
                </div>
                {step.href && (
                  <button 
                    onClick={() => {
                        window.location.href = step.href!
                        setIsOpen(false)
                    }}
                    className="self-center w-10 h-10 rounded-xl bg-white border border-slate-100 text-slate-400 opacity-0 group-hover:opacity-100 transition-all hover:text-blue-600 hover:border-blue-200 flex items-center justify-center shadow-sm"
                  >
                    <ArrowRight size={20} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-200 mt-4">
            <div className="flex items-center gap-3 mb-2">
               <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Zap size={18} className="text-blue-400 animate-pulse" />
               </div>
               <h4 className="font-black text-xs uppercase tracking-widest">
                 System Intelligence
               </h4>
            </div>
            <p className="text-slate-400 text-[11px] font-bold leading-relaxed">
              {context === 'pos' 
                ? "Don't worry about debiting Cash. When you end a session, our engine automatically checks your sales categories (Food vs Drink) and pushes the correct numbers to your P&L."
                : "You don't need to record every sale manually. When you complete an order, the system automatically creates a journal entry for you."}
            </p>
          </div>
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button 
            onClick={() => setIsOpen(false)}
            className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  )
}
