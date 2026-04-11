'use client'

import { formatCurrency } from "@/lib/utils"
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Lock,
  MoreVertical,
  Building2,
  Wallet,
  Coins,
  ArrowDownUp,
  Tag
} from 'lucide-react'

import { AddAccountDialog } from "./AddAccountDialog"
import { EditAccountDialog } from "./EditAccountDialog"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { toggleAccountStatus } from "../../actions"
import { toast } from "react-hot-toast"
import Link from "next/link"

import { useState } from "react"

export function CoATree({ accounts }: { accounts: any[] }) {
  const [editingAccount, setEditingAccount] = useState<any>(null)
  const types = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const
  
  const typeColors = {
    ASSET:     'text-blue-600 bg-blue-50',
    LIABILITY: 'text-red-600 bg-red-50',
    EQUITY:    'text-purple-600 bg-purple-50',
    REVENUE:   'text-emerald-600 bg-emerald-50',
    EXPENSE:   'text-orange-600 bg-orange-50'
  }

  const typeIcons = {
    ASSET:     Building2,
    LIABILITY: Wallet,
    EQUITY:    Coins,
    REVENUE:   ArrowDownUp,
    EXPENSE:   Tag
  }

  async function handleToggleStatus(id: string, currentStatus: boolean) {
    try {
      await toggleAccountStatus(id, !currentStatus)
      toast.success(`Account ${!currentStatus ? 'activated' : 'deactivated'} successfully`)
    } catch (error: any) {
      toast.error(error.message || "Failed to update account")
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {types.map((type) => {
        const typeAccounts = accounts.filter(a => a.type === type).sort((a, b) => a.code.localeCompare(b.code))
        const Icon = typeIcons[type]
        
        return (
          <div key={type} className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
            <div className={`px-8 py-5 flex items-center justify-between border-b border-gray-50 bg-gray-50/30`}>
              <div className="flex items-center gap-3">
                 <div className={`w-10 h-10 rounded-xl ${typeColors[type]} flex items-center justify-center`}>
                    <Icon size={18} />
                 </div>
                 <div>
                    <h3 className="font-black text-gray-900 tracking-tight">{type}</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{typeAccounts.length} Accounts</p>
                 </div>
              </div>
              <AddAccountDialog type={type} />
            </div>
            
            <div className="divide-y divide-gray-50">
              {typeAccounts.map((account) => (
                <div 
                  key={account.id} 
                  className={`px-8 py-4 flex items-center justify-between hover:bg-gray-50 group transition-colors ${!account.isActive ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs font-bold text-gray-400 w-12">{account.code}</span>
                    <div className="flex flex-col">
                       <div className="flex items-center gap-2">
                          <span className="text-gray-900 font-bold">{account.name}</span>
                          {account.isSystemAccount && (
                            <span title="System Account">
                              <Lock size={12} className="text-gray-300" />
                            </span>
                          )}
                       </div>
                       {account.description && (
                         <span className="text-xs text-gray-400 font-medium">{account.description}</span>
                       )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                       <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Normal Balance</span>
                       <span className={`text-xs font-bold ${account.normalBalance === 'DEBIT' ? 'text-blue-600' : 'text-purple-600'}`}>
                         {account.normalBalance}
                       </span>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger render={
                        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-gray-600 hover:bg-white transition-opacity opacity-0 group-hover:opacity-100 outline-none">
                          <MoreVertical size={16} />
                        </button>
                      } />
                      <DropdownMenuContent align="end" className="rounded-xl border-gray-100 shadow-xl p-1">
                        <DropdownMenuItem onClick={() => {
                          console.log("Setting editing account (click)", account.name);
                          setEditingAccount(account);
                        }} className="rounded-lg text-xs font-bold py-2">
                          Edit Account
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className={`rounded-lg text-xs font-bold py-2 ${account.isActive ? 'text-red-500' : 'text-emerald-500'}`}
                          onClick={() => handleToggleStatus(account.id, account.isActive)}
                          disabled={account.isSystemAccount}
                        >
                          {account.isActive ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          render={<Link href={`/accounting/ledger/${account.id}`} />} 
                          className="rounded-lg text-xs font-bold py-2"
                        >
                          View Ledger
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
              {typeAccounts.length === 0 && (
                <div className="px-8 py-12 text-center">
                  <p className="text-sm font-bold text-gray-400">No accounts in this category</p>
                </div>
              )}
            </div>
          </div>
        )
      })}
      {editingAccount && (
        <EditAccountDialog 
          account={editingAccount} 
          open={!!editingAccount} 
          onOpenChange={(v) => !v && setEditingAccount(null)} 
        />
      )}
    </div>
  )
}
