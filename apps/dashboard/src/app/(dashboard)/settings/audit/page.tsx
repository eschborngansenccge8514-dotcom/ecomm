import { History, ShieldCheck } from 'lucide-react'
import { getAuditLogs } from './actions'
import { AuditLogList } from './_components/AuditLogList'

export const dynamic = 'force-dynamic'

export default async function AuditLogPage() {
  const logs = await getAuditLogs()

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 rounded-[2rem] bg-slate-900 flex items-center justify-center text-white shadow-2xl shadow-slate-200">
              <History size={32} className="stroke-[2.5]" />
           </div>
           <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-1">Audit Trail</h1>
              <div className="flex items-center gap-2 text-slate-400 font-bold text-sm uppercase tracking-widest">
                 <ShieldCheck size={16} className="text-emerald-500" />
                 Immutable Security Logs
              </div>
           </div>
        </div>
      </div>

      {/* Main Content */}
      <AuditLogList initialLogs={logs} />
    </div>
  )
}
