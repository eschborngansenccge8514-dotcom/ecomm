// ── EasyParcel API helper ─────────────────────────────────────────────────────
export const EP_LIVE = 'https://connect.easyparcel.my/'
export const EP_DEMO = 'https://demo.connect.easyparcel.my/'

// PHP http_build_query–compatible serialiser (handles nested arrays)
export function phpBuildQuery(obj: any, prefix = ''): string {
  const parts: string[] = []
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => {
      const k = `${prefix}[${i}]`
      parts.push(typeof v === 'object' && v !== null ? phpBuildQuery(v, k) : `${enc(k)}=${enc(v)}`)
    })
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, v] of Object.entries(obj)) {
      const k = prefix ? `${prefix}[${key}]` : key
      parts.push(typeof v === 'object' && v !== null ? phpBuildQuery(v, k) : `${enc(k)}=${enc(v)}`)
    }
  }
  return parts.join('&')
}
const enc = (v: any) => encodeURIComponent(String(v ?? ''))

export async function epPost(isDemo: boolean, action: string, params: Record<string, any>) {
  const base = isDemo ? EP_DEMO : EP_LIVE
  const res  = await fetch(`${base}?ac=${action}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    phpBuildQuery(params),
    cache:   'no-store',
  })
  if (!res.ok) throw new Error(`EasyParcel HTTP ${res.status}`)
  return res.json()
}

// ── Malaysian state codes ──────────────────────────────────────────────────────
export const MY_STATES: Record<string, string> = {
  jhr:'Johor', kdh:'Kedah', ktn:'Kelantan', mlk:'Melaka',
  nsn:'Negeri Sembilan', phg:'Pahang', prk:'Perak', pls:'Perlis',
  png:'Pulau Pinang', sgr:'Selangor', trg:'Terengganu',
  kul:'Kuala Lumpur', pjy:'Putra Jaya', srw:'Sarawak', sbh:'Sabah', lbn:'Labuan',
}
export const MY_STATE_OPTIONS = Object.entries(MY_STATES)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name))

// ── Parcel status colour map ───────────────────────────────────────────────────
export function shipStatusMeta(status: string): { label: string; bg: string; color: string } {
  const s = status?.toLowerCase() ?? ''
  if (s.includes('delivered') || s.includes('successfully'))  return { label: 'Delivered',    bg: 'bg-emerald-50', color: 'text-emerald-700' }
  if (s.includes('transit') || s.includes('delivering'))       return { label: 'In Transit',   bg: 'bg-indigo-50',  color: 'text-indigo-700'  }
  if (s.includes('collected'))                                  return { label: 'Collected',    bg: 'bg-blue-50',    color: 'text-blue-700'    }
  if (s.includes('drop off'))                                   return { label: 'Dropped Off',  bg: 'bg-purple-50',  color: 'text-purple-700'  }
  if (s.includes('pending') || s.includes('arrangement'))      return { label: 'Pending',      bg: 'bg-amber-50',   color: 'text-amber-700'   }
  if (s.includes('waiting'))                                    return { label: 'Awaiting Pay', bg: 'bg-orange-50',  color: 'text-orange-700'  }
  if (s.includes('cancel'))                                     return { label: 'Cancelled',    bg: 'bg-rose-50',    color: 'text-rose-600'    }
  if (s.includes('returned') || s.includes('return'))          return { label: 'Returned',     bg: 'bg-rose-50',    color: 'text-rose-700'    }
  return { label: status || 'Unknown', bg: 'bg-gray-50', color: 'text-gray-500' }
}

// ── Courier logo helper ────────────────────────────────────────────────────────
export const COURIER_EMOJI: Record<string, string> = {
  'poslaju': '📮', 'pos laju': '📮', 'skynet': '🟠', 'dhl': '📦',
  'nationwide': '🚚', 'j&t': '🔴', 'ninja': '🥷', 'best': '⭐',
  'flash': '⚡', 'city-link': '🔵', 'aramex': '🟡', 'cj century': '🟢',
}
export function courierEmoji(name: string): string {
  const n = (name || '').toLowerCase()
  for (const [key, emoji] of Object.entries(COURIER_EMOJI)) {
    if (n.includes(key)) return emoji
  }
  return '📦'
}
