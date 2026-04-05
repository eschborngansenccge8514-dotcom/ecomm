'use client'
import { useRouter }    from 'next/navigation'
import { useRef }      from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { format }       from 'date-fns'
import { Button }       from '@/components/ui/button'
import { Users }        from 'lucide-react'

export function CustomersTable({ customers, total, page, pageSize }: {
  customers: any[]; total: number; page: number; pageSize: number
}) {
  const router     = useRouter()
  const totalPages = Math.ceil(total / pageSize)

  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: customers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 5,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-center gap-2 px-1">
        <Users size={20} className="text-blue-500" />
        <h2 className="font-bold text-gray-900">{total} unique customers</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div 
          ref={parentRef}
          className="overflow-auto max-h-[600px] no-scrollbar scroll-smooth"
        >
          <div className="w-full min-w-[700px] relative" style={{ height: `${totalSize}px` }}>
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-md border-b border-gray-100">
                <tr>
                  {['Customer', 'Contact', 'Orders', 'Total Spent', 'Last Order'].map(h => (
                    <th key={h} className="text-left text-[10px] font-black text-gray-400 px-5 py-3 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {virtualItems.map((virtualRow) => {
                  const c = customers[virtualRow.index]
                  return (
                    <tr 
                      key={virtualRow.key} 
                      data-index={virtualRow.index}
                      className="hover:bg-blue-50/30 transition-colors absolute w-full flex items-center border-b border-gray-50 last:border-0"
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <td className="px-5 py-3 flex-1 min-w-[150px]">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm shrink-0 shadow-sm">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-sm text-gray-800 truncate">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 flex-1 min-w-[200px] text-sm text-gray-500 overflow-hidden">
                        <p className="truncate font-medium">{c.email}</p>
                        <p className="text-[10px] truncate text-gray-400 font-bold uppercase">{c.phone}</p>
                      </td>
                      <td className="px-5 py-3 w-24 shrink-0">
                        <span className="text-xs font-black text-gray-700 bg-gray-100 px-2 py-1 rounded-lg">
                          {c.orderCount}
                        </span>
                      </td>
                      <td className="px-5 py-3 w-32 shrink-0">
                        <span className="text-sm font-black text-blue-600">RM {c.totalSpent.toFixed(2)}</span>
                      </td>
                      <td className="px-5 py-3 w-40 shrink-0">
                        <span className="text-xs font-bold text-gray-400 whitespace-nowrap">
                          {format(new Date(c.lastOrderAt), 'd MMM yyyy')}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl h-9 px-4 text-xs font-bold bg-white"
                disabled={page <= 1}
                onClick={() => router.push(`/customers?page=${page - 1}`)}
              >
                ← Previous
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl h-9 px-4 text-xs font-bold bg-white"
                disabled={page >= totalPages}
                onClick={() => router.push(`/customers?page=${page + 1}`)}
              >
                Next →
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
