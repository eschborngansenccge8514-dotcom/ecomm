'use client'

import React from 'react'
import { 
  AlertCircle, 
  Clock, 
  ChevronRight, 
  RefreshCw,
  Bell,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type TaskType = 'error' | 'warning' | 'info' | 'success'

export interface EinvoiceTask {
  id: string
  type: TaskType
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  timestamp?: string
}

interface ActionRequiredProps {
  tasks: EinvoiceTask[]
  className?: string
}

export function ActionRequired({ tasks, className }: ActionRequiredProps) {
  const getTaskIcon = (type: TaskType) => {
    switch (type) {
      case 'error': return <AlertCircle size={20} className="text-rose-600" />
      case 'warning': return <AlertTriangle size={20} className="text-amber-600" />
      case 'info': return <Clock size={20} className="text-blue-600" />
      case 'success': return <CheckCircle2 size={20} className="text-emerald-600" />
    }
  }

  const getTaskBg = (type: TaskType) => {
    switch (type) {
      case 'error': return 'bg-rose-50/50'
      case 'warning': return 'bg-amber-50/50'
      case 'info': return 'bg-blue-50/50'
      case 'success': return 'bg-emerald-50/50'
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
           <Bell size={20} className="text-blue-600" />
           What Needs Your Attention
        </h3>
        {tasks.length > 0 && (
           <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
             {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
           </span>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="bg-gray-50 rounded-2xl p-8 border border-dashed border-gray-200 text-center">
           <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-3 opacity-50" />
           <h4 className="font-bold text-gray-900">All caught up!</h4>
           <p className="text-sm text-gray-500 mt-1">LHDN has accepted all your recent submissions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div 
              key={task.id}
              className={cn(
                "group p-4 rounded-2xl border border-transparent hover:border-gray-100 hover:shadow-lg transition-all duration-300 flex items-start gap-4 cursor-default",
                getTaskBg(task.type)
              )}
            >
              <div className="mt-0.5 shrink-0">
                {getTaskIcon(task.type)}
              </div>
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-4">
                  <h4 className="text-sm font-bold text-gray-900">{task.title}</h4>
                  {task.timestamp && (
                    <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap uppercase tracking-widest">{task.timestamp}</span>
                  )}
                </div>
                <p className="text-xs font-medium text-gray-500/80 leading-relaxed overflow-hidden text-ellipsis line-clamp-2">
                  {task.description}
                </p>
              </div>

              {task.actionLabel && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    task.onAction?.()
                  }}
                  className="shrink-0 px-4 py-2 bg-white rounded-xl text-xs font-bold shadow-sm border border-gray-100 hover:bg-gray-900 hover:text-white transition-all duration-300 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
                >
                  {task.actionLabel}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
