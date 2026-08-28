'use client'

import { useEffect, useMemo, useState } from 'react'
import { Trophy, Zap } from 'lucide-react'
import type { FantasyMatchup, StarterRow } from '@/lib/sleeper'
import { playerPhotoUrl } from '@/lib/sleeper'
import { useLiveLeague } from '@/lib/use-live-league'

const DWELL_MS = 7_500

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

function OverviewCard({ item }: { item: FantasyMatchup }) {
  const isLive = item.home.score > 0 || item.away.score > 0
  const diff = Math.abs(item.home.score - item.away.score)
  return (
    <article className="tv-card">
      <div className="tv-card-top"><span>MATCHUP {item.matchupId}</span><b>{isLive ? 'LIVE' : 'UPCOMING'}</b></div>
      <TeamRow item={item.home} />
      <div className="tv-versus"><span>{item.home.score === item.away.score ? 'TIED' : item.home.score > item.away.score ? 'HOME LEADING' : 'AWAY LEADING'}</span><i /><span>{diff.toFixed(2)} pts</span></div>
      <TeamRow item={item.away} />
    </article>
  )
}

function PlayerCell({ player, align }: { player: StarterRow | undefined; align: 'left' | 'right' }) {
  if (!player) return <div className={`tv-player ${align}`} />
  const photo = <img className="tv-player-photo" src={playerPhotoUrl(player.playerId, player.position)} alt="" />
  const meta = (
    <div className="tv-player-meta">
      <strong>{player.name}</strong>
      <span>{player.position}{player.team ? ` · ${player.team}` : ''}</span>
    </div>
  )
  return (
    <div className={`tv-player ${align}`}>
      {align === 'left' && photo}
      {meta}
      <b className="tv-player-points">{player.points.toFixed(2)}</b>
      {align === 'right' && photo}
    </div>
  )
}

function DetailScreen({ item }: { item: FantasyMatchup }) {
  const isLive = item.home.score > 0 || item.away.score > 0
  const yetHome = item.home.starters.filter(s => s.points === 0).length
  const yetAway = item.away.starters.filter(s => s.points === 0).length
  const rowCount = Math.max(item.home.starters.length, item.away.starters.length)

  return (
    <div className="tv-detail">
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
              <PlayerCell player={home} align="left" />
              <span className="tv-slot-badge" style={{ background: positionColor(badgePos) }}>{badgePos}</span>
              <PlayerCell player={away} align="right" />
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
            {matchups.map(item => <OverviewCard key={item.matchupId} item={item} />)}
          </div>
        ) : (
          <DetailScreen item={screen.matchup} />
        )}
      </main>
      <footer className="tv-footer">
        <div className="tv-footer-label"><Zap /> Live</div>
        <p className="tv-footer-text">Data synced live from Sleeper for <b>{leagueName}</b>, Week {week}</p>
        <div className="tv-dots">
          {screens.map((_, i) => <span key={i} className={`tv-dot ${i === index ? 'active' : ''}`} />)}
        </div>
      </footer>
      <div className="tv-scroll-spacer" />
    </div>
  )
}
