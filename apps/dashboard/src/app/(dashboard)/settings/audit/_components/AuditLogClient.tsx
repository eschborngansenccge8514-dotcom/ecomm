'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { 
  Search, 
  Filter, 
  History, 
  User, 
  Table as TableIcon,
  ChevronRight,
  Eye,
  ArrowRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface AuditLog {
  id: string
  table_name: string
  action: string
  created_at: string
  old_data: any
  new_data: any
  changed_fields: string[] | null
  user?: {
    email: string
  }
}

export function AuditLogClient({ initialLogs }: { initialLogs: AuditLog[] }) {
  const [logs] = useState(initialLogs)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredLogs = logs.filter(log => 
    log.table_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.user?.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT': return 'bg-emerald-50 text-emerald-600 border-emerald-100'
      case 'UPDATE': return 'bg-blue-50 text-blue-600 border-blue-100'
      case 'DELETE': return 'bg-rose-50 text-rose-600 border-rose-100'
      default: return 'bg-gray-50 text-gray-600'
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="bg-white/80 backdrop-blur-md p-4 rounded-[2rem] border border-gray-100 shadow-sm flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search logs by table, action, or user..."
            className="w-full h-12 pl-12 pr-4 bg-gray-50/50 border border-gray-100 rounded-2xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="flex items-center gap-2 px-6 h-12 bg-white border border-gray-100 rounded-2xl font-bold text-sm text-gray-600 hover:border-gray-200 transition-all">
          <Filter size={18} />
          Filters
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Timestamp</th>
              <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Entity</th>
              <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
              <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">User</th>
              <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredLogs.map((log) => (
              <tr key={log.id} className="group hover:bg-gray-50/50 transition-colors">
                <td className="px-8 py-5">
                  <div className="flex flex-col">
                    <span className="font-black text-gray-900 text-sm">
                      {format(new Date(log.created_at), 'dd MMM yyyy')}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 tabular-nums">
                      {format(new Date(log.created_at), 'HH:mm:ss')}
                    </span>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-50 rounded-xl text-gray-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                      <TableIcon size={16} />
                    </div>
                    <span className="font-bold text-gray-700 uppercase tracking-tight text-sm">{log.table_name}</span>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <Badge variant="outline" className={cn("px-3 py-1 font-black rounded-lg text-[10px]", getActionColor(log.action))}>
                    {log.action}
                  </Badge>
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-gray-300" />
                    <span className="text-xs font-bold text-gray-600">{log.user?.email || 'System'}</span>
                  </div>
                </td>
                <td className="px-8 py-5 text-right">
                  <button 
                    onClick={() => setSelectedLog(log)}
                    className="p-2 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                  >
                    <Eye size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-4xl p-0 rounded-[2.5rem] overflow-hidden border-none shadow-2xl">
          {selectedLog && (
            <div className="flex flex-col h-[80vh]">
              <div className="p-8 bg-slate-900 text-white space-y-4">
                <div className="flex justify-between items-start">
                   <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audit Trail Entry</p>
                      <h2 className="text-2xl font-black">{selectedLog.table_name} - {selectedLog.action}</h2>
                      <p className="text-slate-400 font-bold text-xs uppercase tracking-tight">Record ID: {selectedLog.id}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-lg font-black">{format(new Date(selectedLog.created_at), 'dd MMM yyyy HH:mm:ss')}</p>
                      <span className="text-[10px] font-black bg-white/10 px-3 py-1 rounded-full uppercase tracking-widest">Immutable Record</span>
                   </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-12 bg-white space-y-12">
                {/* Diff Engine */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                   {selectedLog.action === 'UPDATE' && (
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-xl z-10 hidden md:flex">
                        <ArrowRight size={20} />
                     </div>
                   )}
                   
                   {/* Left Col: Old Data */}
                   <div className="space-y-4">
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Before</h3>
                      <div className="bg-gray-50 rounded-3xl p-6 font-mono text-xs whitespace-pre-wrap ring-1 ring-gray-100 h-full overflow-auto max-h-[400px]">
                         {selectedLog.old_data ? JSON.stringify(selectedLog.old_data, null, 2) : 'No previous data (NEW RECORD)'}
                      </div>
                   </div>

                   {/* Right Col: New Data */}
                   <div className="space-y-4">
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">After</h3>
                      <div className="bg-white rounded-3xl p-6 font-mono text-xs whitespace-pre-wrap ring-1 ring-emerald-100 h-full overflow-auto max-h-[400px] shadow-lg shadow-emerald-50">
                         {selectedLog.new_data ? JSON.stringify(selectedLog.new_data, null, 2) : 'Record Deleted'}
                      </div>
                   </div>
                </div>

                {/* Changed Fields Summary */}
                {selectedLog.changed_fields && selectedLog.changed_fields.length > 0 && (
                  <div className="space-y-4">
                     <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Impacted Fields</h3>
                     <div className="flex flex-wrap gap-2">
                        {selectedLog.changed_fields.map(field => (
                          <Badge key={field} variant="secondary" className="px-3 py-1 font-black text-[10px] uppercase rounded-lg bg-blue-50 text-blue-600 border-none">
                            {field}
                          </Badge>
                        ))}
                     </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
