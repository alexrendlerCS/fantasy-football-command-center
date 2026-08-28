import Dashboard from '@/components/dashboard'
import { currentFantasyWeek, getFantasyMatchups, getLeague, getNflState } from '@/lib/sleeper'
import { attachWinProbabilities } from '@/lib/attach-win-probability'

export const revalidate = 30

export default async function Page() {
  const leagueId = process.env.SLEEPER_LEAGUE_ID
  if (!leagueId) {
    throw new Error('SLEEPER_LEAGUE_ID is not set. Add it to .env.local.')
  }

  const [league, nflState] = await Promise.all([getLeague(leagueId), getNflState()])
  const week = currentFantasyWeek(nflState)
  const rawMatchups = await getFantasyMatchups(leagueId, week, league.roster_positions)
  const matchups = await attachWinProbabilities(leagueId, week, rawMatchups)

  return <Dashboard leagueName={league.name} week={week} matchups={matchups} />
}
