import { Settings, X, Monitor, Printer, Layout, CheckCircle2, WifiOff, CreditCard, Wallet, Banknote, BarChart3 } from 'lucide-react'
import { usePosSettings } from '@/stores/pos-settings'
import { usePosOffline } from '@/stores/pos-offline'

interface TerminalSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  outletId?: string
  sessionId?: string
}

export function TerminalSettingsModal({ isOpen, onClose, outletId, sessionId }: TerminalSettingsModalProps) {
  const { 
    terminalName, setTerminalName, 
    autoPrint, setAutoPrint,
    autoPrintZReport, setAutoPrintZReport,
    defaultPaymentMethod, setDefaultPaymentMethod,
    quickPayAmounts, setQuickPayAmounts
  } = usePosSettings()

  const { isOfflineMode, setOfflineMode } = usePosOffline()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Settings size={20} className="text-amber-500" />
            Terminal Settings
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Terminal Identity */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Monitor size={14} />
              Terminal Branding
            </label>
            <input 
              type="text"
              value={terminalName}
              onChange={(e) => setTerminalName(e.target.value)}
              placeholder="e.g. Counter 01"
              className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 font-bold text-sm transition-all"
            />
          </div>

          {/* Payment Defaults */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <CreditCard size={14} />
              Payment Defaults
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'cash', label: 'Cash', icon: Banknote },
                { id: 'card', label: 'Card', icon: CreditCard },
                { id: 'ewallet', label: 'eWallet', icon: Wallet }
              ].map((method) => (
                <button
                  key={method.id}
                  onClick={() => setDefaultPaymentMethod(method.id as any)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1.5
                    ${defaultPaymentMethod === method.id 
                      ? 'border-slate-900 bg-slate-900 text-white shadow-lg' 
                      : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}`}
                >
                  <method.icon size={18} />
                  <span className="text-[10px] font-black uppercase">{method.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Preferences */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Layout size={14} />
              Preferences
            </label>
            <div className="space-y-2">
                <button 
                  onClick={() => setAutoPrint(!autoPrint)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${autoPrint ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                      <Printer size={16} />
                    </div>
                    <div className="text-left">
                      <p className="text-[11px] font-black text-slate-900 uppercase">Auto-Print Receipts</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">After checkout</p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full relative transition-colors ${autoPrint ? 'bg-slate-900' : 'bg-slate-200'}`}>
                     <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoPrint ? 'left-5' : 'left-1'}`} />
                  </div>
                </button>

                <button 
                  onClick={() => setAutoPrintZReport(!autoPrintZReport)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${autoPrintZReport ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                      <BarChart3 size={16} />
                    </div>
                    <div className="text-left">
                      <p className="text-[11px] font-black text-slate-900 uppercase">Auto-Print Z-Report</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">After session close</p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full relative transition-colors ${autoPrintZReport ? 'bg-slate-900' : 'bg-slate-200'}`}>
                     <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoPrintZReport ? 'left-5' : 'left-1'}`} />
                  </div>
                </button>

              <button 
                onClick={() => setOfflineMode(!isOfflineMode)}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isOfflineMode ? 'bg-amber-50 text-amber-600' : 'bg-slate-200 text-slate-400'}`}>
                    <WifiOff size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-black text-slate-900 uppercase">Force Offline</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter text-amber-600">Simulate offline state</p>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full relative transition-colors ${isOfflineMode ? 'bg-amber-500' : 'bg-slate-200'}`}>
                   <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isOfflineMode ? 'left-5' : 'left-1'}`} />
                </div>
              </button>
            </div>
          </div>

          {/* Diagnostic Info */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
             <div className="flex justify-between items-center">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Outlet ID</span>
               <span className="text-[10px] font-mono font-bold text-slate-600 bg-white px-2 py-1 rounded-lg border border-slate-200">{outletId?.slice(0, 8)}...</span>
             </div>
             <div className="flex justify-between items-center">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Session ID</span>
               <span className="text-[10px] font-mono font-bold text-slate-600 bg-white px-2 py-1 rounded-lg border border-slate-200">{sessionId?.slice(0, 8)}...</span>
             </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 h-12 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={18} />
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  )
}
