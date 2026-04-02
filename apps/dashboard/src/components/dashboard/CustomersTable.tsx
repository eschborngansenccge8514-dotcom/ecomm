'use client'
import { useRouter }    from 'next/navigation'
import { format }       from 'date-fns'
import { Button }       from '@/components/ui/button'
import { Users }        from 'lucide-react'

export function CustomersTable({ customers, total, page, pageSize }: {
  customers: any[]; total: number; page: number; pageSize: number
}) {
  const router     = useRouter()
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users size={20} className="text-gray-500" />
        <h2 className="font-bold text-gray-900">{total} unique customers</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                {['Customer', 'Contact', 'Orders', 'Total Spent', 'Last Order'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-sm text-gray-800">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">
                    <p>{c.email}</p>
                    <p className="text-xs">{c.phone}</p>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-gray-700">{c.orderCount}</td>
                  <td className="px-5 py-3.5 text-sm font-bold text-blue-600">
                    RM {c.totalSpent.toFixed(2)}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-400">
                    {format(new Date(c.lastOrderAt), 'd MMM yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
            <p className="text-xs text-gray-400">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1}
                onClick={() => router.push(`/customers?page=${page - 1}`)}>← Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages}
                onClick={() => router.push(`/customers?page=${page + 1}`)}>Next →</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
