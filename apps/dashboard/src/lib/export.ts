export function exportOrdersCSV(orders: any[]) {
  const rows = [
    ['Order Number', 'Date', 'Customer', 'Items', 'Subtotal', 'Delivery Fee', 'Total', 'Status', 'Payment', 'Delivery Type'],
    ...orders.map(o => {
      const addr = o.delivery_address as any
      return [
        o.order_number,
        new Date(o.created_at).toLocaleString('en-MY'),
        addr?.name ?? '—',
        (o.items ?? []).map((i: any) => `${i.product_name} x${i.quantity}`).join(' | '),
        Number(o.subtotal).toFixed(2),
        Number(o.delivery_fee).toFixed(2),
        Number(o.total_amount).toFixed(2),
        o.status,
        o.payment_method ?? '—',
        o.delivery_type ?? '—',
      ]
    }),
  ]

  const csv = rows.map(r => r.map(cell =>
    `"${String(cell).replace(/"/g, '""')}"`
  ).join(',')).join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
