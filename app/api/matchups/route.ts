import { NextResponse } from 'next/server'
import { currentFantasyWeek, getFantasyMatchups, getLeague, getNflState } from '@/lib/sleeper'
import { attachWinProbabilities } from '@/lib/attach-win-probability'

export const revalidate = 30

export async function GET() {
  const leagueId = process.env.SLEEPER_LEAGUE_ID
  if (!leagueId) {
    return NextResponse.json({ error: 'SLEEPER_LEAGUE_ID is not set' }, { status: 500 })
  }

  const [league, nflState] = await Promise.all([getLeague(leagueId), getNflState()])
  const week = currentFantasyWeek(nflState)
  const rawMatchups = await getFantasyMatchups(leagueId, week, league.roster_positions)
  const matchups = await attachWinProbabilities(leagueId, week, rawMatchups)

  return NextResponse.json({ leagueName: league.name, week, matchups })
}
