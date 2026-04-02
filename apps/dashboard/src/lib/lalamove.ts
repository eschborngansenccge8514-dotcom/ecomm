
export const LALAMOVE_STATUS_MAP: Record<string, { label: string, color: string, bg: string }> = {
  'finding_driver':     { label: 'Finding Driver',   color: 'text-amber-600',  bg: 'bg-amber-50'   },
  'assigning_driver':   { label: 'Assigning Driver', color: 'text-amber-600',  bg: 'bg-amber-50'   },
  'on_the_way':         { label: 'On The Way',       color: 'text-blue-600',    bg: 'bg-blue-50'    },
  'picked_up':          { label: 'Picked Up',        color: 'text-blue-700',    bg: 'bg-blue-100'   },
  'delivered':          { label: 'Delivered',        color: 'text-green-600',   bg: 'bg-green-50'   },
  'completed':          { label: 'Completed',        color: 'text-green-600',   bg: 'bg-green-50'   },
  'cancelled':          { label: 'Cancelled',        color: 'text-red-600',     bg: 'bg-red-50'     },
  'failed':             { label: 'Failed',           color: 'text-red-700',     bg: 'bg-red-100'    },
  'rejected_by_driver': { label: 'Rejected',         color: 'text-red-600',     bg: 'bg-red-50'     },
  'expired':            { label: 'Expired',          color: 'text-gray-600',    bg: 'bg-gray-50'    },
}

export const getLalamoveStatus = (status: string) => {
  const s = status?.toLowerCase()
  return LALAMOVE_STATUS_MAP[s] || { label: status, color: 'text-gray-500', bg: 'bg-gray-100' }
}

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  'MOTORCYCLE': 'Motorcycle',
  'CAR':        'Car',
  'VAN':        'Van',
  'TRUCK':      'Lorry/Truck',
}
