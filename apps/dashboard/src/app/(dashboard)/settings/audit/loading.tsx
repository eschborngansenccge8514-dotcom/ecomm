import { History } from 'lucide-react'

export default function AuditLoading() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10">
      {/* Header Skeleton */}
      <div className="flex items-center gap-5 animate-pulse">
         <div className="w-16 h-16 rounded-[2rem] bg-gray-100" />
         <div className="space-y-2">
            <div className="h-10 w-48 bg-gray-100 rounded-xl" />
            <div className="h-4 w-32 bg-gray-50 rounded-lg" />
         </div>
      </div>

      {/* List Skeleton */}
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 bg-white rounded-[2rem] border border-gray-100 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
