'use client'

import { useState, useEffect } from 'react'
import { 
  CheckCircle2, 
  Circle, 
  Package, 
  Store, 
  Monitor, 
  BookOpen, 
  ChevronRight,
  ArrowUpRight,
  Zap
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export function OnboardingChecklist() {
  const [progress, setProgress] = useState<any>(null)
  const [isVisible, setIsVisible] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchProgress() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('merchant_setup_progress')
        .select('*')
        .single()
      
      if (data) setProgress(data)
    }
    fetchProgress()
  }, [])

  if (!progress || !isVisible) return null

  const steps = [
    {
      id: 'products',
      label: 'Create your first product',
      description: 'Add items you want to sell in your POS or Storefront.',
      completed: progress.has_products,
      href: '/inventory/products',
      icon: Package
    },
    {
      id: 'outlets',
      label: 'Setup your physical outlet',
      description: 'Define where your inventory is stored and sold.',
      completed: progress.has_outlets,
      href: '/settings/outlets',
      icon: Store
    },
    {
      id: 'coa',
      label: 'Verify Chart of Accounts',
      description: 'We have seeded defaults for you. Just take a look!',
      completed: progress.has_coa,
      href: '/accounting/coa',
      icon: BookOpen
    },
    {
      id: 'pos',
      label: 'Start your first POS Session',
      description: 'The real magic happens here. Open your terminal!',
      completed: progress.has_sessions,
      href: '/pos',
      icon: Monitor
    }
  ]

  const completedCount = steps.filter(s => s.completed).length
  const totalCount = steps.length
  const percent = (completedCount / totalCount) * 100

  if (percent === 100) return null

  return (
    <Card className="rounded-[2.5rem] border-blue-100 bg-gradient-to-br from-white to-blue-50/30 shadow-2xl shadow-blue-100/50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-700">
      <CardHeader className="p-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Zap size={24} className="animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black text-slate-900 italic tracking-tight uppercase">Let's get started</CardTitle>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-1">Setup your business in minutes</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black text-blue-600 italic leading-none">{Math.round(percent)}%</span>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Complete</p>
          </div>
        </div>
        <Progress value={percent} className="h-2 mt-6 rounded-full bg-slate-100" />
      </CardHeader>
      <CardContent className="p-8 pt-4 space-y-4">
        <div className="grid gap-3">
          {steps.map((step) => (
            <Link 
              key={step.id} 
              href={step.href}
              className={`flex items-center gap-4 p-4 rounded-3xl border transition-all group
                ${step.completed 
                  ? 'bg-emerald-50/30 border-emerald-100 opacity-60' 
                  : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-50'}`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all
                ${step.completed 
                  ? 'bg-emerald-100 text-emerald-600' 
                  : 'bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white'}`}
              >
                {step.completed ? <CheckCircle2 size={24} /> : <step.icon size={22} />}
              </div>
              <div className="flex-1">
                <h4 className={`text-sm font-black uppercase tracking-tight ${step.completed ? 'text-emerald-900' : 'text-slate-900'}`}>
                  {step.label}
                </h4>
                <p className={`text-[11px] font-medium ${step.completed ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {step.description}
                </p>
              </div>
              {!step.completed && (
                <ArrowUpRight size={20} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              )}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
