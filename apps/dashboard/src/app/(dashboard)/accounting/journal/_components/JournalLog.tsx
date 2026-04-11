'use client'

import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { 
  ArrowRight, 
  Search, 
  Filter, 
  History,
  FileText,
  AlertCircle
} from 'lucide-react'
import { cn } from "@/lib/utils"

export function JournalLog({ entries }: { entries: any[] }) {
  const router = useRouter()
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Search/Filter Bar */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex-1 relative">
           <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
           <input 
             type="text" 
             placeholder="Search entries by number or description..."
             className="w-full pl-11 pr-4 py-2.5 rounded-xl border-none bg-gray-50 focus:ring-2 focus:ring-blue-500/20 font-medium text-sm"
           />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-sm text-gray-600 hover:bg-gray-50">
           <Filter size={16} />
           Filters
        </button>
      </div>

      {/* Entries List */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest px-8">
              <th className="py-5 pl-8">Date</th>
              <th className="py-5">Entry #</th>
              <th className="py-5">Description</th>
              <th className="py-5">Source</th>
              <th className="py-5">Status</th>
              <th className="py-5 pr-8 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {entries.map((entry) => (
              <tr 
                key={entry.id} 
                className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                onClick={() => router.push(`/accounting/journal/${entry.id}`)}
              >
                <td className="py-5 pl-8">
                   <div className="flex flex-col">
                      <span className="text-gray-900 font-bold">{format(new Date(entry.date), 'dd MMM yyyy')}</span>
                      <span className="text-[10px] text-gray-400 font-bold">{format(new Date(entry.date), 'HH:mm')}</span>
                   </div>
                </td>
                <td className="py-5">
                   <span className="font-mono text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                     {entry.entryNumber}
                   </span>
                </td>
                <td className="py-5 max-w-sm">
                   <p className="text-gray-900 font-bold truncate">{entry.description}</p>
                </td>
                <td className="py-5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500 px-2 py-0.5 rounded-full bg-gray-100 uppercase tracking-tight">
                      {entry.sourceType}
                    </span>
                    {entry.sourceRef && (
                      <span className="text-[10px] font-mono text-gray-400">{entry.sourceRef}</span>
                    )}
                  </div>
                </td>
                <td className="py-5">
                   <span className={cn(
                     "text-[10px] font-black uppercase px-2 py-1 rounded-md",
                     entry.status === 'POSTED' ? "bg-emerald-50 text-emerald-600" : 
                     entry.status === 'REVERSED' ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"
                   )}>
                     {entry.status}
                   </span>
                </td>
                <td className="py-5 pr-8 text-right">
                   <Link 
                      href={`/accounting/journal/${entry.id}`}
                      className="text-gray-400 hover:text-blue-600 font-bold text-sm px-3 py-1 rounded-lg hover:bg-white transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1 ml-auto"
                      onClick={(e) => e.stopPropagation()}
                   >
                      View Details
                      <ArrowRight size={14} />
                   </Link>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="py-20 text-center">
                   <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                         <History size={24} className="text-gray-300" />
                      </div>
                      <p className="text-gray-500 font-bold">No ledger entries found</p>
                      <p className="text-sm text-gray-400">Transactions will appear here once business events are posted.</p>
                   </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
