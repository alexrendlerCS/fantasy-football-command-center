'use client'

import { useEffect, useMemo, useState } from 'react'
import { Trophy, Zap } from 'lucide-react'
import type { FantasyMatchup, MatchupSide, StarterRow } from '@/lib/sleeper'
import { playerPhotoUrl } from '@/lib/sleeper'
import { useLiveLeague } from '@/lib/use-live-league'

const DWELL_MS = 7_500
const TOAST_INTERVAL_MS = 8_000

const POSITION_COLORS: Record<string, string> = {
  QB: '#e5484d',
  RB: '#30a46c',
  WR: '#3b9eff',
  TE: '#f5a623',
  DEF: '#8fa4c2',
  K: '#a78bfa',
}
const positionColor = (pos: string) => POSITION_COLORS[pos] ?? '#5f7ca5'

type Screen = { kind: 'overview' } | { kind: 'detail'; matchup: FantasyMatchup }

type PlayerHit = StarterRow & { teamName: string; owner: string; avatar: string | null; matchupId: number }

function winPct(record: string): number {
  const [wins, losses] = record.split('-').map(Number)
  const total = wins + losses
  return total > 0 ? wins / total : 0
}

function computeHighlights(matchups: FantasyMatchup[]) {
  const anyLive = matchups.some(m => m.home.score > 0 || m.away.score > 0)
  if (!anyLive) return { anyLive: false as const }

  let topScorer: { matchupId: number; side: MatchupSide } | null = null
  let topPlayer: PlayerHit | null = null

  for (const m of matchups) {
    for (const side of [m.home, m.away]) {
      if (!topScorer || side.score > topScorer.side.score) topScorer = { matchupId: m.matchupId, side }
      for (const s of side.starters) {
        if (!topPlayer || s.points > topPlayer.points) {
          topPlayer = { ...s, teamName: side.teamName, owner: side.owner, avatar: side.avatar, matchupId: m.matchupId }
        }
      }
    }
  }

  const liveMatchups = matchups.filter(m => m.home.score > 0 || m.away.score > 0)
  const withDiff = liveMatchups.map(m => ({ m, diff: Math.abs(m.home.score - m.away.score) }))
  const biggestBlowout = withDiff.reduce<(typeof withDiff)[number] | null>((b, x) => (x.diff > (b?.diff ?? -1) ? x : b), null)
  const closestGame = withDiff.reduce<(typeof withDiff)[number] | null>((b, x) => (b === null || x.diff < b.diff ? x : b), null)

  let biggestUpset: { underdog: MatchupSide; favorite: MatchupSide; leadPts: number; gap: number; matchupId: number } | null = null
  for (const m of liveMatchups) {
    const homeWinPct = winPct(m.home.record)
    const awayWinPct = winPct(m.away.record)
    if (homeWinPct === awayWinPct) continue
    const [favorite, underdog] = homeWinPct > awayWinPct ? [m.home, m.away] : [m.away, m.home]
    if (underdog.score > favorite.score) {
      const gap = Math.abs(homeWinPct - awayWinPct)
      if (!biggestUpset || gap > biggestUpset.gap) {
        biggestUpset = { underdog, favorite, leadPts: underdog.score - favorite.score, gap, matchupId: m.matchupId }
      }
    }
  }

  return { anyLive: true as const, topScorer, topPlayer, biggestBlowout, closestGame, biggestUpset }
}

type Highlights = ReturnType<typeof computeHighlights>

function badgesFor(matchupId: number, h: Highlights): string[] {
  if (!h.anyLive) return []
  const out: string[] = []
  if (h.topScorer?.matchupId === matchupId) out.push('🏆')
  if (h.topPlayer?.matchupId === matchupId) out.push('🔥')
  if (h.biggestBlowout?.m.matchupId === matchupId) out.push('📈')
  if (h.biggestUpset?.matchupId === matchupId) out.push('⚠️')
  return out
}

function highlightFacts(h: Highlights): string[] {
  if (!h.anyLive) return []
  const items: string[] = []
  if (h.topScorer) items.push(`🏆 ${h.topScorer.side.teamName} leads all teams right now with ${h.topScorer.side.score.toFixed(2)} pts`)
  if (h.topPlayer) items.push(`🔥 ${h.topPlayer.name} is the top performer right now with ${h.topPlayer.points.toFixed(2)} pts for ${h.topPlayer.teamName}`)
  if (h.biggestBlowout) {
    const { m, diff } = h.biggestBlowout
    const leader = m.home.score > m.away.score ? m.home : m.away
    const trailer = leader === m.home ? m.away : m.home
    items.push(`📈 Biggest blowout right now: ${leader.teamName} is up ${diff.toFixed(2)} on ${trailer.teamName}`)
  }
  if (h.biggestUpset) {
    const { underdog, favorite, leadPts } = h.biggestUpset
    items.push(`⚠️ Upset alert: ${underdog.teamName} (${underdog.record}) is beating ${favorite.teamName} (${favorite.record}) by ${leadPts.toFixed(2)}`)
  } else if (h.closestGame) {
    const { m, diff } = h.closestGame
    items.push(`😬 Nail-biter right now: ${m.home.teamName} vs ${m.away.teamName}, separated by just ${diff.toFixed(2)}`)
  }
  return items
}

function HighlightToast({ facts }: { facts: string[] }) {
  const [i, setI] = useState(0)

  useEffect(() => {
    setI(0)
    if (facts.length <= 1) return
    const id = setInterval(() => setI(v => (v + 1) % facts.length), TOAST_INTERVAL_MS)
    return () => clearInterval(id)
  }, [facts.length])

  if (facts.length === 0) return null

  return (
    <div className="tv-toast-layer">
      <div key={i} className="tv-toast" style={{ animationDuration: `${TOAST_INTERVAL_MS}ms` }}>{facts[i]}</div>
    </div>
  )
}

function TeamRow({ item }: { item: FantasyMatchup['home'] }) {
  return (
    <div className="tv-team-row">
      <div className="tv-team-avatar">
        {item.avatar ? <img src={item.avatar} alt="" /> : item.owner.slice(0, 1).toUpperCase()}
      </div>
      <div className="tv-team-copy">
        <strong>{item.teamName}</strong>
        <span>{item.owner} · {item.record}</span>
      </div>
      <b className="tv-team-score">{item.score.toFixed(2)}</b>
    </div>
  )
}

function OverviewCard({ item, badges }: { item: FantasyMatchup; badges: string[] }) {
  const isLive = item.home.score > 0 || item.away.score > 0
  const diff = Math.abs(item.home.score - item.away.score)
  return (
    <article className="tv-card">
      <div className="tv-card-top">
        <span>MATCHUP {item.matchupId}</span>
        <div className="tv-card-badges">
          {badges.map((b, i) => <span className="tv-mini-badge" key={i}>{b}</span>)}
          <b>{isLive ? 'LIVE' : 'UPCOMING'}</b>
        </div>
      </div>
      <TeamRow item={item.home} />
      <div className="tv-versus"><span>{item.home.score === item.away.score ? 'TIED' : item.home.score > item.away.score ? 'HOME LEADING' : 'AWAY LEADING'}</span><i /><span>{diff.toFixed(2)} pts</span></div>
      <TeamRow item={item.away} />
    </article>
  )
}

function PlayerCell({ player, align, isTop }: { player: StarterRow | undefined; align: 'left' | 'right'; isTop: boolean }) {
  if (!player) return <div className={`tv-player ${align}`} />
  const photo = <img className="tv-player-photo" src={playerPhotoUrl(player.playerId, player.position)} alt="" />
  const meta = (
    <div className="tv-player-meta">
      <strong>{player.name}</strong>
      <span>{player.position}{player.team ? ` · ${player.team}` : ''}</span>
    </div>
  )
  return (
    <div className={`tv-player ${align} ${isTop ? 'top-performer' : ''}`}>
      {align === 'left' && photo}
      {meta}
      <b className="tv-player-points">{player.points.toFixed(2)}</b>
      {align === 'right' && photo}
    </div>
  )
}

function DetailScreen({ item, highlights }: { item: FantasyMatchup; highlights: Highlights }) {
  const isLive = item.home.score > 0 || item.away.score > 0
  const yetHome = item.home.starters.filter(s => s.points === 0).length
  const yetAway = item.away.starters.filter(s => s.points === 0).length
  const rowCount = Math.max(item.home.starters.length, item.away.starters.length)

  const isBlowout = highlights.anyLive && highlights.biggestBlowout?.m.matchupId === item.matchupId
  const isUpset = highlights.anyLive && highlights.biggestUpset?.matchupId === item.matchupId
  const topPlayerId = highlights.anyLive && highlights.topPlayer && highlights.topPlayer.matchupId === item.matchupId
    ? highlights.topPlayer.playerId
    : undefined

  return (
    <div className="tv-detail">
      {(isUpset || isBlowout) && (
        <div className={`tv-detail-banner ${isUpset ? 'upset' : ''}`}>
          {isUpset ? '⚠️ UPSET IN PROGRESS' : '📈 BIGGEST BLOWOUT RIGHT NOW'}
        </div>
      )}
      <div className="tv-detail-header">
        <div className="tv-team-block">
          <div className="tv-team-avatar-lg">{item.home.avatar ? <img src={item.home.avatar} alt="" /> : item.home.owner.slice(0, 1).toUpperCase()}</div>
          <div className="tv-team-meta">
            <span className="tv-owner">@{item.home.owner}</span>
            <strong>{item.home.teamName}</strong>
            <span className="tv-record">{item.home.record}</span>
          </div>
        </div>
        <div className="tv-score-block">
          <b>{item.home.score.toFixed(2)}</b>
          <span className={`tv-status ${isLive ? 'live' : ''}`}>{isLive ? 'LIVE' : 'UPCOMING'}</span>
          <b>{item.away.score.toFixed(2)}</b>
        </div>
        <div className="tv-team-block right">
          <div className="tv-team-meta">
            <span className="tv-owner">@{item.away.owner}</span>
            <strong>{item.away.teamName}</strong>
            <span className="tv-record">{item.away.record}</span>
          </div>
          <div className="tv-team-avatar-lg">{item.away.avatar ? <img src={item.away.avatar} alt="" /> : item.away.owner.slice(0, 1).toUpperCase()}</div>
        </div>
      </div>
      <div className="tv-yet-row">
        <span>Yet to play ({yetHome})</span>
        <span>STARTERS</span>
        <span>Yet to play ({yetAway})</span>
      </div>
      <div className="tv-starters-list">
        {Array.from({ length: rowCount }).map((_, i) => {
          const home = item.home.starters[i]
          const away = item.away.starters[i]
          const badgePos = home?.position ?? away?.position ?? '—'
          return (
            <div className="tv-starter-row" key={i}>
              <PlayerCell player={home} align="left" isTop={home?.playerId === topPlayerId} />
              <span className="tv-slot-badge" style={{ background: positionColor(badgePos) }}>{badgePos}</span>
              <PlayerCell player={away} align="right" isTop={away?.playerId === topPlayerId} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Dashboard(props: {
  leagueName: string
  week: number
  matchups: FantasyMatchup[]
}) {
  const { leagueName, week, matchups } = useLiveLeague(props)

  const screens: Screen[] = useMemo(
    () => [{ kind: 'overview' as const }, ...matchups.map(m => ({ kind: 'detail' as const, matchup: m }))],
    [matchups],
  )

  const highlights = useMemo(() => computeHighlights(matchups), [matchups])
  const facts = useMemo(() => highlightFacts(highlights), [highlights])
  const tickerText = facts.length > 0
    ? facts.join('     •     ')
    : `Data synced live from Sleeper for ${leagueName}, Week ${week}`

  const [index, setIndex] = useState(0)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setIndex(i => (i + 1) % screens.length), DWELL_MS)
    return () => clearInterval(id)
  }, [screens.length])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(id)
  }, [])

  // Silk (Fire TV) hides its address bar on scroll; do it programmatically so no remote input is needed.
  useEffect(() => {
    const t = setTimeout(() => window.scrollTo(0, 80), 400)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    let lock: any
    ;(navigator as any).wakeLock?.request?.('screen').then((l: any) => { lock = l }).catch(() => {})
    return () => lock?.release?.().catch(() => {})
  }, [])

  // A backgrounded Fire TV browser tab resumes instead of reloading, so it can keep
  // running a stale JS bundle indefinitely. Force a full reload periodically so it
  // picks up new deploys on its own.
  useEffect(() => {
    const id = setTimeout(() => window.location.reload(), 30 * 60 * 1000)
    return () => clearTimeout(id)
  }, [])

  const screen = screens[index]
  const clock = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="tv-shell">
      <header className="tv-topbar">
        <div className="tv-brand">
          <div className="tv-brand-mark"><Trophy /></div>
          <div className="tv-league"><b>{leagueName}</b><span>Fantasy Football · Week {week}</span></div>
        </div>
        <div className="tv-clock">{clock}</div>
      </header>
      <div className="tv-progress">
        <div key={index} className="tv-progress-bar" style={{ animationDuration: `${DWELL_MS}ms` }} />
      </div>
      <main className="tv-main">
        {screen.kind === 'overview' ? (
          <div className="tv-overview-grid">
            {matchups.map(item => <OverviewCard key={item.matchupId} item={item} badges={badgesFor(item.matchupId, highlights)} />)}
          </div>
        ) : (
          <DetailScreen item={screen.matchup} highlights={highlights} />
        )}
      </main>
      <HighlightToast facts={facts} />
      <footer className="tv-footer">
        <div className="tv-footer-label"><Zap /> Live</div>
        <div className="tv-ticker-viewport">
          <div className="tv-ticker-track">
            <span>{tickerText}</span>
            <span aria-hidden="true">{tickerText}</span>
          </div>
        </div>
        <div className="tv-dots">
          {screens.map((_, i) => <span key={i} className={`tv-dot ${i === index ? 'active' : ''}`} />)}
        </div>
      </footer>
      <div className="tv-scroll-spacer" />
    </div>
  )
}
