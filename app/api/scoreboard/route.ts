import { NextResponse } from 'next/server'
import { getEspnScoreboard } from '@/lib/espn'
import { getOddsSnapshots } from '@/lib/odds'

export const revalidate = 30

export async function GET() {
  const games = await getEspnScoreboard()
  const anyLive = games.some(g => g.state === 'in')
  const odds = await getOddsSnapshots(anyLive)
  const oddsByPair = new Map(odds.map(o => [`${o.awayTeam}@${o.homeTeam}`, o]))

  const enriched = games.map(g => {
    const o = oddsByPair.get(`${g.away.displayName}@${g.home.displayName}`)
    return { ...g, favoredTeam: o?.favoredTeam ?? null, favoredBy: o?.favoredBy ?? null }
  })

  const live = enriched
    .filter(g => g.state === 'in')
    .sort((a, b) => Math.abs(a.home.score - a.away.score) - Math.abs(b.home.score - b.away.score))
  const upcoming = enriched
    .filter(g => g.state === 'pre')
    .sort((a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime())

  const mode = live.length > 0 ? 'live' : 'upcoming'
  const selected = (live.length > 0 ? live : upcoming).slice(0, 3)

  return NextResponse.json({ games: selected, mode })
}
