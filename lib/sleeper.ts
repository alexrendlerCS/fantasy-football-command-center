const SLEEPER_API = 'https://api.sleeper.app/v1'

export interface SleeperLeague {
  league_id: string
  name: string
  season: string
  status: string
  avatar: string | null
}

export interface SleeperUser {
  user_id: string
  display_name: string
  avatar: string | null
  metadata: { team_name?: string; avatar?: string } | null
}

export interface SleeperRoster {
  roster_id: number
  owner_id: string | null
  settings: { wins: number; losses: number; ties: number; fpts: number; fpts_decimal: number }
}

export interface SleeperMatchup {
  roster_id: number
  matchup_id: number | null
  points: number
}

export interface SleeperNflState {
  week: number
  display_week: number
  season: string
  season_type: 'pre' | 'regular' | 'post'
}

async function sleeperFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${SLEEPER_API}${path}`, { next: { revalidate: 30 } })
  if (!res.ok) throw new Error(`Sleeper API error: ${path} -> ${res.status}`)
  return res.json()
}

export const getNflState = () => sleeperFetch<SleeperNflState>('/state/nfl')
export const getLeague = (leagueId: string) => sleeperFetch<SleeperLeague>(`/league/${leagueId}`)
export const getLeagueUsers = (leagueId: string) => sleeperFetch<SleeperUser[]>(`/league/${leagueId}/users`)
export const getLeagueRosters = (leagueId: string) => sleeperFetch<SleeperRoster[]>(`/league/${leagueId}/rosters`)
export const getMatchups = (leagueId: string, week: number) =>
  sleeperFetch<SleeperMatchup[]>(`/league/${leagueId}/matchups/${week}`)

export function teamNameFor(user: SleeperUser | undefined): string {
  if (!user) return 'Unknown Team'
  return user.metadata?.team_name?.toUpperCase() ?? user.display_name.toUpperCase()
}

export function avatarUrlFor(user: SleeperUser | undefined): string | null {
  if (!user) return null
  if (user.metadata?.avatar) return user.metadata.avatar
  if (user.avatar) return `https://sleepercdn.com/avatars/thumbs/${user.avatar}`
  return null
}

export interface FantasyMatchup {
  matchupId: number
  home: { teamName: string; owner: string; avatar: string | null; score: number; record: string }
  away: { teamName: string; owner: string; avatar: string | null; score: number; record: string }
}

export async function getFantasyMatchups(leagueId: string, week: number): Promise<FantasyMatchup[]> {
  const [users, rosters, matchups] = await Promise.all([
    getLeagueUsers(leagueId),
    getLeagueRosters(leagueId),
    getMatchups(leagueId, week),
  ])

  const usersById = new Map(users.map(u => [u.user_id, u]))
  const rostersById = new Map(rosters.map(r => [r.roster_id, r]))

  const byMatchupId = new Map<number, SleeperMatchup[]>()
  for (const m of matchups) {
    if (m.matchup_id == null) continue
    const group = byMatchupId.get(m.matchup_id) ?? []
    group.push(m)
    byMatchupId.set(m.matchup_id, group)
  }

  const result: FantasyMatchup[] = []
  for (const [matchupId, pair] of byMatchupId) {
    if (pair.length < 2) continue
    const sides = pair.slice(0, 2).map(m => {
      const roster = rostersById.get(m.roster_id)
      const user = roster?.owner_id ? usersById.get(roster.owner_id) : undefined
      const record = roster ? `${roster.settings.wins}-${roster.settings.losses}` : '0-0'
      return {
        teamName: teamNameFor(user),
        owner: user?.display_name ?? 'Unknown',
        avatar: avatarUrlFor(user),
        score: m.points,
        record,
      }
    })
    result.push({ matchupId, home: sides[0], away: sides[1] })
  }

  return result.sort((a, b) => a.matchupId - b.matchupId)
}

export function currentFantasyWeek(state: SleeperNflState): number {
  return state.season_type === 'regular' ? state.display_week : 1
}
