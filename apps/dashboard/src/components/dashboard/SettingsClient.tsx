'use client'
import { useState }          from 'react'
import { cn }                from '@/lib/utils'
import { StoreSettings }     from './settings/StoreSettings'
import { LalamoveSettings }  from './settings/LalamoveSettings'
import { EasyParcelSettings } from './settings/EasyParcelSettings'
import { RazorpaySettings }   from './settings/RazorpaySettings'
import { BillplzSettings }   from './settings/BillplzSettings'

const TABS = [
  { key: 'store',    label: '🏪  Store Info'  },
  { key: 'lalamove', label: '🏍️  Lalamove'    },
  { key: 'easyparcel', label: '📦  EasyParcel' },
  { key: 'hours',    label: '🕐  Hours'        },
  { key: 'payments', label: '💳  Razorpay'     },
  { key: 'billplz',  label: '🧾  Billplz'      },
]

export function SettingsClient({ merchant, lalamoveConfig, easyparcelConfig, razorpayConfig, billplzConfig }: {
  merchant: any; lalamoveConfig: any; easyparcelConfig: any; razorpayConfig: any; billplzConfig: any;
}) {
  const [tab, setTab] = useState('store')

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap',
              tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'store'    && <StoreSettings    merchant={merchant} />}
        {tab === 'lalamove' && <LalamoveSettings config={lalamoveConfig} merchantId={merchant.id} />}
        {tab === 'easyparcel' && <EasyParcelSettings config={easyparcelConfig} merchantId={merchant.id} merchant={merchant} />}
        {tab === 'payments' && <RazorpaySettings config={razorpayConfig} merchantId={merchant.id} />}
        {tab === 'billplz'  && <BillplzSettings config={billplzConfig} merchantId={merchant.id} />}
        
        {tab === 'hours' && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
            <p className="text-gray-400">Section coming soon...</p>
          </div>
        )}
      </div>
    </div>
  )
}

