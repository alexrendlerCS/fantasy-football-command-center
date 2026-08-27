'use client'

import { useMemo, useState } from 'react'
import { Bell, ChevronDown, CircleHelp, Flame, Search, Settings, Trophy, Users, Zap, Plus } from 'lucide-react'
import type { FantasyMatchup } from '@/lib/sleeper'

const games = [['DAL', 'NYG', '24', '17', 'Q3 · 4:21'], ['CIN', 'BAL', '21', '20', 'Q4 · 8:14'], ['KC', 'BUF', '10', '13', 'HALFTIME'], ['SF', 'MIN', '17', '14', 'Q2 · 0:42'], ['MIA', 'NYJ', '7', '3', 'Q1 · 6:18'], ['DET', 'CHI', '31', '10', 'FINAL']]

function TeamLine({ teamName: name, owner, record, score, avatar, index }: { teamName: string; owner: string; record: string; score: number; avatar: string | null; index: number }) {
  return (
    <div className="team-line">
      <div className={`team-avatar avatar-${index % 6}`}>
        {avatar ? <img src={avatar} alt="" /> : owner.slice(0, 1).toUpperCase()}
      </div>
      <div className="team-copy">
        <strong>{name}</strong>
        <span>{owner} · {record}</span>
      </div>
      <b className="score">{score.toFixed(2)}</b>
    </div>
  )
}

function MatchupCard({ item, index, isHighestScoring }: { item: FantasyMatchup; index: number; isHighestScoring: boolean }) {
  const isLive = item.home.score > 0 || item.away.score > 0
  const leading = item.home.score === item.away.score ? null : item.home.score > item.away.score ? item.home : item.away
  const diff = Math.abs(item.home.score - item.away.score)
  return (
    <article className="matchup-card">
      <div className="card-top">
        <span>MATCHUP {item.matchupId}</span>
        <b>{isLive ? 'LIVE' : 'UPCOMING'}</b>
      </div>
      <TeamLine {...item.home} index={index * 2} />
      <div className="versus">
        <span>{leading ? (leading === item.home ? 'HOME LEADING' : 'AWAY LEADING') : 'TIED'}</span>
        <i />
        <span>{diff.toFixed(2)} pts</span>
      </div>
      <TeamLine {...item.away} index={index * 2 + 1} />
      <div className="card-bottom">
        <span><Flame /> {isHighestScoring ? 'HIGHEST SCORING' : 'LEAGUE MATCHUP'}</span>
        <span>View matchup <ChevronDown /></span>
      </div>
    </article>
  )
}

export default function Dashboard({
  leagueName,
  week,
  matchups,
}: {
  leagueName: string
  week: number
  matchups: FantasyMatchup[]
}) {
  const [activeTab, setActiveTab] = useState('Scores')
  const [settings, setSettings] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const time = useMemo(() => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), [])
  const today = useMemo(() => new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase(), [])

  const highestScoringId = useMemo(() => {
    let bestId: number | null = null
    let bestTotal = 0
    for (const m of matchups) {
      const total = m.home.score + m.away.score
      if (total > bestTotal) {
        bestTotal = total
        bestId = m.matchupId
      }
    }
    return bestTotal > 0 ? bestId : null
  }, [matchups])

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><Trophy /></div><span>THE LEAGUE</span></div>
        <nav className="main-nav" aria-label="Main navigation">{['Scores', 'Matchups', 'Players', 'News'].map(tab => <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav>
        <div className="top-actions"><button aria-label="Search" onClick={() => setSearchOpen(!searchOpen)}><Search /></button><button aria-label="Notifications"><Bell /></button><button className="profile"><span>TM</span><ChevronDown /></button></div>
      </header>
      <div className="subnav">
        <div className="league-selector"><span className="league-icon"><Trophy /></span><div><b>{leagueName}</b><small>Fantasy Football · Week {week}</small></div><ChevronDown /></div>
        <div className="sport-tabs"><button className="selected">NFL</button><button>NBA</button><button>MLB</button></div>
        <button className="invite"><Plus /> Invite friends</button>
      </div>
      {searchOpen && <div className="search-bar"><Search /><input autoFocus placeholder="Search players, leagues, or teams" /></div>}
      <div className="page-wrap">
        <section className="hero-row">
          <div><p className="eyebrow">{today}</p><h1>{activeTab === 'Scores' ? 'Scores' : activeTab}</h1><p className="intro">Follow every matchup, player, and moment from your league.</p></div>
          <button className="week-picker">Week {week} <ChevronDown /></button>
        </section>
        <div className="content-grid">
          <section>
            <div className="section-heading"><div><h2>Fantasy matchups</h2><span>{matchups.length} matchups · Updated just now</span></div><button className="filter"><Users /> My league</button></div>
            <div className="matchup-grid">
              {matchups.map((item, index) => <MatchupCard key={item.matchupId} item={item} index={index} isHighestScoring={item.matchupId === highestScoringId} />)}
            </div>
          </section>
          <aside className="live-panel">
            <div className="section-heading"><div><h2><span className="live-dot" /> NFL live</h2><span>Games happening now</span></div><CircleHelp /></div>
            <div className="games-list">{games.map((game, i) => <div className={`game-card ${game[4] === 'FINAL' ? 'final' : ''}`} key={i}><div className="game-meta"><span>{game[4] === 'FINAL' ? 'FINAL' : 'LIVE'}</span><small>{game[4]}</small></div><div className="game-team"><b>{game[0]}</b><strong>{game[2]}</strong></div><div className="game-team"><b>{game[1]}</b><strong>{game[3]}</strong></div></div>)}</div>
            <button className="all-games">See all games <ChevronDown /></button>
          </aside>
        </div>
      </div>
      <footer className="ticker"><div><Zap /> Live activity</div><p>Data synced live from Sleeper for <b>{leagueName}</b>, Week {week}</p><span>{time}</span></footer>
      {settings && <div className="drawer-backdrop" onClick={() => setSettings(false)}><aside className="settings-drawer" onClick={e => e.stopPropagation()}><div className="drawer-head"><h2>Settings</h2><button onClick={() => setSettings(false)}>×</button></div><label>League <select><option>{leagueName}</option></select></label><label>Appearance <select><option>Dark blue</option></select></label><label className="switch-row">Show live activity <input type="checkbox" defaultChecked /></label></aside></div>}
      <button className="floating-settings" aria-label="Open settings" onClick={() => setSettings(true)}><Settings /></button>
    </main>
  )
}
