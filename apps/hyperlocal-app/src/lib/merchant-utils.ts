import { Merchant, OperatingHour } from '@/types/app.types'

/**
 * Checks if the merchant is currently open according to their operating hours.
 */
export function isStoreOpen(merchant: Merchant): { isOpen: boolean; nextStatusChange?: string } {
  if (!merchant.operating_hours || merchant.operating_hours.length === 0) {
    return { isOpen: true } // Default to open if no hours set
  }

  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const currentTime = now.getHours() * 100 + now.getMinutes() // e.g. 1530 for 3:30 PM

  const todayHours = merchant.operating_hours.find(h => h.day_of_week === dayOfWeek)

  if (!todayHours || todayHours.is_closed) {
    return { isOpen: false }
  }

  if (!todayHours.open_time || !todayHours.close_time) {
    return { isOpen: true } // If not closed but no times set, assume open
  }

  // Parse HH:mm:ss format
  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number)
    return h * 100 + m
  }

  const openTime = parseTime(todayHours.open_time)
  const closeTime = parseTime(todayHours.close_time)

  const isOpen = currentTime >= openTime && currentTime < closeTime

  return { 
    isOpen,
    nextStatusChange: isOpen ? todayHours.close_time : todayHours.open_time
  }
}

/**
 * Formats a single operating hour record for display.
 */
export function formatOperatingHour(hour: OperatingHour): string {
  if (hour.is_closed) return 'Closed'
  if (!hour.open_time || !hour.close_time) return 'Open 24h'
  
  const formatTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const displayH = h % 12 || 12
    return `${displayH}:${m.toString().padStart(2, '0')} ${period}`
  }

  return `${formatTime(hour.open_time)} - ${formatTime(hour.close_time)}`
}

/**
 * Gets the day name for a day_of_week index.
 */
export function getDayName(dayOfWeek: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]
}
