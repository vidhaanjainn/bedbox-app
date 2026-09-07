'use client'

import { useEffect, useState } from 'react'

// Single source of truth for "is this a phone-width screen" - used by the
// admin tables to switch from a table layout (plenty of room for every
// column) to a stacked card layout (only the essentials, everything else
// behind a "More details" disclosure) instead of ever scrolling sideways.
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])
  return isMobile
}
