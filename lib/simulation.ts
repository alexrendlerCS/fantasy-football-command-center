import type { FantasyMatchup, StarterRow } from '@/lib/sleeper'
import { normalizeTeamAbbr, type TeamSchedule } from '@/lib/espn'
import { projectionFor, type ProjectionModel } from '@/lib/projections'

export interface WinProbability {
  home: number
  away: number
}

const TRIALS = 3000

function randomNormal(mean: number, stdDev: number): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return mean + z * stdDev
}

// A player's game already underway or finished is locked to their actual points —
// only players who haven't kicked off yet get simulated from their projection.
function hasStarted(player: StarterRow, schedule: Record<string, TeamSchedule>): boolean {
  const game = player.team ? schedule[normalizeTeamAbbr(player.team)] : undefined
  return game ? game.state !== 'pre' : true
}

function simulateSideTotal(starters: StarterRow[], schedule: Record<string, TeamSchedule>, model: ProjectionModel): number {
  let total = 0
  for (const s of starters) {
    if (hasStarted(s, schedule)) {
      total += s.points
    } else {
      const proj = projectionFor(s.playerId, s.position, model)
      total += randomNormal(proj.mean, proj.stdDev)
    }
  }
  return total
}

export function simulateMatchup(matchup: FantasyMatchup, schedule: Record<string, TeamSchedule>, model: ProjectionModel): WinProbability {
  let homeWins = 0
  let awayWins = 0
  for (let i = 0; i < TRIALS; i++) {
    const homeTotal = simulateSideTotal(matchup.home.starters, schedule, model)
    const awayTotal = simulateSideTotal(matchup.away.starters, schedule, model)
    if (homeTotal > awayTotal) homeWins += 1
    else if (awayTotal > homeTotal) awayWins += 1
    else {
      homeWins += 0.5
      awayWins += 0.5
    }
  }
  return { home: homeWins / TRIALS, away: awayWins / TRIALS }
}
