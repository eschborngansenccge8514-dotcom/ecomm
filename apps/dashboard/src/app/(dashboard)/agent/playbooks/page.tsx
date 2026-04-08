'use client'

import { useEffect, useState } from "react"
import { Play, Pause, Clock, CheckCircle2, AlertCircle, Plus, ChevronRight, Settings, Zap, Workflow } from "lucide-react"

export default function PlaybooksPage({ merchantId }: { merchantId: string }) {
  const [playbooks, setPlaybooks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [runningId, setRunningId] = useState<string | null>(null)

  useEffect(() => {
    fetchPlaybooks()
  }, [])

  const fetchPlaybooks = async () => {
    const res = await fetch("/api/agent/playbooks")
    const data = await res.json()
    setPlaybooks(data)
    setLoading(false)
  }

  const togglePlaybook = async (id: string, active: boolean) => {
    // simplified update
    await fetch(`/api/agent/playbooks/${id}`, {
      method: "PATCH",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !active })
    })
    fetchPlaybooks()
  }

  const runNow = async (id: string) => {
    setRunningId(id)
    await fetch(`/api/agent/playbooks/${id}/run`, {
      method: "POST",
      body: JSON.stringify({ merchantId })
    })
    setRunningId(null)
    fetchPlaybooks()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>

  return (
    <div className="max-w-6xl mx-auto p-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 flex items-center gap-3">
             <div className="p-2 bg-emerald-100 rounded-xl">
               <Zap className="w-6 h-6 text-emerald-600" />
             </div>
             Autonomous Playbooks
          </h1>
          <p className="mt-2 text-gray-500 font-medium">Automate recurring merchant operations with smart AI-driven tasks.</p>
        </div>
        <button className="px-5 py-2.5 bg-gray-900 text-white rounded-xl font-bold shadow-lg shadow-gray-200 hover:scale-[1.02] transition-transform flex items-center gap-2 active:scale-[0.98]">
           <Plus className="w-5 h-5" />
           New Playbook
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {playbooks.map((playbook) => (
          <div 
            key={playbook.id} 
            className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all duration-300 p-6 flex flex-col relative overflow-hidden"
          >
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full translate-x-16 translate-y-[-16px] group-hover:scale-125 transition-transform duration-500 opacity-50" />
            
            <div className="flex items-start justify-between mb-4 relative">
              <div className="p-3 bg-gray-50 rounded-lg group-hover:bg-emerald-50 transition-colors">
                <Workflow className="w-6 h-6 text-gray-400 group-hover:text-emerald-500" />
              </div>
              <div className="flex items-center gap-2">
                 <button
                   onClick={() => togglePlaybook(playbook.id, playbook.is_active)}
                   className={`p-2 rounded-lg transition-all ${
                     playbook.is_active 
                      ? "text-emerald-600 bg-emerald-50 hover:bg-emerald-100" 
                      : "text-gray-400 bg-gray-50 hover:bg-gray-100"
                   }`}
                   title={playbook.is_active ? "Pause" : "Resume"}
                 >
                   {playbook.is_active ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                 </button>
                 <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all">
                    <Settings className="w-4 h-4" />
                 </button>
              </div>
            </div>

            <h3 className="text-lg font-bold text-gray-900 relative">{playbook.name}</h3>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2 relative">{playbook.description}</p>

            <div className="mt-6 flex flex-wrap gap-2 relative">
               <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 text-[11px] font-bold text-gray-600 rounded-full border border-gray-100">
                  <Clock className="w-3 h-3" />
                  {playbook.schedule.type === 'daily' ? `Daily @ ${playbook.schedule.time}` : playbook.schedule.type}
               </div>
               {playbook.last_run_status === 'success' ? (
                 <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-[11px] font-bold text-emerald-600 rounded-full border border-emerald-100">
                    <CheckCircle2 className="w-3 h-3" />
                    Last success: {new Date(playbook.last_run_at).toLocaleDateString()}
                 </div>
               ) : playbook.last_run_status === 'failed' ? (
                 <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-[11px] font-bold text-red-600 rounded-full border border-red-100">
                    <AlertCircle className="w-3 h-3" />
                    Last run failed
                 </div>
               ) : null}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-50 flex items-center justify-between relative">
               <button 
                 onClick={() => runNow(playbook.id)}
                 disabled={runningId === playbook.id}
                 className="flex items-center gap-2 text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors disabled:opacity-50"
               >
                 {runningId === playbook.id ? (
                   <>
                     <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                     Running...
                   </>
                 ) : (
                   <>
                     <Play className="w-4 h-4 fill-current" />
                     Run Now
                   </>
                 )}
               </button>
               <button className="text-gray-400 hover:text-gray-600 text-xs font-medium flex items-center gap-1 transition-all">
                  View Run Log
                  <ChevronRight className="w-3 h-3" />
               </button>
            </div>
          </div>
        ))}

        {playbooks.length === 0 && (
           <div className="col-span-full py-20 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <div className="p-5 bg-white rounded-2xl shadow-sm inline-flex mb-4">
                 <Zap className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">No active playbooks yet</h2>
              <p className="text-gray-500 mt-2 max-w-sm mx-auto">Ask the MerchantMind assistant to "save a playbook for..." to automate your business operations.</p>
           </div>
        )}
      </div>
    </div>
  )
}

