"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { Bell, AlertTriangle, AlertCircle, Info, X } from "lucide-react"

export default function AlertsPanel({ merchantId }: { merchantId: string }) {
  const [alerts, setAlerts] = useState<any[]>([])
  const [isOpen, setIsOpen] = useState(false)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    // 1. Initial fetch
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from("agent_alerts")
        .select("*")
        .eq("merchant_id", merchantId)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
      if (data) setAlerts(data)
    }

    fetchAlerts()

    // 2. Realtime subscription
    const channel = supabase
      .channel("agent-alerts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_alerts",
          filter: `merchant_id=eq.${merchantId}`,
        },
        (payload) => {
          setAlerts((prev) => [payload.new, ...prev])
          setIsOpen(true) // Open notification if new alert arrives
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [merchantId, supabase])

  const markAsRead = async (id: string) => {
    await supabase.from("agent_alerts").update({ is_read: true }).eq("id", id)
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-50 border-red-200 text-red-700"
      case "warning":
        return "bg-amber-50 border-amber-200 text-amber-700"
      case "info":
        return "bg-blue-50 border-blue-200 text-blue-700"
      default:
        return "bg-gray-50 border-gray-200 text-gray-700"
    }
  }

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full hover:bg-gray-100 relative transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {alerts.length > 0 && (
          <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-sm ring-red-500 ring-offset-2 ring-1" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden ring-1 ring-black ring-opacity-5">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertSquare className="w-4 h-4 text-emerald-600" />
              Proactive Insights {alerts.length > 0 && `(${alerts.length})`}
            </h3>
            <button
               onClick={() => setIsOpen(false)}
               className="p-1 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-600 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-3">
                <div className="p-4 bg-gray-50 rounded-full">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-sm font-medium">Business is clear — no new alerts.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {alerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`p-4 border-l-4 ${getSeverityStyles(alert.severity)} hover:brightness-[0.98] transition-all cursor-pointer relative group`}
                    onClick={() => markAsRead(alert.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {alert.severity === "critical" ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : alert.severity === "warning" ? (
                          <AlertCircle className="w-4 h-4" />
                        ) : (
                          <Info className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm mb-1 leading-tight">{alert.title}</p>
                        <p className="text-xs text-black/60 line-clamp-3">{alert.body}</p>
                        {alert.action && (
                          <button className="mt-2.5 px-3 py-1 bg-white border border-black/10 rounded-lg text-[11px] font-bold shadow-sm hover:translate-y-[-1px] transition-transform flex items-center gap-1 active:translate-y-0">
                            {alert.action.label}
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <button 
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-black/5 rounded-md text-black/40 hover:text-black/60 transition-all absolute top-2 right-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          markAsRead(alert.id)
                        }}
                      >
                         <Check className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {alerts.length > 0 && (
             <div className="p-3 bg-gray-50/50 border-t border-gray-100 text-center">
                <button 
                  onClick={() => setAlerts([])} // local clear
                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                   Clear all notifications
                </button>
             </div>
          )}
        </div>
      )}
    </div>
  )
}

function AlertSquare(props: any) {
  return (
    <svg 
      {...props}
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="m12 8 4 4-4 4" />
      <path d="M8 12h8" />
    </svg>
  )
}

function CheckCircle(props: any) {
  return (
    <svg 
      {...props}
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function ArrowRight(props: any) {
  return (
    <svg 
      {...props}
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}

function Check(props: any) {
  return (
    <svg 
      {...props}
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
