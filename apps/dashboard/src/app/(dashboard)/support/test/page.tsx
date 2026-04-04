import { getAuthContext } from '@/lib/utils.server'
import { ChatWidget } from '@/components/support/ChatWidget'

export default async function SupportTestPage() {
  const { user, merchant } = await getAuthContext()

  if (!user || !merchant) {
    return <div>Unauthorized - Must be a merchant to test widget.</div>
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6 relative min-h-screen">
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Widget Playground</h2>
        <p className="text-muted-foreground">
          This is a preview of how the support widget will look on your storefront.
          You can interact with it on the bottom-right of this page.
        </p>
      </div>

      <div className="grid gap-6 mt-12 max-w-3xl">
        <div className="p-12 border-2 border-dashed rounded-3xl bg-slate-50 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-white shadow-xl flex items-center justify-center text-primary">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.2h.5" />
              <polyline points="16 2 22 8 16 14" />
              <line x1="22" y1="8" x2="9" y2="8" />
            </svg>
          </div>
          <div className="space-y-2">
             <h3 className="text-xl font-semibold">Storefront Preview</h3>
             <p className="text-sm text-muted-foreground max-w-sm">
               The widget is now integrated with your AI agent. Try asking "Where is my order?" or "How can I return an item?"
             </p>
          </div>
        </div>

        <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-2xl flex gap-4">
          <div className="p-3 bg-blue-100 rounded-xl text-blue-600 h-fit">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div className="space-y-2">
             <p className="text-sm font-semibold text-blue-900 leading-none">Testing note</p>
             <p className="text-sm text-blue-800 leading-relaxed">
               This preview uses your current merchant configuration. To update the welcome message or knowledge base, visit 
               <a href="/dashboard/support/settings" className="mx-1 underline font-bold hover:text-blue-600 transition-colors">Support Settings</a>.
             </p>
          </div>
        </div>
      </div>

      {/* The Widget itself */}
      <ChatWidget 
        merchantId={user.id} 
        storeName={merchant.store_name} 
        initialWelcome="Welcome to the playground! I'm your AI Support Hub. How can I assist you today?"
      />
    </div>
  )
}
