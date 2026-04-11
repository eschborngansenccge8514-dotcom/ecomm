'use client'

import { useEffect, useState } from 'react'

export function Copyright({ company = "MerchantOS Inc.", suffix = "All rights reserved." }) {
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    setYear(new Date().getFullYear())
  }, [])

  return (
    <p>© {year} {company}. {suffix}</p>
  )
}
