'use client'

import React, { useState, useEffect } from 'react'
import { 
  X, 
  ArrowRight, 
  Sparkles, 
  Zap, 
  Monitor, 
  CreditCard, 
  Lock 
} from 'lucide-react'

const TOUR_STEPS = [
  {
    target: 'pos-main',
    title: 'Welcome to your Terminal!',
    description: 'This is where you make sales. It works even if your internet goes down!',
    icon: Monitor,
    position: 'center'
  },
  {
    target: 'session-start',
    title: 'Open your Session',
    description: 'Before selling, click the Menu to "Start Session" and record your opening cash.',
    icon: Zap,
    position: 'top-right'
  },
  {
    target: 'cart-checkout',
    title: 'Instant Checkout',
    description: 'Add products to the cart and hit Checkout. The system automatically creates your accounting entries.',
    icon: CreditCard,
    position: 'right'
  },
  {
    target: 'session-end',
    title: 'Closing Time',
    description: 'When done, "End Session" to generate your Z-Report and post your daily summary to the ledger.',
    icon: Lock,
    position: 'top-right'
  }
]

export function POSTour() {
  const [currentStep, setCurrentStep] = useState<number | null>(null)
  
  useEffect(() => {
    const hasCompletedTour = localStorage.getItem('pos-tour-completed')
    if (!hasCompletedTour) {
      setTimeout(() => setCurrentStep(0), 1000)
    }
  }, [])

  const nextStep = () => {
    if (currentStep === TOUR_STEPS.length - 1) {
      finishTour()
    } else {
      setCurrentStep(prev => (prev !== null ? prev + 1 : null))
    }
  }

  const finishTour = () => {
    localStorage.setItem('pos-tour-completed', 'true')
    setCurrentStep(null)
  }

  if (currentStep === null) return null

  const step = TOUR_STEPS[currentStep]

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500">
      <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border-4 border-blue-500">
        <div className="p-8 pb-4 flex justify-between items-start">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <step.icon size={24} className="animate-bounce" />
          </div>
          <button onClick={finishTour} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 grayscale">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-8 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-amber-500" />
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">POS PRO TIP ({currentStep + 1}/{TOUR_STEPS.length})</span>
          </div>
          <h3 className="text-xl font-black text-slate-900 italic tracking-tight uppercase leading-tight mb-3">
            {step.title}
          </h3>
          <p className="text-slate-500 text-sm font-bold leading-relaxed">
            {step.description}
          </p>
        </div>

        <div className="p-6 bg-slate-50 flex gap-3">
          <button 
            onClick={finishTour}
            className="flex-1 h-12 rounded-xl text-slate-400 font-bold text-xs uppercase hover:bg-white transition-all"
          >
            Skip
          </button>
          <button 
            onClick={nextStep}
            className="flex-[2] h-12 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
          >
            {currentStep === TOUR_STEPS.length - 1 ? 'Get Started' : 'Next Tip'}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
