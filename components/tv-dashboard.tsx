'use client'

import { useEffect, useMemo, useState } from 'react'
import { Trophy, Zap } from 'lucide-react'
import type { FantasyMatchup } from '@/lib/sleeper'
import { useLiveLeague } from '@/lib/use-live-league'

const TOTAL_CYCLE_MS = 120_000

type Screen = { kind: 'overview' } | { kind: 'pair'; items: FantasyMatchup[] }

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

function MatchupCard({ item }: { item: FantasyMatchup }) {
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

export default function TvDashboard(props: {
  leagueName: string
  week: number
  matchups: FantasyMatchup[]
}) {
  const { leagueName, week, matchups } = useLiveLeague(props)

  const screens: Screen[] = useMemo(() => {
    const pairs: FantasyMatchup[][] = []
    for (let i = 0; i < matchups.length; i += 2) pairs.push(matchups.slice(i, i + 2))
    return [{ kind: 'overview' as const }, ...pairs.map(items => ({ kind: 'pair' as const, items }))]
  }, [matchups])

  const dwellMs = TOTAL_CYCLE_MS / screens.length
  const [index, setIndex] = useState(0)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setIndex(i => (i + 1) % screens.length), dwellMs)
    return () => clearInterval(id)
  }, [dwellMs, screens.length])

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
        <div key={index} className="tv-progress-bar" style={{ animationDuration: `${dwellMs}ms` }} />
      </div>
      <main className="tv-main">
        {screen.kind === 'overview' ? (
          <div className="tv-overview-grid">
            {matchups.map(item => <MatchupCard key={item.matchupId} item={item} />)}
          </div>
        ) : (
          <div className="tv-pair-grid">
            {screen.items.map(item => <MatchupCard key={item.matchupId} item={item} />)}
          </div>
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
