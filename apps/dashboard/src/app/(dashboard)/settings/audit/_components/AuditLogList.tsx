'use client'

import { useState } from 'react'
import { 
  History, 
  Search, 
  Filter, 
  User, 
  Database, 
  ArrowRight,
  ChevronDown,
  Clock,
  ExternalLink,
  ChevronUp
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface AuditLog {
  id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  table_name: string
  record_id: string
  old_data: any
  new_data: any
  changed_fields: string[]
  created_at: string
  user_email?: string
}

export function AuditLogList({ initialLogs }: { initialLogs: AuditLog[] }) {
  const [logs, setLogs] = useState(initialLogs)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  
  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT': return 'text-emerald-600 bg-emerald-50 border-emerald-100'
      case 'UPDATE': return 'text-blue-600 bg-blue-50 border-blue-100'
      case 'DELETE': return 'text-red-600 bg-red-50 border-red-100'
      default: return 'text-gray-600 bg-gray-50 border-gray-100'
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-wrap gap-4 items-center">
         <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by Record ID or User Email..." 
              className="w-full h-12 pl-12 pr-4 rounded-xl border border-gray-100 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
            />
         </div>
         <div className="flex gap-2">
            <button className="h-12 px-6 rounded-xl border border-gray-100 hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-600 transition-all">
               <Filter size={18} />
               Table
               <ChevronDown size={16} />
            </button>
            <button className="h-12 px-6 rounded-xl border border-gray-100 hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-600 transition-all">
               <Filter size={18} />
               Action
               <ChevronDown size={16} />
            </button>
         </div>
      </div>

      {/* Timeline List */}
      <div className="space-y-4">
        {logs.map((log) => (
          <div key={log.id} className="group">
             <div className={cn(
               "bg-white rounded-[2rem] border border-gray-100 shadow-sm transition-all overflow-hidden",
               expandedId === log.id ? "ring-2 ring-blue-500 shadow-xl" : "hover:border-blue-200"
             )}>
                <div 
                  className="p-6 cursor-pointer flex items-center gap-6"
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                >
                   {/* Date Badge */}
                   <div className="text-center min-w-[60px] py-2 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase">{format(new Date(log.created_at), 'MMM')}</p>
                      <p className="text-lg font-black text-gray-900 leading-none">{format(new Date(log.created_at), 'dd')}</p>
                   </div>

                   {/* Main Info */}
                   <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-3">
                         <span className={cn(
                           "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                           getActionColor(log.action)
                         )}>
                           {log.action}
                         </span>
                         <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                            <Database size={12} /> {log.table_name}
                         </span>
                         <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                            <User size={12} /> {log.user_email || 'System'}
                         </span>
                      </div>
                      <h4 className="font-black text-gray-900 flex items-center gap-2">
                        {log.action === 'UPDATE' ? 'Record modified' : log.action === 'INSERT' ? 'Record created' : 'Record deleted'} 
                        <span className="text-xs font-bold text-gray-300">#{log.record_id.slice(0, 8)}</span>
                      </h4>
                   </div>

                   {/* Time & Expand */}
                   <div className="flex items-center gap-4">
                      <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
                        <Clock size={14} /> {format(new Date(log.created_at), 'hh:mm a')}
                      </span>
                      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-gray-900 group-hover:bg-gray-100 transition-all">
                        {expandedId === log.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                   </div>
                </div>

                {/* Expanded Details */}
                {expandedId === log.id && (
                  <div className="px-8 pb-8 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                     <div className="h-px bg-gray-50 mb-6" />
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                           <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-gray-300" /> Previous State
                           </h5>
                           <div className="bg-gray-50 rounded-2xl p-6 overflow-x-auto">
                              <pre className="text-xs font-mono text-gray-600 leading-relaxed">
                                {JSON.stringify(log.old_data || {}, null, 2)}
                              </pre>
                           </div>
                        </div>

                        <div className="space-y-4">
                           <h5 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> New State
                           </h5>
                           <div className="bg-blue-50/30 rounded-2xl p-6 overflow-x-auto border border-blue-50">
                              <pre className="text-xs font-mono text-blue-900 leading-relaxed">
                                {JSON.stringify(log.new_data || {}, null, 2)}
                              </pre>
                           </div>
                        </div>
                     </div>

                     {log.changed_fields && log.changed_fields.length > 0 && (
                        <div className="mt-8 space-y-3">
                           <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fields Changed</h5>
                           <div className="flex flex-wrap gap-2">
                              {log.changed_fields.map(field => (
                                <span key={field} className="px-3 py-1 bg-white border border-gray-100 rounded-lg text-xs font-bold text-gray-700 shadow-sm">
                                  {field}
                                </span>
                              ))}
                           </div>
                        </div>
                     )}

                     <div className="mt-8 pt-6 border-t border-gray-50 flex justify-between items-center">
                        <div className="flex gap-4">
                           <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase bg-gray-50 px-3 py-1.5 rounded-xl">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" /> IP: 127.0.0.1
                           </div>
                           <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase bg-gray-50 px-3 py-1.5 rounded-xl">
                              <span className="w-2 h-2 rounded-full bg-blue-500" /> Device: Mac Chrome
                           </div>
                        </div>
                        <button className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase hover:underline">
                           View Record <ExternalLink size={14} />
                        </button>
                     </div>
                  </div>
                )}
             </div>
          </div>
        ))}
      </div>
    </div>
  )
}
