import { NextResponse } from 'next/server'
import { buildTeamSchedule, getEspnScoreboard, type EspnGame } from '@/lib/espn'
import { getOddsSnapshots, type OddsSnapshot } from '@/lib/odds'

export const revalidate = 30

// Division rivals play twice a season, so team names alone aren't a unique key across
// the whole schedule — pick whichever odds entry for that team pair has the closest
// kickoff time to this specific ESPN game, not just the first name match.
function closestOdds(game: EspnGame, oddsByPair: Map<string, OddsSnapshot[]>): OddsSnapshot | null {
  const candidates = oddsByPair.get(`${game.away.displayName}@${game.home.displayName}`)
  if (!candidates || candidates.length === 0) return null
  const gameTime = new Date(game.commenceTime).getTime()
  return candidates.reduce<OddsSnapshot | null>((best, c) => {
    const diff = Math.abs(new Date(c.commenceTime).getTime() - gameTime)
    const bestDiff = best ? Math.abs(new Date(best.commenceTime).getTime() - gameTime) : Infinity
    return diff < bestDiff ? c : best
  }, null)
}

export async function GET() {
  const games = await getEspnScoreboard()
  const anyLive = games.some(g => g.state === 'in')
  const odds = await getOddsSnapshots(anyLive)

  const oddsByPair = new Map<string, OddsSnapshot[]>()
  for (const o of odds) {
    const key = `${o.awayTeam}@${o.homeTeam}`
    const list = oddsByPair.get(key) ?? []
    list.push(o)
    oddsByPair.set(key, list)
  }

  const enriched = games.map(g => {
    const o = closestOdds(g, oddsByPair)
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
  const schedule = buildTeamSchedule(games)

  return NextResponse.json({ games: selected, mode, schedule })
}
