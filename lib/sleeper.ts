const SLEEPER_API = 'https://api.sleeper.app/v1'

export interface SleeperLeague {
  league_id: string
  name: string
  season: string
  status: string
  avatar: string | null
  roster_positions: string[]
}

export interface SleeperPlayer {
  player_id: string
  full_name?: string
  first_name?: string
  last_name?: string
  position: string | null
  team: string | null
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
  starters: string[]
  starters_points: number[]
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

// ~15MB and covers every NFL player ever — Sleeper's own docs say to fetch this at most
// once a day. It's too large for Next's fetch data cache, so cache it in module scope
// instead (best-effort: persists across warm invocations, refetched on cold start).
const PLAYERS_TTL_MS = 24 * 60 * 60 * 1000
let playersCache: { data: Record<string, SleeperPlayer>; fetchedAt: number } | null = null

export async function getAllPlayers(): Promise<Record<string, SleeperPlayer>> {
  if (playersCache && Date.now() - playersCache.fetchedAt < PLAYERS_TTL_MS) {
    return playersCache.data
  }
  const res = await fetch(`${SLEEPER_API}/players/nfl`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Sleeper API error: /players/nfl -> ${res.status}`)
  const data = (await res.json()) as Record<string, SleeperPlayer>
  playersCache = { data, fetchedAt: Date.now() }
  return data
}

function playerDisplayName(p: SleeperPlayer | undefined, fallbackId: string): string {
  if (!p) return fallbackId
  if (p.full_name) return p.full_name
  if (p.first_name || p.last_name) return `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
  return fallbackId
}

function playerShortName(p: SleeperPlayer | undefined, fallbackId: string): string {
  if (!p) return fallbackId
  if (p.position === 'DEF') return playerDisplayName(p, fallbackId)
  if (p.first_name && p.last_name) return `${p.first_name[0]}. ${p.last_name}`
  return playerDisplayName(p, fallbackId)
}

export function playerPhotoUrl(playerId: string, position: string | null): string {
  if (position === 'DEF') return `https://sleepercdn.com/images/team_logos/nfl/${playerId.toLowerCase()}.png`
  return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`
}

const BENCH_SLOTS = new Set(['BN', 'IR', 'TAXI'])

export function starterSlotLabels(rosterPositions: string[]): string[] {
  return rosterPositions.filter(p => !BENCH_SLOTS.has(p))
}

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

export interface StarterRow {
  slot: string
  playerId: string
  name: string
  position: string
  team: string | null
  points: number
}

export interface MatchupSide {
  teamName: string
  owner: string
  avatar: string | null
  score: number
  record: string
  starters: StarterRow[]
}

export interface FantasyMatchup {
  matchupId: number
  home: MatchupSide
  away: MatchupSide
}

export async function getFantasyMatchups(
  leagueId: string,
  week: number,
  rosterPositions: string[],
): Promise<FantasyMatchup[]> {
  const [users, rosters, matchups, players] = await Promise.all([
    getLeagueUsers(leagueId),
    getLeagueRosters(leagueId),
    getMatchups(leagueId, week),
    getAllPlayers(),
  ])

  const slots = starterSlotLabels(rosterPositions)
  const usersById = new Map(users.map(u => [u.user_id, u]))
  const rostersById = new Map(rosters.map(r => [r.roster_id, r]))

  const byMatchupId = new Map<number, SleeperMatchup[]>()
  for (const m of matchups) {
    if (m.matchup_id == null) continue
    const group = byMatchupId.get(m.matchup_id) ?? []
    group.push(m)
    byMatchupId.set(m.matchup_id, group)
  }

  const buildStarters = (m: SleeperMatchup): StarterRow[] =>
    (m.starters ?? []).map((playerId, i) => {
      const player = players[playerId]
      const position = player?.position ?? slots[i] ?? '—'
      return {
        slot: slots[i] ?? position,
        playerId,
        name: playerShortName(player, playerId),
        position,
        team: player?.team ?? null,
        points: m.starters_points?.[i] ?? 0,
      }
    })

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
        starters: buildStarters(m),
      }
    })
    result.push({ matchupId, home: sides[0], away: sides[1] })
  }

  return result.sort((a, b) => a.matchupId - b.matchupId)
}

export function currentFantasyWeek(state: SleeperNflState): number {
  return state.season_type === 'regular' ? state.display_week : 1
}
