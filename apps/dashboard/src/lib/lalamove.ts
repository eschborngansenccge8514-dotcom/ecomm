
export const LALAMOVE_STATUS_MAP: Record<string, { label: string, color: string, bg: string, stage: number }> = {
  'finding_driver':     { label: 'Finding Driver',   color: 'text-amber-600',  bg: 'bg-amber-50',    stage: 0 },
  'assigning_driver':   { label: 'Assigning Driver', color: 'text-amber-600',  bg: 'bg-amber-50',    stage: 0 },
  'on_the_way':         { label: 'On The Way',       color: 'text-blue-600',    bg: 'bg-blue-50',     stage: 1 },
  'driver_assigned':    { label: 'Driver Assigned',  color: 'text-blue-600',    bg: 'bg-blue-50',     stage: 1 },
  'picked_up':          { label: 'In Transit',       color: 'text-indigo-700',  bg: 'bg-indigo-50',   stage: 2 },
  'delivered':          { label: 'Delivered',        color: 'text-emerald-600', bg: 'bg-emerald-50',  stage: 3 },
  'completed':          { label: 'Completed',        color: 'text-emerald-600', bg: 'bg-emerald-50',  stage: 3 },
  'cancelled':          { label: 'Cancelled',        color: 'text-rose-600',    bg: 'bg-rose-50',     stage: -1 },
  'failed':             { label: 'Failed',           color: 'text-rose-700',    bg: 'bg-rose-100',    stage: -1 },
  'rejected_by_driver': { label: 'Rejected',         color: 'text-rose-600',    bg: 'bg-rose-50',     stage: -1 },
  'expired':            { label: 'Expired',          color: 'text-slate-600',   bg: 'bg-slate-50',    stage: -1 },
}

export const getLalamoveStatus = (status: string) => {
  const s = status?.toLowerCase()
  return LALAMOVE_STATUS_MAP[s] || { label: status, color: 'text-slate-500', bg: 'bg-slate-100', stage: -1 }
}

export const LALAMOVE_STAGES = [
  { id: 'finding', label: 'Finding Driver' },
  { id: 'on_way',  label: 'On The Way'     },
  { id: 'transit', label: 'In Transit'     },
  { id: 'finish',  label: 'Delivered'      },
]

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  'MOTORCYCLE': 'Motorcycle',
  'CAR':        'Car',
  'VAN':        'Van',
  'TRUCK':      'Lorry/Truck',
}
