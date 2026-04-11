import { getFiscalPeriods } from "../actions";
import { CalendarClock, Lock, Unlock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SetupPeriodsButton, OpenPeriodButton, ManagePeriodButton, FixPeriodsButton } from './_components/PeriodActions'

export default async function PeriodsPage() {
  const periods = await getFiscalPeriods();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <CalendarClock size={20} className="text-blue-600" />
              Fiscal Periods
            </h2>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Periods are like "chapters" of your financial book. Open a new month to start recording, and close it when you're finished.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <FixPeriodsButton />
            <OpenPeriodButton />
          </div>
        </div>

        <div className="space-y-4">
          {periods.map((period) => (
            <div 
              key={period.id} 
              className={cn(
                "flex items-center justify-between p-6 rounded-2xl border transition-all",
                period.status === 'OPEN' 
                  ? "bg-emerald-50/30 border-emerald-100" 
                  : "bg-gray-50/50 border-gray-100"
              )}
            >
              <div className="flex items-center gap-6">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  period.status === 'OPEN' ? "bg-emerald-100 text-emerald-600" : "bg-gray-200 text-gray-500"
                )}>
                  {period.status === 'OPEN' ? <Unlock size={22} /> : <Lock size={22} />}
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-lg">{period.name}</h3>
                  <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">
                    {new Date(period.startDate).toLocaleDateString()} — {new Date(period.endDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                 <span className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest",
                   period.status === 'OPEN' ? "bg-emerald-100 text-emerald-700" : 
                   period.status === 'CLOSED' ? "bg-amber-100 text-amber-700" : "bg-gray-200 text-gray-600"
                )}>
                  {period.status}
                </span>
                <ManagePeriodButton id={period.id} status={period.status || ''} />
              </div>
            </div>
          ))}

          {periods.length === 0 && (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <AlertCircle size={40} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-black text-gray-900">No Fiscal Periods Found</h3>
              <p className="text-gray-500 font-medium mt-1">You need to open your first fiscal period to start accounting.</p>
              <SetupPeriodsButton />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
