import { getPlayerPointsForWeek, type SleeperPlayer } from '@/lib/sleeper'

export interface PlayerProjection {
  mean: number
  stdDev: number
}

const HISTORY_TTL_MS = 6 * 60 * 60 * 1000
let historyCache: { leagueId: string; throughWeek: number; data: Map<string, number[]>; fetchedAt: number } | null = null

// Every completed week's players_points, merged into a per-player score history for
// this season so far. Cached for 6h since it only changes once a new week finishes —
// no reason to re-pull every 30s poll like the live data.
export async function getPlayerHistory(leagueId: string, currentWeek: number): Promise<Map<string, number[]>> {
  const throughWeek = currentWeek - 1
  if (throughWeek < 1) return new Map()

  if (
    historyCache &&
    historyCache.leagueId === leagueId &&
    historyCache.throughWeek === throughWeek &&
    Date.now() - historyCache.fetchedAt < HISTORY_TTL_MS
  ) {
    return historyCache.data
  }

  const weeks = await Promise.all(
    Array.from({ length: throughWeek }, (_, i) => i + 1).map(w => getPlayerPointsForWeek(leagueId, w)),
  )

  const history = new Map<string, number[]>()
  for (const weekPoints of weeks) {
    for (const [playerId, points] of Object.entries(weekPoints)) {
      const arr = history.get(playerId) ?? []
      arr.push(points)
      history.set(playerId, arr)
    }
  }

  historyCache = { leagueId, throughWeek, data: history, fetchedAt: Date.now() }
  return history
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function stdDev(values: number[], m: number): number | null {
  if (values.length < 2) return null
  const variance = values.reduce((sum, x) => sum + (x - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

export interface ProjectionModel {
  perPlayer: Map<string, PlayerProjection>
  perPosition: Record<string, PlayerProjection>
}

const GENERIC_DEFAULT: PlayerProjection = { mean: 6, stdDev: 5 }

// Empirical-Bayes-style shrinkage: a player's own history gets more weight the more
// games of it exist; with little/no history, their projection leans on their
// position's league-wide average instead (so a rookie or Week 1 doesn't get "0").
const PRIOR_STRENGTH = 3

export function buildProjectionModel(
  history: Map<string, number[]>,
  players: Record<string, SleeperPlayer>,
): ProjectionModel {
  const positionValues: Record<string, number[]> = {}
  for (const [playerId, scores] of history) {
    const pos = players[playerId]?.position
    if (!pos) continue
    ;(positionValues[pos] ??= []).push(...scores)
  }

  const perPosition: Record<string, PlayerProjection> = {}
  for (const [pos, values] of Object.entries(positionValues)) {
    const m = mean(values)
    perPosition[pos] = { mean: m, stdDev: stdDev(values, m) ?? Math.max(4, m * 0.6) }
  }

  const perPlayer = new Map<string, PlayerProjection>()
  for (const [playerId, scores] of history) {
    const pos = players[playerId]?.position ?? ''
    const prior = perPosition[pos] ?? GENERIC_DEFAULT
    const n = scores.length
    const personalMean = mean(scores)
    const blendedMean = (n * personalMean + PRIOR_STRENGTH * prior.mean) / (n + PRIOR_STRENGTH)
    const personalStd = stdDev(scores, personalMean)
    const blendedStd = n >= 2 ? personalStd! : prior.stdDev
    perPlayer.set(playerId, { mean: blendedMean, stdDev: blendedStd })
  }

  return { perPlayer, perPosition }
}

export function projectionFor(playerId: string, position: string, model: ProjectionModel): PlayerProjection {
  return model.perPlayer.get(playerId) ?? model.perPosition[position] ?? GENERIC_DEFAULT
}
