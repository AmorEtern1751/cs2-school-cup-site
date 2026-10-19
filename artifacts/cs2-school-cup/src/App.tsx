import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter, Link } from 'wouter';
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Copy,
  Crosshair,
  ExternalLink,
  Flame,
  Info,
  Key,
  Lock,
  LogOut,
  Play,
  Radio,
  Save,
  Server,
  Shield,
  Square,
  Swords,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import {
  initialState,
  LiveEvent,
  LiveMatchState,
  LivePlayer,
  Match,
  MatchStatus,
  PlayerStat,
  resolveMatch,
  RoundKey,
  roundNames,
  scoreLabel,
  ServerSettings,
  Team,
  TournamentState,
} from './tournament';

const queryClient = new QueryClient();
type Filter = 'Все' | MatchStatus;
type AdminTab = 'server' | 'matches' | 'teams' | 'players';

const defaultLiveState: LiveMatchState = {
  serverConnected: false,
  lastHeartbeat: 0,
  serverName: 'Школьный CS2 Сервер',
  matchId: 'm5',
  map: 'de_ancient',
  currentRound: 19,
  phase: 'live',
  teamCT: { name: 'Эхо улиц', score: 7 },
  teamT: { name: 'Тихий пик', score: 10 },
  bomb: { state: null, site: null, plantedAt: null, planterName: null },
  players: [],
  roundHistory: [],
  recentEvents: [],
  isSimulating: false,
};

function useTournament(adminToken?: string) {
  const [state, setState] = useState<TournamentState>(initialState);
  const [loading, setLoading] = useState(true);

  // Fetch initial tournament data from API
  useEffect(() => {
    fetch('/api/tournament')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data && Array.isArray(data.teams) && Array.isArray(data.matches)) {
          setState(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateMatch = async (id: string, patch: Partial<Match>) => {
    setState(current => ({
      ...current,
      matches: current.matches.map(match => (match.id === id ? { ...match, ...patch } : match)),
    }));
    try {
      await fetch(`/api/tournament/match/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'X-Admin-Password': adminToken } : {}),
        },
        body: JSON.stringify(patch),
      });
    } catch {}
  };

  const updateTeam = async (id: string, patch: Partial<Team>) => {
    setState(current => ({
      ...current,
      teams: current.teams.map(team => (team.id === id ? { ...team, ...patch } : team)),
    }));
    try {
      await fetch(`/api/tournament/team/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'X-Admin-Password': adminToken } : {}),
        },
        body: JSON.stringify(patch),
      });
    } catch {}
  };

  const reset = async () => {
    setState(initialState);
    try {
      const res = await fetch('/api/tournament/reset', {
        method: 'POST',
        headers: adminToken ? { 'X-Admin-Password': adminToken } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch {}
  };

  return { state, setState, updateMatch, updateTeam, reset, loading };
}

function useLiveMatch(adminToken?: string, onTournamentUpdate?: (t: TournamentState) => void) {
  const [live, setLive] = useState<LiveMatchState>(defaultLiveState);
  const [settings, setSettings] = useState<ServerSettings>({
    serverToken: 'cs2-school-cup-secret-2026',
    activeMatchId: 'm5',
  });
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Initial fetch of live match and settings
    fetch('/api/live')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data) setLive(data);
      })
      .catch(() => {});

    fetch('/api/admin/settings', {
      headers: adminToken ? { 'X-Admin-Password': adminToken } : {},
    })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data) setSettings(data);
      })
      .catch(() => {});

    // Connect to SSE stream
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/live/stream');
      eventSourceRef.current = es;

      es.onopen = () => setConnected(true);
      es.onerror = () => setConnected(false);

      es.addEventListener('init', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.live) setLive(data.live);
          if (data.settings) setSettings(data.settings);
          if (data.tournament && onTournamentUpdate) onTournamentUpdate(data.tournament);
        } catch {}
      });

      es.addEventListener('live_update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setLive(data);
        } catch {}
      });

      es.addEventListener('tournament_update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (onTournamentUpdate) onTournamentUpdate(data);
        } catch {}
      });

      es.addEventListener('game_event', (e: MessageEvent) => {
        try {
          const event: LiveEvent = JSON.parse(e.data);
          setLive(prev => ({
            ...prev,
            recentEvents: [event, ...prev.recentEvents.slice(0, 19)],
          }));
        } catch {}
      });

      es.addEventListener('settings_update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setSettings(data);
        } catch {}
      });
    } catch {
      setConnected(false);
    }

    return () => {
      es?.close();
    };
  }, [adminToken, onTournamentUpdate]);

  const startSimulation = async () => {
    try {
      await fetch('/api/admin/simulate/start', {
        method: 'POST',
        headers: adminToken ? { 'X-Admin-Password': adminToken } : {},
      });
    } catch {}
  };

  const stopSimulation = async () => {
    try {
      await fetch('/api/admin/simulate/stop', {
        method: 'POST',
        headers: adminToken ? { 'X-Admin-Password': adminToken } : {},
      });
    } catch {}
  };

  const updateServerSettings = async (patch: Partial<ServerSettings>) => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'X-Admin-Password': adminToken } : {}),
        },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch {}
  };

  const changeAdminPassword = async (newPassword: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'X-Admin-Password': adminToken } : {}),
        },
        body: JSON.stringify({ newPassword }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  return {
    live,
    settings,
    connected,
    startSimulation,
    stopSimulation,
    updateServerSettings,
    changeAdminPassword,
  };
}

function TeamMark({ team, size = 'normal' }: { team?: Team; size?: 'normal' | 'large' }) {
  return (
    <span
      className={`team-logo ${size === 'large' ? 'team-logo-large' : ''}`}
      style={{ borderColor: team?.color, color: team?.color }}
      data-testid={team ? `team-logo-${team.id}` : 'team-logo-empty'}
    >
      {team?.short ?? '—'}
    </span>
  );
}

function StatusBadge({ status }: { status: MatchStatus }) {
  return (
    <span
      className={`badge ${status === 'LIVE' ? 'live' : status === 'Завершён' ? 'done' : ''}`}
      data-testid={`status-match-${status.toLowerCase().replace('ё', 'e')}`}
    >
      {status === 'LIVE' && <span className="dot-live" />}
      {status}
    </span>
  );
}

function Header({ admin = false, serverConnected = false, isSimulating = false }: { admin?: boolean; serverConnected?: boolean; isSimulating?: boolean }) {
  return (
    <header className="topbar">
      <Link href="/" className="brand" data-testid="link-home">
        <span className="brand-mark">К</span>
        <span>
          КУБОК ШКОЛЫ<small>CS2 · ОСЕННИЙ СЕЗОН 2026</small>
        </span>
      </Link>
      <nav className="navlinks" aria-label="Основная навигация">
        <Link href="/" className={!admin ? 'active' : ''} data-testid="link-tournament">
          Турнир
        </Link>
        <a href="/#arena" data-testid="link-live-arena">
          Live Арена
        </a>
        <a href="/#schedule" data-testid="link-schedule">
          Расписание
        </a>
        <a href="/#bracket" data-testid="link-bracket">
          Сетка
        </a>
        <Link href="/admin" className={admin ? 'active' : ''} data-testid="link-admin">
          Управление
        </Link>
      </nav>
      <div className="nav-meta">
        {serverConnected ? (
          <span className="live-status-pill online" style={{ fontSize: 9, padding: '3px 8px' }}>
            <span className="dot-live" style={{ background: '#22c55e', boxShadow: '0 0 0 4px #22c55e20' }} />
            {isSimulating ? 'СИМУЛЯЦИЯ' : 'CS2 СЕРВЕР ОНЛАЙН'}
          </span>
        ) : (
          <span className="live-status-pill offline" style={{ fontSize: 9, padding: '3px 8px' }}>
            <Radio size={11} /> СЕРВЕР ОЖИДАЕТ СВЯЗИ
          </span>
        )}
      </div>
    </header>
  );
}

/**
 * Real-time CS2 Live Arena Component
 */
function LiveArena({
  live,
  state,
  onOpenMatch,
}: {
  live: LiveMatchState;
  state: TournamentState;
  onOpenMatch: (match: Match) => void;
}) {
  const [showRosters, setShowRosters] = useState(true);
  const activeMatch = state.matches.find(m => m.id === live.matchId) ?? state.matches.find(m => m.status === 'LIVE');
  const pair = activeMatch ? resolveMatch(state, activeMatch) : { a: undefined, b: undefined };

  const ctTeamName = live.teamCT?.name || pair.a?.name || 'Спецназ (CT)';
  const tTeamName = live.teamT?.name || pair.b?.name || 'Террористы (T)';
  const cleanMapName = live.map ? live.map.replace(/^de_/, '').toUpperCase() : 'ANCIENT';

  const ctPlayers = live.players.filter(p => p.team === 'CT');
  const tPlayers = live.players.filter(p => p.team === 'T');

  const latestEvent = live.recentEvents?.[0];

  return (
    <section id="arena" className="live-arena">
      <div className="live-arena-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Flame size={14} color="#f2762c" />
            <span>ПРЯМОЙ ЭФИР С ИГРОВОГО СЕРВЕРА CS2</span>
          </div>
          {live.serverConnected ? (
            <span className="live-status-pill online">
              <span className="dot-live" style={{ background: '#22c55e' }} />
              {live.isSimulating ? 'СИМУЛЯТОР МАТЧА' : 'СЕРВЕР ПОДКЛЮЧЕН'}
            </span>
          ) : (
            <span className="live-status-pill offline">
              <Radio size={12} /> ОФФЛАЙН
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {live.bomb?.state === 'planted' && (
            <div className="live-bomb-alert">
              💣 БОМБА ЗАЛОЖЕНА НА ПЛЕНТЕ {live.bomb.site || 'A'}
              {live.bomb.planterName ? ` (${live.bomb.planterName})` : ''}!
            </div>
          )}
          {activeMatch && (
            <button
              className="soft-btn"
              onClick={() => onOpenMatch(activeMatch)}
              style={{ fontSize: 9, padding: '5px 9px' }}
            >
              Подробнее о матче
            </button>
          )}
        </div>
      </div>

      <div className="live-matchup">
        {/* Team CT */}
        <div className="live-team-side">
          <TeamMark team={pair.a} size="large" />
          <div>
            <div className="live-team-title">{ctTeamName}</div>
            <span className="live-team-role role-ct">COUNTER-TERRORISTS</span>
          </div>
        </div>

        {/* Big Score Center */}
        <div className="live-score-center">
          <div className="live-big-score">
            {live.teamCT?.score ?? 0} <span>:</span> {live.teamT?.score ?? 0}
          </div>
          <div className="live-map-badge">
            КАРТА: <strong>{cleanMapName}</strong> · РАУНД {live.currentRound || 1}
          </div>
        </div>

        {/* Team T */}
        <div className="live-team-side right">
          <div style={{ textAlign: 'right' }}>
            <div className="live-team-title">{tTeamName}</div>
            <span className="live-team-role role-t">TERRORISTS</span>
          </div>
          <TeamMark team={pair.b} size="large" />
        </div>
      </div>

      {/* Round History Timeline */}
      {live.roundHistory && live.roundHistory.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="stat-label" style={{ marginBottom: 6 }}>
            Хроника выигранных раундов:
          </div>
          <div className="round-timeline">
            {live.roundHistory.map((item, idx) => (
              <div
                key={idx}
                className={`round-dot ${item.winner === 'CT' ? 'ct' : 't'}`}
                title={`Раунд ${item.round}: Победа ${item.winner} (${item.reason})`}
              >
                {item.winner}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Kill Feed / Ticker */}
      {latestEvent && (
        <div className="live-ticker-wrap">
          <span className="live-ticker-tag">LIVE FEED</span>
          <span className="live-ticker-text">
            [{latestEvent.time}] {latestEvent.text}
          </span>
        </div>
      )}

      {/* Toggle Rosters Button */}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="soft-btn" onClick={() => setShowRosters(!showRosters)} style={{ fontSize: 9 }}>
          <Users size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />
          {showRosters ? 'Свернуть составы игроков' : 'Показать live-статистику игроков'}
        </button>
        <span style={{ fontSize: 10, color: '#888c93', fontStyle: 'italic' }}>
          * Статистика K/D/A, урон и статус здоровья обновляются из игры в реалтайме
        </span>
      </div>

      {/* 5v5 Live Rosters */}
      {showRosters && live.players.length > 0 && (
        <div className="live-roster-grid">
          {/* CT Table */}
          <div className="panel" style={{ margin: 0 }}>
            <div className="panel-head" style={{ borderBottom: '2px solid #2563eb' }}>
              <h4 style={{ margin: 0, color: '#93c5fd', fontSize: 12 }}>
                {ctTeamName} (Спецназ · CT)
              </h4>
              <span className="stat-label">Живых: {ctPlayers.filter(p => p.isAlive).length} / {ctPlayers.length}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="live-table">
                <thead>
                  <tr>
                    <th>Игрок</th>
                    <th>HP</th>
                    <th>Оружие</th>
                    <th>K / D / A</th>
                    <th>ADR</th>
                    <th>HS%</th>
                    <th>MVP</th>
                  </tr>
                </thead>
                <tbody>
                  {ctPlayers.map(player => (
                    <tr
                      key={player.steamId}
                      className={`live-player-row ${!player.isAlive ? 'dead' : ''}`}
                    >
                      <td>
                        <strong>{player.name}</strong>
                      </td>
                      <td>
                        {player.isAlive ? (
                          <div>
                            <span style={{ fontWeight: 700, color: player.health > 50 ? '#4ade80' : player.health > 20 ? '#facc15' : '#f87171' }}>
                              {player.health}
                            </span>
                            <div className="hp-bar-wrap">
                              <div
                                className={`hp-bar-fill ${player.health > 50 ? 'hp-high' : player.health > 20 ? 'hp-mid' : 'hp-low'}`}
                                style={{ width: `${Math.min(100, player.health)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#ef4444', fontWeight: 600 }}>💀 ВЫБЫЛ</span>
                        )}
                      </td>
                      <td>
                        <span style={{ color: '#9ca3af', fontFamily: 'monospace' }}>
                          {player.primaryWeapon}
                        </span>
                      </td>
                      <td>
                        {player.kills} / {player.deaths} / {player.assists}
                      </td>
                      <td>{player.adr}</td>
                      <td>{player.hsPercentage}%</td>
                      <td>{player.mvps ? `⭐ ${player.mvps}` : '0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* T Table */}
          <div className="panel" style={{ margin: 0 }}>
            <div className="panel-head" style={{ borderBottom: '2px solid #d97706' }}>
              <h4 style={{ margin: 0, color: '#fde68a', fontSize: 12 }}>
                {tTeamName} (Террористы · T)
              </h4>
              <span className="stat-label">Живых: {tPlayers.filter(p => p.isAlive).length} / {tPlayers.length}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="live-table">
                <thead>
                  <tr>
                    <th>Игрок</th>
                    <th>HP</th>
                    <th>Оружие</th>
                    <th>K / D / A</th>
                    <th>ADR</th>
                    <th>HS%</th>
                    <th>MVP</th>
                  </tr>
                </thead>
                <tbody>
                  {tPlayers.map(player => (
                    <tr
                      key={player.steamId}
                      className={`live-player-row ${!player.isAlive ? 'dead' : ''}`}
                    >
                      <td>
                        <strong>{player.name}</strong>
                      </td>
                      <td>
                        {player.isAlive ? (
                          <div>
                            <span style={{ fontWeight: 700, color: player.health > 50 ? '#4ade80' : player.health > 20 ? '#facc15' : '#f87171' }}>
                              {player.health}
                            </span>
                            <div className="hp-bar-wrap">
                              <div
                                className={`hp-bar-fill ${player.health > 50 ? 'hp-high' : player.health > 20 ? 'hp-mid' : 'hp-low'}`}
                                style={{ width: `${Math.min(100, player.health)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#ef4444', fontWeight: 600 }}>💀 ВЫБЫЛ</span>
                        )}
                      </td>
                      <td>
                        <span style={{ color: '#9ca3af', fontFamily: 'monospace' }}>
                          {player.primaryWeapon}
                        </span>
                      </td>
                      <td>
                        {player.kills} / {player.deaths} / {player.assists}
                      </td>
                      <td>{player.adr}</td>
                      <td>{player.hsPercentage}%</td>
                      <td>{player.mvps ? `⭐ ${player.mvps}` : '0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function isTwitchUrl(value?: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['twitch.tv', 'www.twitch.tv'].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function MatchCard({ match, state, onOpen }: { match: Match; state: TournamentState; onOpen: (match: Match) => void }) {
  const teams = resolveMatch(state, match);
  return (
    <article
      className="match-card"
      onClick={() => onOpen(match)}
      onKeyDown={event => event.key === 'Enter' && onOpen(match)}
      role="button"
      tabIndex={0}
      data-testid={`card-match-${match.id}`}
    >
      <div className="match-time">
        <strong>{match.time}</strong>
        <small>
          {new Date(`${match.date}T00:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }).replace('.', '')}
        </small>
      </div>
      <div className="match-teams">
        {[{ team: teams.a, side: 'a' as const }, { team: teams.b, side: 'b' as const }].map(({ team, side }) => (
          <div
            className={`team-line ${teams.winner === team ? 'winner' : ''} ${teams.loser === team ? 'loser' : ''}`}
            key={side}
          >
            <TeamMark team={team} />
            <span className="name">{team?.name ?? 'Победитель пары'}</span>
            <span className="team-score">
              {match.maps.length ? match.maps.reduce((n, map) => n + (map[side] > map[side === 'a' ? 'b' : 'a'] ? 1 : 0), 0) : ''}
            </span>
          </div>
        ))}
      </div>
      <div className="match-state">
        <StatusBadge status={match.status} />
        <small>{roundNames[match.round]}</small>
      </div>
    </article>
  );
}

function Bracket({ state, onOpen }: { state: TournamentState; onOpen: (match: Match) => void }) {
  const rounds: RoundKey[] = ['r16', 'qf', 'sf', 'third', 'final'];
  return (
    <div className="bracket-wrap" data-testid="bracket-all-rounds">
      <div className="bracket">
        {rounds.map(round => (
          <section className="round-column" key={round}>
            <h3 className="round-title">{roundNames[round]}</h3>
            <div className="round-matches">
              {state.matches
                .filter(match => match.round === round)
                .map(match => {
                  const resolved = resolveMatch(state, match);
                  return (
                    <article
                      className="bracket-card"
                      key={match.id}
                      onClick={() => onOpen(match)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={event => event.key === 'Enter' && onOpen(match)}
                      data-testid={`bracket-match-${match.id}`}
                    >
                      {[{ team: resolved.a, side: 'a' as const }, { team: resolved.b, side: 'b' as const }].map(({ team, side }) => (
                        <div className={`bracket-team ${resolved.winner === team ? 'winner' : ''}`} key={side}>
                          <TeamMark team={team} />
                          <span className="name">{team?.name ?? 'Ожидает участника'}</span>
                          <span className="team-score">
                            {match.maps.length ? match.maps.filter(map => map[side] > map[side === 'a' ? 'b' : 'a']).length : '·'}
                          </span>
                        </div>
                      ))}
                      <div style={{ position: 'absolute', right: 6, top: -7, transform: 'translateY(-100%)' }}>
                        <StatusBadge status={match.status} />
                      </div>
                    </article>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function MatchDetail({ match, state, onClose }: { match: Match; state: TournamentState; onClose: () => void }) {
  const resolved = resolveMatch(state, match);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()} data-testid="dialog-match-detail">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="match-dialog-title">
        <div className="modal-head">
          <div>
            <div className="eyebrow">
              {roundNames[match.round]} · {new Date(`${match.date}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · {match.time}
            </div>
            <h2 id="match-dialog-title">
              Матч {match.number} <span style={{ marginLeft: 8 }}><StatusBadge status={match.status} /></span>
            </h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть" data-testid="button-close-match">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="versus">
            <div className="versus-team">
              <TeamMark team={resolved.a} size="large" />
              <span>{resolved.a?.name ?? 'Участник определится позже'}</span>
            </div>
            <div className="versus-score">{scoreLabel(match)}</div>
            <div className="versus-team">
              <span>{resolved.b?.name ?? 'Участник определится позже'}</span>
              <TeamMark team={resolved.b} size="large" />
            </div>
          </div>
          <div className="detail-grid">
            <div className="detail-box">
              <h4>Карты · BO{match.round === 'final' ? 5 : 3}</h4>
              {match.maps.length ? (
                match.maps.map((map, index) => (
                  <div className="map-row" key={`${map.map}-${index}`}>
                    <span>
                      {map.map}
                      {match.currentMap === map.map ? ' · ТЕКУЩАЯ' : ''}
                    </span>
                    <strong>
                      {map.a} : {map.b}
                    </strong>
                  </div>
                ))
              ) : (
                <div className="map-row">
                  <span>Счёт карт появится после игры</span>
                  <span>—</span>
                </div>
              )}
              {match.currentMap && (
                <div className="map-row" style={{ color: '#f2762c' }}>
                  <span>Текущая карта · раунд</span>
                  <strong>
                    {match.currentMap} · {match.currentRound || 'раунд не указан'}
                  </strong>
                </div>
              )}
            </div>
            <div className="detail-box">
              <h4>Встреча</h4>
              <div className="map-row">
                <span>Дата и время</span>
                <strong>
                  {new Date(`${match.date}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} · {match.time}
                </strong>
              </div>
              <div className="map-row">
                <span>Формат</span>
                <strong>BO{match.round === 'final' ? 5 : 3}</strong>
              </div>
              <div className="map-row">
                <span>Арена</span>
                <strong>Школьный CS2 Сервер (CounterStrikeSharp)</strong>
              </div>
              {isTwitchUrl(match.twitch) && (
                <a className="primary-btn" href={match.twitch} target="_blank" rel="noreferrer" style={{ marginTop: 12 }}>
                  <ExternalLink size={13} />
                  Открыть трансляцию
                </a>
              )}
            </div>
            <div className="detail-box" style={{ gridColumn: '1 / -1' }}>
              <h4>Игроки · статистика матча</h4>
              {match.players.length ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="players-table">
                    <thead>
                      <tr>
                        <th>Игрок</th>
                        <th title="Убийства">Уб.</th>
                        <th title="Смерти">См.</th>
                        <th title="Помощи">Пом.</th>
                        <th>ADR</th>
                        <th title="Попадания в голову">В голову</th>
                        <th>MVP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {match.players.map((player, index) => (
                        <tr key={`${player.name}-${index}`}>
                          <td>
                            {player.name}{' '}
                            <span style={{ color: '#81858b' }}>
                              · {state.teams.find(team => team.id === player.teamId)?.short}
                            </span>
                          </td>
                          <td>{player.kills}</td>
                          <td>{player.deaths}</td>
                          <td>{player.assists}</td>
                          <td>{player.adr}</td>
                          <td>{player.hs}%</td>
                          <td>{player.mvp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="map-row">
                  <span>Статистика игроков появится в реальном времени во время матча</span>
                  <span>—</span>
                </div>
              )}
            </div>
          </div>
          <div className="modal-actions">
            <button className="soft-btn" onClick={onClose} data-testid="button-dismiss-match">
              Закрыть
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Home({ state, live }: { state: TournamentState; live: LiveMatchState }) {
  const [filter, setFilter] = useState<Filter>('Все');
  const [selected, setSelected] = useState<Match | null>(null);
  const [roundFilter, setRoundFilter] = useState<RoundKey | 'Все'>('Все');
  const matches = state.matches;
  const visible = matches.filter(match => (filter === 'Все' || match.status === filter) && (roundFilter === 'Все' || match.round === roundFilter));
  const liveMatches = state.matches.filter(match => match.status === 'LIVE');
  const upcoming = state.matches.filter(match => match.status === 'Скоро').slice(0, 4);
  const completed = state.matches.filter(match => match.status === 'Завершён').length;

  const calendar = [...new Set(matches.map(match => match.date))].sort().map(date => {
    const dayMatches = matches.filter(match => match.date === date);
    const dayRounds = [...new Set(dayMatches.map(match => roundNames[match.round]))];
    const formats = [...new Set(dayMatches.map(match => (match.round === 'final' ? 'BO5' : 'BO3')))];
    return { date, dayMatches, dayRounds, formats };
  });

  return (
    <main className="page-wrap">
      {/* Hero section */}
      <section className="hero">
        <div>
          <div className="eyebrow">Официальный школьный чемпионат · сезон 2026</div>
          <h1>
            Играем<br />
            <span>за свой класс.</span>
          </h1>
          <p className="hero-sub">
            Шестнадцать команд. Прямая интеграция с CS2 сервером через CounterStrikeSharp — реальный счёт, фраги и статистика игроков в реальном времени.
          </p>
        </div>
        <div className="hero-side">
          <strong>26—31 окт</strong>
          <small>2026 · КУБОК ШКОЛЫ</small>
        </div>
      </section>

      {/* Real-time CS2 Live Arena */}
      <LiveArena live={live} state={state} onOpenMatch={setSelected} />

      {/* Scoreboard stats overview */}
      <section className="scoreboard" aria-label="Показатели турнира">
        <div className="stat-block">
          <div className="stat-label">Команды</div>
          <div className="stat-value">16 <em>/ 16</em></div>
        </div>
        <div className="stat-block">
          <div className="stat-label">Матчей сыграно</div>
          <div className="stat-value">{completed} <em>/ 16</em></div>
        </div>
        <div className="stat-block">
          <div className="stat-label">Сейчас в игре</div>
          <div className="stat-value">
            {liveMatches.length ? (
              <>
                <span style={{ color: '#f2762c' }}>{String(liveMatches.length).padStart(2, '0')}</span> <em>LIVE</em>
              </>
            ) : (
              '00'
            )}
          </div>
        </div>
        <div className="stat-block">
          <div className="stat-label">Сервер CS2</div>
          <div className="stat-value">
            {live.serverConnected ? (
              <span style={{ color: '#22c55e', fontSize: 20 }}>ОНЛАЙН</span>
            ) : (
              <span style={{ color: '#888c93', fontSize: 18 }}>ОЖИДАЕТ</span>
            )}
          </div>
        </div>
      </section>

      {/* Main content grid */}
      <div className="content-grid">
        <div>
          <section id="schedule" className="section-anchor">
            <div className="section-heading">
              <div>
                <div className="eyebrow">Смотреть ход турнира</div>
                <h2>Матчи турнира</h2>
              </div>
              <small>{visible.length} МАТЧЕЙ</small>
            </div>
            <div className="toolbar" aria-label="Фильтры матчей">
              {(['Все', 'LIVE', 'Скоро', 'Завершён'] as Filter[]).map(item => (
                <button
                  className={`filter-btn ${filter === item ? 'selected' : ''}`}
                  key={item}
                  onClick={() => setFilter(item)}
                  data-testid={`filter-status-${item.toLowerCase().replace('ё', 'e')}`}
                >
                  {item}
                </button>
              ))}
              <select
                value={roundFilter}
                onChange={event => setRoundFilter(event.target.value as RoundKey | 'Все')}
                className="filter-btn"
                aria-label="Фильтр по раунду"
                data-testid="filter-round"
              >
                <option value="Все">Все раунды</option>
                <option value="r16">1/8 финала</option>
                <option value="qf">Четвертьфиналы</option>
                <option value="sf">Полуфиналы</option>
                <option value="third">Матч за 3-е место</option>
                <option value="final">Гранд-финал</option>
              </select>
            </div>
            {visible.length ? (
              <div className="match-list">
                {visible.map((match, index) => (
                  <div key={match.id} style={{ animationDelay: `${index * 35}ms` }}>
                    <MatchCard match={match} state={state} onOpen={setSelected} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" data-testid="empty-matches">
                В этом фильтре пока нет матчей.
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="side-panel">
          <section className="panel">
            <div className="panel-head">
              <h3>
                <span style={{ color: '#f2762c' }}>●</span> Сейчас на арене
              </h3>
              <Activity size={15} color="#f2762c" />
            </div>
            <div className="panel-body">
              {liveMatches.length ? (
                liveMatches.map(match => {
                  const pair = resolveMatch(state, match);
                  return (
                    <div
                      className="upcoming-row"
                      key={match.id}
                      onClick={() => setSelected(match)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={event => event.key === 'Enter' && setSelected(match)}
                    >
                      <span className="team-logo">{pair.a?.short ?? '?'}</span>
                      <div className="up-team">
                        {pair.a?.name ?? '—'}
                        <br />
                        {pair.b?.name ?? '—'}
                      </div>
                      <span className="up-time">
                        <StatusBadge status="LIVE" />
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="empty-state">Сейчас нет матчей в игре</div>
              )}
            </div>
          </section>

          <section className="panel" id="schedule-aside">
            <div className="panel-head">
              <h3>Ближайшие встречи</h3>
              <CalendarDays size={15} color="#f2762c" />
            </div>
            <div className="panel-body">
              {upcoming.map(match => {
                const pair = resolveMatch(state, match);
                return (
                  <div
                    className="upcoming-row"
                    key={match.id}
                    onClick={() => setSelected(match)}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="team-logo">{pair.a?.short ?? '?'}</span>
                    <div className="up-team">
                      {pair.a?.name ?? 'Участник'}
                      <br />
                      {pair.b?.name ?? 'Участник'}
                    </div>
                    <span className="up-time">
                      {match.time}
                      <br />
                      {new Date(`${match.date}T00:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Календарь дней</h3>
              <ClipboardList size={15} color="#f2762c" />
            </div>
            <div className="panel-body">
              {calendar.map(({ date, dayMatches, dayRounds, formats }) => (
                <div className="schedule-row" key={date}>
                  <div className="schedule-day">
                    {new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }).replace('.', '').toUpperCase()}
                  </div>
                  <div>
                    <strong>{dayRounds.join(' · ')}</strong>
                    <small>
                      Встреч: {dayMatches.length} · Формат: {formats.join(' / ')}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* Bracket section */}
      <section id="bracket" className="section-anchor" style={{ marginTop: 38 }}>
        <div className="section-heading">
          <div>
            <div className="eyebrow">Путь к кубку</div>
            <h2>Турнирная сетка</h2>
          </div>
          <small>ОДНО ПОРАЖЕНИЕ — ВЫЛЕТ</small>
        </div>
        <div className="mobile-scroll-hint">
          ПРОКРУТИ СЕТКУ ПО ГОРИЗОНТАЛИ <ChevronRight size={11} style={{ verticalAlign: 'middle' }} />
        </div>
        <Bracket state={state} onOpen={setSelected} />
      </section>

      {selected && <MatchDetail match={selected} state={state} onClose={() => setSelected(null)} />}
    </main>
  );
}

function parseMaps(value: string): Match['maps'] {
  return value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const [scores, mapName] = part.split('@').map(item => item.trim());
      const [a, b] = scores.split(/[-:]/).map(Number);
      return { map: mapName || ['Mirage', 'Ancient', 'Inferno', 'Nuke', 'Dust2'][index % 5], a: Number.isFinite(a) ? a : 0, b: Number.isFinite(b) ? b : 0 };
    });
}

function mapText(match: Match) {
  return match.maps.map(map => `${map.a}-${map.b}@${map.map}`).join(', ');
}

function formatDateInput(value: string) {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return date ? `${date[3]}.${date[2]}.${date[1]}` : value;
}

function parseDateInput(value: string) {
  const date = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!date) return null;
  const [, dayText, monthText, yearText] = date;
  const day = Number(dayText),
    month = Number(monthText),
    year = Number(yearText);
  const checked = new Date(Date.UTC(year, month - 1, day));
  if (checked.getUTCDate() !== day || checked.getUTCMonth() !== month - 1 || checked.getUTCFullYear() !== year) return null;
  return `${yearText}-${monthText}-${dayText}`;
}

/**
 * Admin Login Component - shown to visitors who do not have admin credentials
 */
function AdminLogin({ onLogin }: { onLogin: (password: string) => Promise<boolean> }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setSubmitting(true);
    setError('');
    const ok = await onLogin(password.trim());
    if (!ok) {
      setError('Неверный пароль администратора!');
    }
    setSubmitting(false);
  };

  return (
    <main className="page-wrap" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '62vh' }}>
      <div className="admin-card" style={{ maxWidth: 440, width: '100%', padding: '36px 30px', borderTop: '3px solid #f2762c', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, background: 'rgba(242, 118, 44, 0.15)', border: '1px solid #f2762c', borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 16px', color: '#f2762c' }}>
          <Lock size={26} />
        </div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Защищённая зона</div>
        <h2 style={{ fontSize: 24, margin: '0 0 10px', textTransform: 'uppercase' }}>Вход для организаторов</h2>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 22, lineHeight: 1.6 }}>
          Этот раздел защищён паролем. Обычные посетители сайта не имеют доступа к управлению сервером и изменению счёта.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
          <input
            type="password"
            className="compact-input"
            style={{ padding: '12px 14px', fontSize: 14, textAlign: 'center' }}
            placeholder="Введите пароль администратора..."
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
          />
          {error && <div className="field-error" style={{ textAlign: 'center', margin: 0 }}>{error}</div>}
          <button type="submit" className="primary-btn" disabled={submitting} style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 13 }}>
            {submitting ? 'Проверка...' : 'Войти в управление'}
          </button>
        </form>
        <div style={{ marginTop: 20, fontSize: 10, color: '#6b7280', borderTop: '1px solid #282b31', paddingTop: 14 }}>
          Пароль по умолчанию: <code style={{ color: '#f2762c' }}>admin123</code> (можно изменить после входа)
        </div>
      </div>
    </main>
  );
}

/**
 * Admin Panel with CS2 Server integration & simulation controls
 */
function Admin({
  state,
  updateMatch,
  updateTeam,
  reset,
  setState,
  live,
  settings,
  startSimulation,
  stopSimulation,
  updateServerSettings,
  changeAdminPassword,
  onLogout,
}: {
  state: TournamentState;
  updateMatch: (id: string, patch: Partial<Match>) => void;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  reset: () => void;
  setState: Dispatch<SetStateAction<TournamentState>>;
  live: LiveMatchState;
  settings: ServerSettings;
  startSimulation: () => void;
  stopSimulation: () => void;
  updateServerSettings: (patch: Partial<ServerSettings>) => void;
  changeAdminPassword: (newPassword: string) => Promise<boolean>;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<AdminTab>('server');
  const [notice, setNotice] = useState('');
  const [playerMatch, setPlayerMatch] = useState('m5');
  const [askReset, setAskReset] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [newAdminPass, setNewAdminPass] = useState('');

  const [mapDrafts, setMapDrafts] = useState<Record<string, string>>(() => Object.fromEntries(state.matches.map(m => [m.id, mapText(m)])));
  const [dateDrafts, setDateDrafts] = useState<Record<string, string>>(() => Object.fromEntries(state.matches.map(m => [m.id, formatDateInput(m.date)])));
  const [timeDrafts, setTimeDrafts] = useState<Record<string, string>>(() => Object.fromEntries(state.matches.map(m => [m.id, m.time])));

  const notify = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(''), 3000);
  };

  const webhookUrl = `${window.location.protocol}//${window.location.hostname}:5000/api/server/live`;

  const copyWebhook = () => {
    navigator.clipboard?.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
    notify('URL вебхука скопирован!');
  };

  const handleChangePassword = async () => {
    if (!newAdminPass.trim() || newAdminPass.trim().length < 4) {
      notify('Пароль должен быть не менее 4 символов!');
      return;
    }
    const ok = await changeAdminPassword(newAdminPass.trim());
    if (ok) {
      notify('Пароль администратора успешно изменён!');
      setNewAdminPass('');
    } else {
      notify('Ошибка при смене пароля.');
    }
  };

  const playerTarget = state.matches.find(match => match.id === playerMatch) ?? state.matches[0];
  const updatePlayer = (index: number, patch: Partial<PlayerStat>) => {
    setState(current => ({
      ...current,
      matches: current.matches.map(match =>
        match.id === playerMatch
          ? {
              ...match,
              players: match.players.map((p, i) => (i === index ? { ...p, ...patch } : p)),
            }
          : match
      ),
    }));
  };

  const rounds: RoundKey[] = ['r16', 'qf', 'sf', 'third', 'final'];

  return (
    <main className="page-wrap">
      <div className="admin-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div className="eyebrow">Панель организатора турнира</div>
          <h1>
            Управление<br />
            <span style={{ color: '#f2762c' }}>CS2 сервером и сеткой.</span>
          </h1>
          <p className="hero-sub">
            Подключение CounterStrikeSharp, привязка матчей в реалтайме, тестовый симулятор и ручная корректировка результатов.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          <span className="live-status-pill online" style={{ fontSize: 10 }}>
            <Check size={12} /> АДМИНИСТРАТОР АВТОРИЗОВАН
          </span>
          <button
            className="soft-btn"
            onClick={onLogout}
            style={{ fontSize: 10, borderColor: '#ef4444', color: '#fca5a5' }}
          >
            <LogOut size={12} style={{ marginRight: 5 }} /> Выйти из панели
          </button>
        </div>
      </div>

      <div className="admin-grid">
        <nav className="admin-tabs" aria-label="Разделы управления">
          <button
            className={`admin-tab ${tab === 'server' ? 'active' : ''}`}
            onClick={() => setTab('server')}
          >
            <Server size={15} /> CS2 Сервер и Live
          </button>
          <button
            className={`admin-tab ${tab === 'matches' ? 'active' : ''}`}
            onClick={() => setTab('matches')}
          >
            <Swords size={15} /> Матчи и расписание
          </button>
          <button
            className={`admin-tab ${tab === 'teams' ? 'active' : ''}`}
            onClick={() => setTab('teams')}
          >
            <Shield size={15} /> Команды (16)
          </button>
          <button
            className={`admin-tab ${tab === 'players' ? 'active' : ''}`}
            onClick={() => setTab('players')}
          >
            <Users size={15} /> Статистика игроков
          </button>

          <div className="panel" style={{ marginTop: 14 }}>
            <div className="panel-body">
              <div className="eyebrow">База данных</div>
              <p style={{ fontSize: 10, color: '#a7a9ad', lineHeight: 1.6 }}>
                Данные сохраняются автоматически на сервере в постоянном хранилище.
              </p>
              <button className="soft-btn" onClick={() => setAskReset(true)}>
                <ArrowDownToLine size={12} /> Сбросить данные
              </button>
            </div>
          </div>
        </nav>

        <section>
          {notice && (
            <div className="demo-note" style={{ marginBottom: 12 }} role="status">
              <Save size={14} /> {notice}
            </div>
          )}

          {/* TAB 1: CS2 SERVER & REAL-TIME INTEGRATION */}
          {tab === 'server' && (
            <div className="admin-card">
              <h3>
                Интеграция с CS2 сервером (CounterStrikeSharp){' '}
                <span className="eyebrow">· Прямая трансляция данных</span>
              </h3>

              {/* Status Card */}
              <div
                style={{
                  background: '#15171b',
                  border: '1px solid #2e323b',
                  padding: 18,
                  borderRadius: 6,
                  marginBottom: 20,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 14,
                }}
              >
                <div>
                  <div className="stat-label">Статус сервера CS2</div>
                  <div style={{ marginTop: 6 }}>
                    {live.serverConnected ? (
                      <span className="live-status-pill online">
                        <span className="dot-live" style={{ background: '#22c55e' }} />
                        {live.isSimulating ? 'ЖИВАЯ СИМУЛЯЦИЯ' : 'ПОДКЛЮЧЕН (ONLINE)'}
                      </span>
                    ) : (
                      <span className="live-status-pill offline">
                        <Radio size={12} /> ОЖИДАЕТ ПОДКЛЮЧЕНИЯ
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="stat-label">Сервер / Карта</div>
                  <div style={{ font: '700 16px "IBM Plex Mono", monospace', marginTop: 6, color: '#eeeae2' }}>
                    {live.serverName} ({live.map})
                  </div>
                </div>
                <div>
                  <div className="stat-label">Текущий раунд</div>
                  <div style={{ font: '700 16px "IBM Plex Mono", monospace', marginTop: 6, color: '#f2762c' }}>
                    Раунд {live.currentRound} ({live.teamCT.score} : {live.teamT.score})
                  </div>
                </div>
                <div>
                  <div className="stat-label">Игроков на сервере</div>
                  <div style={{ font: '700 16px "IBM Plex Mono", monospace', marginTop: 6, color: '#eeeae2' }}>
                    {live.players.length} игроков в сессии
                  </div>
                </div>
              </div>

              {/* Match Binder */}
              <div className="field" style={{ marginBottom: 18 }}>
                <label htmlFor="active-match-select">
                  <strong>Связать CS2 сервер с матчем турнира:</strong>
                </label>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <select
                    id="active-match-select"
                    value={settings.activeMatchId}
                    onChange={e => {
                      updateServerSettings({ activeMatchId: e.target.value });
                      notify(`Сервер теперь передаёт данные в матч ${e.target.value}!`);
                    }}
                    style={{ flex: 1, padding: '8px 12px', background: '#191b1f', border: '1px solid #30333a', color: '#fff', borderRadius: 4 }}
                  >
                    {state.matches.map(m => {
                      const p = resolveMatch(state, m);
                      return (
                        <option key={m.id} value={m.id}>
                          Матч {m.number} ({p.a?.name ?? 'Участник'} vs {p.b?.name ?? 'Участник'}) · {roundNames[m.round]} [{m.id}]
                        </option>
                      );
                    })}
                  </select>
                </div>
                <small style={{ color: '#888c93', marginTop: 4, display: 'block' }}>
                  При получении данных с сервера счёт, раунды и игроки выбранного матча в сетке будут обновляться в реалтайме автоматически!
                </small>
              </div>

              {/* Webhook Connection details */}
              <div style={{ background: '#191b1f', border: '1px solid #2a2d34', padding: 16, borderRadius: 6, marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#f2762c' }}>
                  Параметры для плагина CounterStrikeSharp на вашем сервере
                </h4>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>
                      Адрес вебхука (ApiUrl):
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="compact-input"
                        readOnly
                        value={webhookUrl}
                        style={{ fontFamily: 'monospace', flex: 1 }}
                      />
                      <button className="soft-btn" onClick={copyWebhook} title="Копировать">
                        {copiedUrl ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>
                      Секретный токен сервера (ApiToken):
                    </label>
                    <input
                      className="compact-input"
                      value={settings.serverToken}
                      onChange={e => updateServerSettings({ serverToken: e.target.value })}
                      style={{ fontFamily: 'monospace' }}
                      placeholder="Секретный токен"
                    />
                  </div>
                </div>
              </div>

              {/* Change Admin Password */}
              <div style={{ background: '#191b1f', border: '1px solid #2a2d34', padding: 16, borderRadius: 6, marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 13, color: '#f2762c' }}>
                  Безопасность: Смена пароля администратора
                </h4>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 12px' }}>
                  По умолчанию пароль <code>admin123</code>. Замените его перед публикацией сайта на хостинге.
                </p>
                <div style={{ display: 'flex', gap: 10, maxWidth: 420 }}>
                  <input
                    type="password"
                    className="compact-input"
                    placeholder="Новый пароль..."
                    value={newAdminPass}
                    onChange={e => setNewAdminPass(e.target.value)}
                  />
                  <button
                    className="primary-btn"
                    onClick={handleChangePassword}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Сохранить пароль
                  </button>
                </div>
              </div>

              {/* Simulation Testing Tool */}
              <div style={{ background: '#1c1815', border: '1px solid #87491f', padding: 18, borderRadius: 6, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h4 style={{ margin: 0, color: '#f2762c', fontSize: 14 }}>
                      Тестовый симулятор CS2 матча
                    </h4>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#c4c6cb' }}>
                      Хотите проверить, как двигается счёт, летают фраги и обновляется HP игроков без запуска сервера прямо сейчас?
                    </p>
                  </div>
                  <div>
                    {live.isSimulating ? (
                      <button
                        className="soft-btn"
                        onClick={stopSimulation}
                        style={{ background: '#ef4444', color: '#fff', borderColor: '#b91c1c' }}
                      >
                        <Square size={13} style={{ marginRight: 6 }} /> Остановить симуляцию
                      </button>
                    ) : (
                      <button
                        className="primary-btn"
                        onClick={() => {
                          startSimulation();
                          notify('Живой симулятор матча запущен! Перейдите на главную страницу, чтобы смотреть.');
                        }}
                      >
                        <Play size={13} style={{ marginRight: 6 }} /> Запустить тестовый матч
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Guide Accordion */}
              <div className="panel">
                <div className="panel-head">
                  <h4 style={{ margin: 0, fontSize: 12 }}>
                    Инструкция по установке плагина на CS2 сервер
                  </h4>
                </div>
                <div className="panel-body" style={{ fontSize: 11, color: '#a1a5ad', lineHeight: 1.7 }}>
                  <p>
                    1. В папке проекта на рабочем столе найдите папку <code>cs2-server-plugin/</code>.<br />
                    2. Скопируйте собранный <code>CS2SchoolCupTracker.dll</code> в папку сервера:{' '}
                    <code>game/csgo/addons/counterstrikesharp/plugins/CS2SchoolCupTracker/</code>.<br />
                    3. В файле конфигурации плагина укажите URL и токен из полей выше.<br />
                    4. В консоли сервера или игры доступны команды:
                  </p>
                  <ul style={{ paddingLeft: 20, margin: '6px 0' }}>
                    <li>
                      <code>css_cup_match {settings.activeMatchId}</code> — связать сервер с выбранным матчем сетки.
                    </li>
                    <li>
                      <code>css_cup_sync</code> — принудительно синхронизировать текущее состояние.
                    </li>
                    <li>
                      <code>css_cup_status</code> — проверить статус отправки данных.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MATCHES */}
          {tab === 'matches' && (
            <div className="admin-card">
              <h3>
                Матчи и расписание <span className="eyebrow">· {state.matches.length} встреч</span>
              </h3>
              <div className="demo-note" style={{ marginBottom: 15 }}>
                <CircleHelp size={15} />
                <span>
                  Счёт карт вводится как <b>13-8@Mirage, 13-10@Ancient</b>. При подключенном сервере CS2 счёт заполняется автоматически.
                </span>
              </div>
              {rounds.map(round => (
                <div key={round}>
                  <div className="eyebrow" style={{ margin: '17px 0 5px' }}>
                    {roundNames[round]}
                  </div>
                  {state.matches
                    .filter(match => match.round === round)
                    .map(match => {
                      const pair = resolveMatch(state, match);
                      return (
                        <div className="admin-match-editor" key={match.id} data-testid={`admin-row-match-${match.id}`}>
                          <div className="admin-match-row">
                            <div className="admin-match-name">
                              {pair.a?.name ?? 'Победитель пары'} — {pair.b?.name ?? 'Победитель пары'}
                              <small>
                                Матч {match.number} · {scoreLabel(match)} {match.id === settings.activeMatchId ? '· 🔴 СЕРВЕР CS2' : ''}
                              </small>
                            </div>
                            <input
                              className="compact-input"
                              type="text"
                              value={dateDrafts[match.id] ?? formatDateInput(match.date)}
                              placeholder="ДД.ММ.ГГГГ"
                              onChange={e => setDateDrafts({ ...dateDrafts, [match.id]: e.target.value })}
                              onBlur={() => {
                                const parsed = parseDateInput(dateDrafts[match.id]);
                                if (parsed) updateMatch(match.id, { date: parsed });
                              }}
                            />
                            <input
                              className="compact-input"
                              type="text"
                              value={timeDrafts[match.id] ?? match.time}
                              placeholder="ЧЧ:ММ"
                              onChange={e => setTimeDrafts({ ...timeDrafts, [match.id]: e.target.value })}
                              onBlur={() => updateMatch(match.id, { time: timeDrafts[match.id] })}
                            />
                            <select
                              className="status-select"
                              value={match.status}
                              onChange={e => updateMatch(match.id, { status: e.target.value as MatchStatus })}
                            >
                              <option>Скоро</option>
                              <option>LIVE</option>
                              <option>Завершён</option>
                            </select>
                            <input
                              className="compact-input"
                              style={{ gridColumn: '1 / 3' }}
                              value={mapDrafts[match.id] ?? mapText(match)}
                              placeholder="13-8@Mirage, 13-10@Ancient"
                              onChange={e => setMapDrafts({ ...mapDrafts, [match.id]: e.target.value })}
                              onBlur={() => {
                                const parsed = parseMaps(mapDrafts[match.id] ?? '');
                                updateMatch(match.id, { maps: parsed });
                              }}
                            />
                            <input
                              className="compact-input"
                              value={match.currentMap}
                              placeholder="Текущая карта"
                              onChange={e => updateMatch(match.id, { currentMap: e.target.value })}
                            />
                            <input
                              className="compact-input"
                              value={match.currentRound}
                              placeholder="Раунд (19:12)"
                              onChange={e => updateMatch(match.id, { currentRound: e.target.value })}
                            />
                            <input
                              className="compact-input"
                              style={{ gridColumn: '1 / 3' }}
                              type="url"
                              value={match.twitch ?? ''}
                              placeholder="Ссылка на трансляцию Twitch (необязательно)"
                              onChange={e => updateMatch(match.id, { twitch: e.target.value })}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: TEAMS */}
          {tab === 'teams' && (
            <div className="admin-card">
              <h3>
                Состав участников <span className="eyebrow">· 16 команд школы</span>
              </h3>
              {state.teams.map(team => (
                <div className="admin-team-row" key={team.id}>
                  <TeamMark team={team} />
                  <div className="field">
                    <label>Название команды</label>
                    <input
                      value={team.name}
                      onChange={e => updateTeam(team.id, { name: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Эмблема (кратко)</label>
                    <input
                      value={team.short}
                      maxLength={4}
                      onChange={e => updateTeam(team.id, { short: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="field">
                    <label>Цвет</label>
                    <div className="team-color-field">
                      <input
                        type="color"
                        value={team.color}
                        onChange={e => updateTeam(team.id, { color: e.target.value })}
                      />
                      <span>{team.color}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: PLAYERS */}
          {tab === 'players' && (
            <div className="admin-card">
              <h3>Статистика игроков матча</h3>
              <div className="field" style={{ maxWidth: 360, marginBottom: 15 }}>
                <label>Выбери встречу:</label>
                <select
                  value={playerMatch}
                  onChange={e => setPlayerMatch(e.target.value)}
                  style={{ padding: '8px 12px', background: '#191b1f', border: '1px solid #30333a', color: '#fff', borderRadius: 4, width: '100%' }}
                >
                  {state.matches.map(match => {
                    const pair = resolveMatch(state, match);
                    return (
                      <option key={match.id} value={match.id}>
                        {pair.a?.name ?? 'Участник'} — {pair.b?.name ?? 'Участник'} · {roundNames[match.round]}
                      </option>
                    );
                  })}
                </select>
              </div>

              {playerTarget?.players.map((player, index) => (
                <div
                  className="admin-match-row"
                  key={`${player.name}-${index}`}
                  style={{ gridTemplateColumns: 'minmax(95px, 1.2fr) repeat(6, minmax(42px, .55fr))' }}
                >
                  <input
                    className="compact-input"
                    value={player.name}
                    placeholder="Ник"
                    onChange={e => updatePlayer(index, { name: e.target.value })}
                  />
                  <select
                    className="status-select"
                    value={player.teamId}
                    onChange={e => updatePlayer(index, { teamId: e.target.value })}
                  >
                    {state.teams.map(t => (
                      <option value={t.id} key={t.id}>
                        {t.short}
                      </option>
                    ))}
                  </select>
                  {(['kills', 'deaths', 'assists', 'adr', 'hs', 'mvp'] as const).map(key => (
                    <input
                      key={key}
                      className="compact-input"
                      type="number"
                      min="0"
                      value={player[key]}
                      title={key}
                      onChange={e => updatePlayer(index, { [key]: Number(e.target.value) })}
                    />
                  ))}
                </div>
              ))}

              <div className="toolbar" style={{ marginTop: 14 }}>
                <button
                  className="soft-btn"
                  onClick={() => {
                    setState(curr => ({
                      ...curr,
                      matches: curr.matches.map(m =>
                        m.id === playerMatch
                          ? {
                              ...m,
                              players: [
                                ...m.players,
                                {
                                  name: 'Новый игрок',
                                  teamId: resolveMatch(curr, m).a?.id ?? curr.teams[0].id,
                                  kills: 0,
                                  deaths: 0,
                                  assists: 0,
                                  adr: 0,
                                  hs: 0,
                                  mvp: 0,
                                },
                              ],
                            }
                          : m
                      ),
                    }));
                    notify('Игрок добавлен.');
                  }}
                >
                  <Users size={13} /> Добавить игрока
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {askReset && (
        <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setAskReset(false)}>
          <section className="modal" role="alertdialog" aria-modal="true">
            <div className="modal-head">
              <h2>Сбросить данные турнира?</h2>
              <button className="icon-btn" onClick={() => setAskReset(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#a8abb0', fontSize: 12 }}>
                Все результаты матчей будут возвращены к исходному состоянию.
              </p>
              <div className="modal-actions">
                <button className="soft-btn" onClick={() => setAskReset(false)}>
                  Отмена
                </button>
                <button
                  className="primary-btn"
                  onClick={() => {
                    reset();
                    setAskReset(false);
                    notify('Данные турнира сброшены.');
                  }}
                >
                  Сбросить
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function NotFoundPage() {
  return (
    <main className="page-wrap">
      <div className="error-state">
        <AlertTriangle size={24} />
        <h1>Страница не найдена</h1>
        <Link href="/" className="primary-btn">
          К турниру
        </Link>
      </div>
    </main>
  );
}

function AppShell({
  children,
  admin = false,
  serverConnected = false,
  isSimulating = false,
}: {
  children: ReactNode;
  admin?: boolean;
  serverConnected?: boolean;
  isSimulating?: boolean;
}) {
  return (
    <div className="app-shell dark">
      <Header admin={admin} serverConnected={serverConnected} isSimulating={isSimulating} />
      {children}
      <footer
        style={{
          borderTop: '1px solid #282b31',
          padding: '18px clamp(16px, 4vw, 62px)',
          color: '#777b83',
          font: '500 9px IBM Plex Mono, monospace',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <span>ШКОЛЬНЫЙ КУБОК CS2 · СЕЗОН 2026</span>
        <span>Прямая синхронизация с CS2 сервером (CounterStrikeSharp)</span>
      </footer>
    </div>
  );
}

function Router() {
  const [location] = useLocation();
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('cs2_admin_token') || '');
  const tournament = useTournament(adminToken);
  const liveHandler = useLiveMatch(adminToken, tournament.setState);

  const handleLogin = async (pass: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass }),
      });
      if (res.ok) {
        localStorage.setItem('cs2_admin_token', pass);
        setAdminToken(pass);
        return true;
      }
    } catch {}
    return false;
  };

  const handleLogout = () => {
    localStorage.removeItem('cs2_admin_token');
    setAdminToken('');
  };

  return (
    <ErrorBoundary resetKey={location}>
      <Switch>
        <Route path="/">
          <AppShell
            serverConnected={liveHandler.live.serverConnected}
            isSimulating={liveHandler.live.isSimulating}
          >
            <Home state={tournament.state} live={liveHandler.live} />
          </AppShell>
        </Route>
        <Route path="/admin">
          <AppShell
            admin
            serverConnected={liveHandler.live.serverConnected}
            isSimulating={liveHandler.live.isSimulating}
          >
            {adminToken ? (
              <Admin
                {...tournament}
                live={liveHandler.live}
                settings={liveHandler.settings}
                startSimulation={liveHandler.startSimulation}
                stopSimulation={liveHandler.stopSimulation}
                updateServerSettings={liveHandler.updateServerSettings}
                changeAdminPassword={liveHandler.changeAdminPassword}
                onLogout={handleLogout}
              />
            ) : (
              <AdminLogin onLogin={handleLogin} />
            )}
          </AppShell>
        </Route>
        <Route>
          <AppShell>
            <NotFoundPage />
          </AppShell>
        </Route>
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
