export type MatchStatus = 'Скоро' | 'LIVE' | 'Завершён';
export type RoundKey = 'r16' | 'qf' | 'sf' | 'third' | 'final';

export interface Team {
  id: string;
  name: string;
  short: string;
  color: string;
}

export interface PlayerStat {
  name: string;
  teamId: string;
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  hs: number;
  mvp: number;
}

export interface MapScore {
  map: string;
  a: number;
  b: number;
}

export interface Match {
  id: string;
  round: RoundKey;
  number: number;
  status: MatchStatus;
  date: string;
  time: string;
  teamA?: string;
  teamB?: string;
  fromA?: { matchId: string; result: 'winner' | 'loser' };
  fromB?: { matchId: string; result: 'winner' | 'loser' };
  maps: MapScore[];
  currentMap: string;
  currentRound: string;
  twitch?: string;
  players: PlayerStat[];
}

export interface TournamentState {
  teams: Team[];
  matches: Match[];
}

export function resolveMatch(state: TournamentState, match: Match): { a?: Team; b?: Team; winner?: Team; loser?: Team } {
  const byId = (id?: string) => state.teams.find(team => team.id === id);
  const from = (source?: Match['fromA']) => {
    if (!source) return undefined;
    const prev = state.matches.find(item => item.id === source.matchId);
    if (!prev) return undefined;
    const resolved = resolveMatch(state, prev);
    return source.result === 'winner' ? resolved.winner : resolved.loser;
  };
  const a = match.fromA ? from(match.fromA) : byId(match.teamA);
  const b = match.fromB ? from(match.fromB) : byId(match.teamB);
  const wins = (team: 'a' | 'b') => match.maps.reduce((total, map) => total + (map[team] > map[team === 'a' ? 'b' : 'a'] ? 1 : 0), 0);
  const winsNeeded = match.round === 'final' ? 3 : 2;
  let winner: Team | undefined, loser: Team | undefined;
  if (match.status === 'Завершён' && a && b) {
    if (wins('a') >= winsNeeded) { winner = a; loser = b; }
    else if (wins('b') >= winsNeeded) { winner = b; loser = a; }
  }
  return { a, b, winner, loser };
}

export interface LivePlayer {
  steamId: string;
  name: string;
  team: 'CT' | 'T' | 'SPEC';
  health: number;
  armor: number;
  hasHelmet: boolean;
  hasDefuser: boolean;
  isAlive: boolean;
  money: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  adr: number;
  headshots: number;
  hsPercentage: number;
  mvps: number;
  primaryWeapon: string;
  ping: number;
}

export interface LiveBomb {
  state: 'carried' | 'planted' | 'defusing' | 'exploded' | 'defused' | null;
  site: 'A' | 'B' | null;
  plantedAt: number | null;
  planterName: string | null;
}

export interface LiveRoundHistory {
  round: number;
  winner: 'CT' | 'T';
  reason: 'elimination' | 'defused' | 'exploded' | 'timeout';
  scoreCT: number;
  scoreT: number;
}

export interface LiveEvent {
  id: string;
  time: string;
  type: 'kill' | 'bomb' | 'round' | 'info';
  text: string;
  attackerName?: string;
  attackerTeam?: 'CT' | 'T';
  victimName?: string;
  victimTeam?: 'CT' | 'T';
  weapon?: string;
  headshot?: boolean;
}

export interface LiveMatchState {
  serverConnected: boolean;
  lastHeartbeat: number;
  serverName: string;
  matchId: string;
  map: string;
  currentRound: number;
  phase: 'warmup' | 'live' | 'freezetime' | 'bomb_planted' | 'round_ended' | 'game_over';
  teamCT: {
    id?: string;
    name: string;
    score: number;
    consecutiveLosses?: number;
  };
  teamT: {
    id?: string;
    name: string;
    score: number;
    consecutiveLosses?: number;
  };
  bomb: LiveBomb;
  players: LivePlayer[];
  roundHistory: LiveRoundHistory[];
  recentEvents: LiveEvent[];
  isSimulating?: boolean;
}

export interface ServerSettings {
  serverToken: string;
  activeMatchId: string;
  serverUrl?: string;
  syncIntervalMs?: number;
  adminPassword?: string;
}
