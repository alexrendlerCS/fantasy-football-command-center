const ESPN_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'

export interface EspnTeamScore {
  displayName: string
  abbreviation: string
  score: number
}

export interface EspnGame {
  id: string
  shortName: string
  state: 'pre' | 'in' | 'post'
  statusDetail: string
  commenceTime: string
  home: EspnTeamScore
  away: EspnTeamScore
}

export interface TeamSchedule {
  opponent: string
  isHome: boolean
  commenceTime: string
  state: 'pre' | 'in' | 'post'
  statusDetail: string
}

// The only team-abbreviation mismatch between Sleeper's player data and ESPN's
// scoreboard (confirmed by comparing both APIs' full team lists directly).
const TEAM_ALIASES: Record<string, string> = { WAS: 'WSH' }

export function normalizeTeamAbbr(abbr: string): string {
  return TEAM_ALIASES[abbr] ?? abbr
}

export function buildTeamSchedule(games: EspnGame[]): Record<string, TeamSchedule> {
  const map: Record<string, TeamSchedule> = {}
  for (const g of games) {
    map[g.home.abbreviation] = { opponent: g.away.abbreviation, isHome: true, commenceTime: g.commenceTime, state: g.state, statusDetail: g.statusDetail }
    map[g.away.abbreviation] = { opponent: g.home.abbreviation, isHome: false, commenceTime: g.commenceTime, state: g.state, statusDetail: g.statusDetail }
  }
  return map
}

export async function getEspnScoreboard(): Promise<EspnGame[]> {
  const res = await fetch(ESPN_SCOREBOARD_URL, { next: { revalidate: 30 } })
  if (!res.ok) throw new Error(`ESPN scoreboard error: ${res.status}`)
  const data = await res.json()

  return (data.events ?? []).map((e: any) => {
    const comp = e.competitions[0]
    const home = comp.competitors.find((c: any) => c.homeAway === 'home')
    const away = comp.competitors.find((c: any) => c.homeAway === 'away')
    return {
      id: e.id,
      shortName: e.shortName,
      state: comp.status.type.state,
      statusDetail: comp.status.type.shortDetail ?? comp.status.type.description,
      commenceTime: e.date,
      home: { displayName: home.team.displayName, abbreviation: home.team.abbreviation, score: Number(home.score ?? 0) },
      away: { displayName: away.team.displayName, abbreviation: away.team.abbreviation, score: Number(away.score ?? 0) },
    } satisfies EspnGame
  })
}
