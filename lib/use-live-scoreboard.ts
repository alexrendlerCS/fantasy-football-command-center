'use client'

import { useEffect, useState } from 'react'
import type { TeamSchedule } from '@/lib/espn'

export interface ScoreboardGame {
  id: string
  shortName: string
  state: 'pre' | 'in' | 'post'
  statusDetail: string
  commenceTime: string
  home: { displayName: string; abbreviation: string; score: number }
  away: { displayName: string; abbreviation: string; score: number }
  favoredTeam: string | null
  favoredBy: number | null
}

export interface ScoreboardData {
  games: ScoreboardGame[]
  mode: 'live' | 'upcoming'
  schedule: Record<string, TeamSchedule>
}

const EMPTY: ScoreboardData = { games: [], mode: 'upcoming', schedule: {} }

export function useLiveScoreboard(pollMs = 30_000): ScoreboardData {
  const [data, setData] = useState<ScoreboardData>(EMPTY)

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch('/api/scoreboard', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch {
        // transient network error — keep showing the last good data, try again next tick
      }
    }

    poll()
    const id = setInterval(poll, pollMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [pollMs])

  return data
}
