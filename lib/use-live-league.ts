'use client'

import { useEffect, useState } from 'react'
import type { FantasyMatchup } from '@/lib/sleeper'

export interface LiveLeagueData {
  leagueName: string
  week: number
  matchups: FantasyMatchup[]
}

export function useLiveLeague(initial: LiveLeagueData, pollMs = 30_000): LiveLeagueData {
  const [data, setData] = useState(initial)

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch('/api/matchups', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch {
        // transient network error — keep showing the last good data, try again next tick
      }
    }

    const id = setInterval(poll, pollMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [pollMs])

  return data
}
