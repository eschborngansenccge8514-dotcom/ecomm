'use client'

import { useState } from 'react'
import { setupFiscalPeriods, updateFiscalPeriodStatus, fixPeriods } from '../../actions'
import { Loader2, MoreVertical, ShieldCheck, Lock, Unlock, ShieldAlert } from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Button } from '@/components/ui/button'

export function SetupPeriodsButton() {
  const [loading, setLoading] = useState(false)

  const handleSetup = async () => {
    try {
      setLoading(true)
      await setupFiscalPeriods()
      toast.success('Successfully set up accounting periods for the year')
    } catch (error) {
      console.error(error)
      toast.error('Failed to set up accounting periods')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button 
      onClick={handleSetup}
      disabled={loading}
      className="mt-6 bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" size={18} />
          Setting up...
        </>
      ) : (
        'Setup Accounting Periods'
      )}
    </button>
  )
}

export function OpenPeriodButton() {
    // This could be expanded to a dialog to pick dates, but for now we can just show a toast or placeholder
    return (
      <button 
        onClick={() => toast('Manual period creation coming soon. Use the Setup button to initialize the year.')}
        className="bg-gray-900 text-white px-6 py-2.5 rounded-xl text-sm font-black hover:bg-gray-800 transition-colors"
      >
        + Open New Period
      </button>
    )
}

export function ManagePeriodButton({ id, status }: { id: string, status: string }) {
  const [loading, setLoading] = useState(false)

  const handleUpdate = async (newStatus: 'OPEN' | 'CLOSED' | 'LOCKED') => {
    try {
      setLoading(true)
      await updateFiscalPeriodStatus(id, newStatus)
      toast.success(`Period status updated to ${newStatus}`)
    } catch (error) {
      console.error(error)
      toast.error('Failed to update period status')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-900" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" size={20} /> : <MoreVertical size={20} />}
        </Button>
      } />
      <DropdownMenuContent align="end" className="w-48 rounded-xl border-gray-100 shadow-xl">
        {status !== 'OPEN' && (
          <DropdownMenuItem onClick={() => handleUpdate('OPEN')} className="gap-2 font-bold text-emerald-600 focus:text-emerald-700">
            <Unlock size={16} /> Re-open Period
          </DropdownMenuItem>
        )}
        {status === 'OPEN' && (
          <DropdownMenuItem onClick={() => handleUpdate('CLOSED')} className="gap-2 font-bold text-amber-600 focus:text-amber-700">
            <Lock size={16} /> Close Period
          </DropdownMenuItem>
        )}
        {status !== 'LOCKED' && (
          <DropdownMenuItem onClick={() => handleUpdate('LOCKED')} className="gap-2 font-bold text-gray-900 focus:text-gray-900">
            <ShieldCheck size={16} /> Lock Period
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function FixPeriodsButton() {
  const [loading, setLoading] = useState(false)

  const handleFix = async () => {
    try {
      setLoading(true)
      await fixPeriods()
      toast.success('Periods optimized: Only current month is open.')
    } catch (error) {
      console.error(error)
      toast.error('Failed to optimize periods')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button 
      onClick={handleFix}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-100 rounded-xl text-sm font-bold hover:bg-amber-100 transition-all disabled:opacity-50"
    >
      {loading ? <Loader2 className="animate-spin" size={16} /> : <ShieldAlert size={16} />}
      Optimize Open Periods
    </button>
  )
}
