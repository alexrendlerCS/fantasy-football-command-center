const ODDS_API_URL = 'https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds'

// the-odds-api free tier is 500 credits/month, 1 credit per market per region per call.
// We request a single market (spreads) in a single region (us) = 1 credit/call. Fetching
// only ever happens through getOddsSnapshots below, which self-throttles: every 15 minutes
// while a game is actually live, every 60 minutes otherwise. At NFL's normal ~17.5 live
// broadcast hours/week that's roughly ~300 credits/month, comfortably under the cap.
const LIVE_TTL_MS = 15 * 60 * 1000
const IDLE_TTL_MS = 60 * 60 * 1000

export interface OddsSnapshot {
  homeTeam: string
  awayTeam: string
  favoredTeam: string | null
  favoredBy: number | null
}

let cache: { data: OddsSnapshot[]; fetchedAt: number } | null = null

export async function getOddsSnapshots(anyLive: boolean): Promise<OddsSnapshot[]> {
  const apiKey = process.env.ODDS_API_KEY
  if (!apiKey) return []

  const ttl = anyLive ? LIVE_TTL_MS : IDLE_TTL_MS
  if (cache && Date.now() - cache.fetchedAt < ttl) return cache.data

  const url = `${ODDS_API_URL}?apiKey=${apiKey}&regions=us&markets=spreads&oddsFormat=american`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    // Keep serving the last good snapshot (if any) rather than breaking the whole page
    // over a transient odds-api error or an exhausted monthly credit budget.
    return cache?.data ?? []
  }

  const data = (await res.json()) as any[]
  const snapshots: OddsSnapshot[] = data.map(g => {
    const market = g.bookmakers?.[0]?.markets?.find((m: any) => m.key === 'spreads')
    const homeOutcome = market?.outcomes?.find((o: any) => o.name === g.home_team)
    const homeSpread: number | null = homeOutcome?.point ?? null

    let favoredTeam: string | null = null
    let favoredBy: number | null = null
    if (homeSpread != null && homeSpread !== 0) {
      favoredTeam = homeSpread < 0 ? g.home_team : g.away_team
      favoredBy = Math.abs(homeSpread)
    }

    return { homeTeam: g.home_team, awayTeam: g.away_team, favoredTeam, favoredBy }
  })

  cache = { data: snapshots, fetchedAt: Date.now() }
  return snapshots
}
