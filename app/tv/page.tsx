import TvDashboard from '@/components/tv-dashboard'
import { currentFantasyWeek, getFantasyMatchups, getLeague, getNflState } from '@/lib/sleeper'
import './tv.css'

export const revalidate = 30

export default async function TvPage() {
  const leagueId = process.env.SLEEPER_LEAGUE_ID
  if (!leagueId) {
    throw new Error('SLEEPER_LEAGUE_ID is not set. Add it to .env.local.')
  }

  const [league, nflState] = await Promise.all([getLeague(leagueId), getNflState()])
  const week = currentFantasyWeek(nflState)
  const matchups = await getFantasyMatchups(leagueId, week, league.roster_positions)

  return <TvDashboard leagueName={league.name} week={week} matchups={matchups} />
}
