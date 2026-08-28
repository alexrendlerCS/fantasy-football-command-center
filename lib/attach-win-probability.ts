import { getAllPlayers, type FantasyMatchup } from '@/lib/sleeper'
import { getEspnScoreboard, buildTeamSchedule } from '@/lib/espn'
import { getPlayerHistory, buildProjectionModel } from '@/lib/projections'
import { simulateMatchup } from '@/lib/simulation'

// Best-effort: if ESPN's endpoint hiccups or the simulation inputs are otherwise
// unavailable, just return the matchups without winProbability rather than breaking
// the whole page over what's ultimately a nice-to-have overlay.
export async function attachWinProbabilities(leagueId: string, week: number, matchups: FantasyMatchup[]): Promise<FantasyMatchup[]> {
  try {
    const [players, games, history] = await Promise.all([
      getAllPlayers(),
      getEspnScoreboard(),
      getPlayerHistory(leagueId, week),
    ])
    const schedule = buildTeamSchedule(games)
    const model = buildProjectionModel(history, players)

    return matchups.map(m => ({ ...m, winProbability: simulateMatchup(m, schedule, model) }))
  } catch {
    return matchups
  }
}
