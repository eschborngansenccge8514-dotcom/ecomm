'use client'

import React, { useState, useEffect } from 'react'
import { Lock, Loader2, AlertCircle } from 'lucide-react'
import { NumericKeypad } from '@/components/ui/NumericKeypad'
import { verifyPosPin } from '@/lib/pos-actions'
import { toast } from 'react-hot-toast'

interface PinPromptProps {
  onSuccess: () => void
  onCancel?: () => void
  title?: string
  description?: string
}

export function PinPrompt({ onSuccess, onCancel, title = "Manager Access", description = "Enter your 4-digit POS PIN to continue" }: PinPromptProps) {
  const [pin, setPin] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isError, setIsError] = useState(false)

  const handleInput = (val: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + val)
      setIsError(false)
    }
  }

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1))
    setIsError(false)
  }

  const handleClear = () => {
    setPin('')
    setIsError(false)
  }

  useEffect(() => {
    if (pin.length === 4) {
      handleVerify()
    }
  }, [pin])

  const handleVerify = async () => {
    setIsVerifying(true)
    try {
      const result = await verifyPosPin(pin)
      if (result.success) {
        onSuccess()
      } else {
        setIsError(true)
        setPin('')
        if (result.message === 'NO_PIN_SET') {
          toast.error("Security PIN not set. Set it in 'My Profile' first.")
        } else {
          toast.error("Incorrect PIN")
        }
      }
    } catch (err) {
      toast.error("Security Verification Failed")
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 bg-indigo-50 rounded-[2rem] flex items-center justify-center text-indigo-600 mb-4 shadow-inner">
          <Lock size={28} className={isVerifying ? 'animate-pulse' : ''} />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h2>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{description}</p>
      </div>

      {/* Pin Dots */}
      <div className="flex gap-4">
        {[...Array(4)].map((_, i) => (
          <div 
            key={i}
            className={`
              w-12 h-16 rounded-2xl border-2 flex items-center justify-center transition-all duration-200
              ${i < pin.length 
                ? 'border-indigo-600 bg-indigo-50 shadow-md scale-105' 
                : isError ? 'border-rose-200 bg-rose-50' : 'border-slate-100 bg-slate-50'
              }
            `}
          >
            {i < pin.length && (
              <div className="w-3 h-3 rounded-full bg-indigo-600 animate-in zoom-in duration-200" />
            )}
            {isError && i >= pin.length && (
              <AlertCircle size={14} className="text-rose-300" />
            )}
          </div>
        ))}
      </div>

      {/* Keypad */}
      <div className="w-full max-w-[280px]">
        {isVerifying ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <Loader2 className="animate-spin text-indigo-200" size={40} />
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Verifying Hash...</p>
          </div>
        ) : (
          <NumericKeypad 
            onInput={handleInput}
            onDelete={handleDelete}
            onClear={handleClear}
          />
        )}
      </div>

      {onCancel && (
        <button 
          onClick={onCancel}
          className="text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors"
        >
          Go Back
        </button>
      )}
    </div>
  )
}
