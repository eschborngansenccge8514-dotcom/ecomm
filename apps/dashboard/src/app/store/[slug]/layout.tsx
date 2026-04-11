import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { cssVarsFromAppearance, DEFAULT_APPEARANCE } from '@/lib/store-types'
import { CartProvider } from './_components/CartContext'
import { CartButton } from './_components/CartButton'

export default async function StoreLayout({
  params, children,
}: { params: Promise<{ slug: string }>; children: React.ReactNode }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_store_config', { p_slug: slug })
  const config   = data?.[0]

  if (!config || !config.is_published) notFound()

  const appearance = { ...DEFAULT_APPEARANCE, ...(config.appearance ?? {}) }
  const cssVars    = cssVarsFromAppearance(appearance)

  // Load Google Font dynamically
  const fontUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(appearance.fontFamily)}:wght@400;500;600;700&display=swap`

  return (
    <CartProvider>
      <div style={cssVars as any} className="min-h-screen bg-[var(--color-bg)] font-[family-name:var(--font-body)]">
        <link rel="stylesheet" href={fontUrl} />
        {appearance.favicon && <link rel="icon" href={appearance.favicon} />}

        {/* Announcement banner */}
        {config.active_announcement && (
          <div className="w-full px-4 py-2.5 text-center text-sm font-medium flex items-center justify-center gap-2 sticky top-0 z-50 border-b border-white/10"
            style={{
              backgroundColor: config.active_announcement.bg_color,
              color:           config.active_announcement.text_color,
            }}>
            <span>{config.active_announcement.message}</span>
            {config.active_announcement.link_url && (
              <a href={config.active_announcement.link_url}
                className="underline font-bold ml-2 text-xs hover:opacity-80 transition-opacity">
                {config.active_announcement.link_text ?? 'Learn more'}
              </a>
            )}
          </div>
        )}

        {/* Sticky cart button — top right */}
        <div className="fixed top-4 right-4 z-40">
          <CartButton />
        </div>

        <main>
          {children}
        </main>
      </div>
    </CartProvider>
  )
}
