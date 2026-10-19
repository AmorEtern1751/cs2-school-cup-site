import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TournamentState,
  ServerSettings,
  LiveMatchState,
  Match,
  Team,
  resolveMatch,
} from './types/tournament';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'tournament-data.json');

export const defaultTournamentState: TournamentState = {
  teams: [
    { id: 'north', name: 'Северный ветер', short: 'СВ', color: '#73a9c6' },
    { id: 'pixel', name: 'Пиксельный шторм', short: 'ПШ', color: '#c47cd0' },
    { id: 'orbit', name: 'Орбита', short: 'ОРБ', color: '#7a9ee2' },
    { id: 'voltage', name: 'Вольтаж', short: 'ВЛТ', color: '#e9b35c' },
    { id: 'frost', name: 'Крио', short: 'КРИ', color: '#7dc3c0' },
    { id: 'raven', name: 'Чёрный ворон', short: 'ЧВ', color: '#b88a78' },
    { id: 'nova', name: 'Нова', short: 'НОВ', color: '#d47773' },
    { id: 'vector', name: 'Вектор', short: 'ВЕК', color: '#83a476' },
    { id: 'echo', name: 'Эхо улиц', short: 'ЭХО', color: '#c59663' },
    { id: 'tactic', name: 'Тихий пик', short: 'ТПК', color: '#8895bd' },
    { id: 'monolith', name: 'Монолит', short: 'МНЛ', color: '#b0a172' },
    { id: 'spark', name: 'Искра', short: 'ИСК', color: '#d98b55' },
    { id: 'cipher', name: 'Шифр', short: 'ШФР', color: '#78a2a0' },
    { id: 'wildcard', name: 'Дикий слот', short: 'ДСЛ', color: '#b68cc6' },
    { id: 'anchor', name: 'Якорь', short: 'ЯКР', color: '#a5ad77' },
    { id: 'lowkey', name: 'На чиле', short: 'НЧЛ', color: '#8b9da4' },
  ],
  matches: [
    { id: 'm1', round: 'r16', number: 1, status: 'Завершён', date: '2026-10-26', time: '10:00', teamA: 'north', teamB: 'pixel', maps: [{ map: 'Ancient', a: 13, b: 8 }, { map: 'Mirage', a: 13, b: 10 }], currentMap: '', currentRound: '', players: [] },
    { id: 'm2', round: 'r16', number: 2, status: 'Завершён', date: '2026-10-26', time: '10:00', teamA: 'orbit', teamB: 'voltage', maps: [{ map: 'Inferno', a: 11, b: 13 }, { map: 'Anubis', a: 13, b: 9 }, { map: 'Nuke', a: 13, b: 7 }], currentMap: '', currentRound: '', players: [] },
    { id: 'm3', round: 'r16', number: 3, status: 'Завершён', date: '2026-10-26', time: '11:30', teamA: 'frost', teamB: 'raven', maps: [{ map: 'Dust2', a: 13, b: 6 }, { map: 'Mirage', a: 13, b: 11 }], currentMap: '', currentRound: '', players: [] },
    { id: 'm4', round: 'r16', number: 4, status: 'Завершён', date: '2026-10-26', time: '11:30', teamA: 'nova', teamB: 'vector', maps: [{ map: 'Nuke', a: 13, b: 10 }, { map: 'Ancient', a: 9, b: 13 }, { map: 'Inferno', a: 8, b: 13 }], currentMap: '', currentRound: '', players: [] },
    {
      id: 'm5', round: 'r16', number: 5, status: 'LIVE', date: '2026-10-27', time: '13:00', teamA: 'echo', teamB: 'tactic',
      maps: [{ map: 'Mirage', a: 13, b: 9 }, { map: 'Ancient', a: 7, b: 10 }],
      currentMap: 'Ancient', currentRound: '19:12', twitch: 'https://www.twitch.tv/',
      players: [
        { name: 'k0t', teamId: 'echo', kills: 38, deaths: 30, assists: 9, adr: 86, hs: 18, mvp: 3 },
        { name: 'quiet', teamId: 'tactic', kills: 31, deaths: 34, assists: 12, adr: 74, hs: 14, mvp: 1 },
        { name: 'vexa', teamId: 'echo', kills: 29, deaths: 27, assists: 8, adr: 72, hs: 13, mvp: 2 },
        { name: 'm1r', teamId: 'tactic', kills: 26, deaths: 31, assists: 10, adr: 68, hs: 11, mvp: 1 },
      ],
    },
    { id: 'm6', round: 'r16', number: 6, status: 'Скоро', date: '2026-10-27', time: '13:00', teamA: 'monolith', teamB: 'spark', maps: [], currentMap: '', currentRound: '', players: [] },
    { id: 'm7', round: 'r16', number: 7, status: 'Скоро', date: '2026-10-27', time: '14:30', teamA: 'cipher', teamB: 'wildcard', maps: [], currentMap: '', currentRound: '', players: [] },
    { id: 'm8', round: 'r16', number: 8, status: 'Скоро', date: '2026-10-27', time: '14:30', teamA: 'anchor', teamB: 'lowkey', maps: [], currentMap: '', currentRound: '', players: [] },
    { id: 'm9', round: 'qf', number: 1, status: 'Скоро', date: '2026-10-28', time: '10:00', fromA: { matchId: 'm1', result: 'winner' }, fromB: { matchId: 'm2', result: 'winner' }, maps: [], currentMap: '', currentRound: '', players: [] },
    { id: 'm10', round: 'qf', number: 2, status: 'Скоро', date: '2026-10-28', time: '10:00', fromA: { matchId: 'm3', result: 'winner' }, fromB: { matchId: 'm4', result: 'winner' }, maps: [], currentMap: '', currentRound: '', players: [] },
    { id: 'm11', round: 'qf', number: 3, status: 'Скоро', date: '2026-10-29', time: '12:00', fromA: { matchId: 'm5', result: 'winner' }, fromB: { matchId: 'm6', result: 'winner' }, maps: [], currentMap: '', currentRound: '', players: [] },
    { id: 'm12', round: 'qf', number: 4, status: 'Скоро', date: '2026-10-29', time: '12:00', fromA: { matchId: 'm7', result: 'winner' }, fromB: { matchId: 'm8', result: 'winner' }, maps: [], currentMap: '', currentRound: '', players: [] },
    { id: 'm13', round: 'sf', number: 1, status: 'Скоро', date: '2026-10-30', time: '11:00', fromA: { matchId: 'm9', result: 'winner' }, fromB: { matchId: 'm10', result: 'winner' }, maps: [], currentMap: '', currentRound: '', players: [] },
    { id: 'm14', round: 'sf', number: 2, status: 'Скоро', date: '2026-10-30', time: '13:30', fromA: { matchId: 'm11', result: 'winner' }, fromB: { matchId: 'm12', result: 'winner' }, maps: [], currentMap: '', currentRound: '', players: [] },
    { id: 'm15', round: 'third', number: 1, status: 'Скоро', date: '2026-10-31', time: '11:00', fromA: { matchId: 'm13', result: 'loser' }, fromB: { matchId: 'm14', result: 'loser' }, maps: [], currentMap: '', currentRound: '', players: [] },
    { id: 'm16', round: 'final', number: 1, status: 'Скоро', date: '2026-10-31', time: '14:00', fromA: { matchId: 'm13', result: 'winner' }, fromB: { matchId: 'm14', result: 'winner' }, maps: [], currentMap: '', currentRound: '', players: [] },
  ],
};

export const defaultSettings: ServerSettings = {
  serverToken: 'cs2-school-cup-secret-2026',
  activeMatchId: 'm5',
  syncIntervalMs: 1000,
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
};

export const defaultLiveState: LiveMatchState = {
  serverConnected: false,
  lastHeartbeat: 0,
  serverName: 'Школьный CS2 Сервер',
  matchId: 'm5',
  map: 'de_ancient',
  currentRound: 19,
  phase: 'live',
  teamCT: {
    id: 'echo',
    name: 'Эхо улиц',
    score: 7,
    consecutiveLosses: 0,
  },
  teamT: {
    id: 'tactic',
    name: 'Тихий пик',
    score: 10,
    consecutiveLosses: 0,
  },
  bomb: {
    state: null,
    site: null,
    plantedAt: null,
    planterName: null,
  },
  players: [
    { steamId: '76561198000000001', name: 'k0t', team: 'CT', health: 100, armor: 100, hasHelmet: true, hasDefuser: true, isAlive: true, money: 3400, kills: 38, deaths: 30, assists: 9, damage: 3268, adr: 86, headshots: 18, hsPercentage: 47, mvps: 3, primaryWeapon: 'm4a1_silencer', ping: 12 },
    { steamId: '76561198000000002', name: 'vexa', team: 'CT', health: 85, armor: 95, hasHelmet: true, hasDefuser: false, isAlive: true, money: 2150, kills: 29, deaths: 27, assists: 8, damage: 2736, adr: 72, headshots: 13, hsPercentage: 45, mvps: 2, primaryWeapon: 'awp', ping: 18 },
    { steamId: '76561198000000003', name: 's1mple_fan', team: 'CT', health: 0, armor: 0, hasHelmet: false, hasDefuser: false, isAlive: false, money: 1400, kills: 18, deaths: 32, assists: 11, damage: 1900, adr: 50, headshots: 9, hsPercentage: 50, mvps: 0, primaryWeapon: 'mp9', ping: 15 },
    { steamId: '76561198000000004', name: 'b1t_jr', team: 'CT', health: 42, armor: 70, hasHelmet: false, hasDefuser: true, isAlive: true, money: 2900, kills: 22, deaths: 28, assists: 6, damage: 2318, adr: 61, headshots: 14, hsPercentage: 64, mvps: 1, primaryWeapon: 'famas', ping: 22 },
    { steamId: '76561198000000005', name: 'cyberschool', team: 'CT', health: 0, armor: 0, hasHelmet: false, hasDefuser: false, isAlive: false, money: 800, kills: 15, deaths: 33, assists: 7, damage: 1672, adr: 44, headshots: 6, hsPercentage: 40, mvps: 1, primaryWeapon: 'usp_silencer', ping: 19 },
    { steamId: '76561198000000006', name: 'quiet', team: 'T', health: 100, armor: 100, hasHelmet: true, hasDefuser: false, isAlive: true, money: 4900, kills: 31, deaths: 34, assists: 12, damage: 2812, adr: 74, headshots: 14, hsPercentage: 45, mvps: 1, primaryWeapon: 'ak47', ping: 14 },
    { steamId: '76561198000000007', name: 'm1r', team: 'T', health: 65, armor: 90, hasHelmet: true, hasDefuser: false, isAlive: true, money: 3600, kills: 26, deaths: 31, assists: 10, damage: 2584, adr: 68, headshots: 11, hsPercentage: 42, mvps: 1, primaryWeapon: 'ak47', ping: 16 },
    { steamId: '76561198000000008', name: 'stormy', team: 'T', health: 0, armor: 0, hasHelmet: false, hasDefuser: false, isAlive: false, money: 2100, kills: 24, deaths: 29, assists: 8, damage: 2356, adr: 62, headshots: 10, hsPercentage: 41, mvps: 2, primaryWeapon: 'galilar', ping: 25 },
    { steamId: '76561198000000009', name: 'apex_predator', team: 'T', health: 100, armor: 100, hasHelmet: true, hasDefuser: false, isAlive: true, money: 5200, kills: 25, deaths: 28, assists: 7, damage: 2432, adr: 64, headshots: 12, hsPercentage: 48, mvps: 1, primaryWeapon: 'ak47', ping: 17 },
    { steamId: '76561198000000010', name: 'clutch_king', team: 'T', health: 100, armor: 100, hasHelmet: true, hasDefuser: false, isAlive: true, money: 6100, kills: 28, deaths: 26, assists: 9, damage: 2660, adr: 70, headshots: 15, hsPercentage: 53, mvps: 3, primaryWeapon: 'awp', ping: 13 },
  ],
  roundHistory: [
    { round: 1, winner: 'CT', reason: 'elimination', scoreCT: 1, scoreT: 0 },
    { round: 2, winner: 'CT', reason: 'elimination', scoreCT: 2, scoreT: 0 },
    { round: 3, winner: 'T', reason: 'exploded', scoreCT: 2, scoreT: 1 },
    { round: 4, winner: 'T', reason: 'elimination', scoreCT: 2, scoreT: 2 },
    { round: 5, winner: 'T', reason: 'defused', scoreCT: 2, scoreT: 3 },
    { round: 6, winner: 'CT', reason: 'defused', scoreCT: 3, scoreT: 3 },
    { round: 7, winner: 'CT', reason: 'elimination', scoreCT: 4, scoreT: 3 },
    { round: 8, winner: 'T', reason: 'exploded', scoreCT: 4, scoreT: 4 },
    { round: 9, winner: 'T', reason: 'elimination', scoreCT: 4, scoreT: 5 },
    { round: 10, winner: 'T', reason: 'elimination', scoreCT: 4, scoreT: 6 },
    { round: 11, winner: 'CT', reason: 'timeout', scoreCT: 5, scoreT: 6 },
    { round: 12, winner: 'T', reason: 'exploded', scoreCT: 5, scoreT: 7 },
    { round: 13, winner: 'CT', reason: 'elimination', scoreCT: 6, scoreT: 7 },
    { round: 14, winner: 'T', reason: 'elimination', scoreCT: 6, scoreT: 8 },
    { round: 15, winner: 'T', reason: 'exploded', scoreCT: 6, scoreT: 9 },
    { round: 16, winner: 'CT', reason: 'defused', scoreCT: 7, scoreT: 9 },
    { round: 17, winner: 'T', reason: 'elimination', scoreCT: 7, scoreT: 10 },
  ],
  recentEvents: [
    { id: '1', time: '13:42:10', type: 'kill', text: 'k0t убил stormy (M4A1-S, хедшот)', attackerName: 'k0t', attackerTeam: 'CT', victimName: 'stormy', victimTeam: 'T', weapon: 'm4a1_silencer', headshot: true },
    { id: '2', time: '13:42:15', type: 'kill', text: 'quiet убил s1mple_fan (AK-47)', attackerName: 'quiet', attackerTeam: 'T', victimName: 's1mple_fan', victimTeam: 'CT', weapon: 'ak47', headshot: false },
    { id: '3', time: '13:42:24', type: 'kill', text: 'apex_predator убил cyberschool (AK-47)', attackerName: 'apex_predator', attackerTeam: 'T', victimName: 'cyberschool', victimTeam: 'CT', weapon: 'ak47', headshot: false },
  ],
  isSimulating: false,
};

interface StoredData {
  tournament: TournamentState;
  settings: ServerSettings;
  liveMatch: LiveMatchState;
}

class Storage {
  private data: StoredData;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.data = this.load();
  }

  private load(): StoredData {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.tournament && parsed.settings && parsed.liveMatch) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('Failed to read data file, using default state:', err);
    }

    const initial: StoredData = {
      tournament: defaultTournamentState,
      settings: defaultSettings,
      liveMatch: defaultLiveState,
    };
    this.scheduleSave(initial);
    return initial;
  }

  private scheduleSave(dataToSave?: StoredData) {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      try {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        const toWrite = dataToSave || this.data;
        fs.writeFileSync(DATA_FILE, JSON.stringify(toWrite, null, 2), 'utf-8');
      } catch (err) {
        console.error('Failed to save tournament data:', err);
      }
    }, 300);
  }

  public getTournament(): TournamentState {
    return this.data.tournament;
  }

  public setTournament(state: TournamentState): TournamentState {
    this.data.tournament = state;
    this.scheduleSave();
    return this.data.tournament;
  }

  public updateMatch(id: string, patch: Partial<Match>): Match | undefined {
    let updated: Match | undefined;
    this.data.tournament.matches = this.data.tournament.matches.map(match => {
      if (match.id === id) {
        updated = { ...match, ...patch };
        return updated;
      }
      return match;
    });
    this.scheduleSave();
    return updated;
  }

  public updateTeam(id: string, patch: Partial<Team>): Team | undefined {
    let updated: Team | undefined;
    this.data.tournament.teams = this.data.tournament.teams.map(team => {
      if (team.id === id) {
        updated = { ...team, ...patch };
        return updated;
      }
      return team;
    });
    this.scheduleSave();
    return updated;
  }

  public resetTournament(): TournamentState {
    this.data.tournament = JSON.parse(JSON.stringify(defaultTournamentState));
    this.data.liveMatch = JSON.parse(JSON.stringify(defaultLiveState));
    this.scheduleSave();
    return this.data.tournament;
  }

  public getSettings(): ServerSettings {
    return this.data.settings;
  }

  public updateSettings(patch: Partial<ServerSettings>): ServerSettings {
    this.data.settings = { ...this.data.settings, ...patch };
    this.scheduleSave();
    return this.data.settings;
  }

  public getLiveMatch(): LiveMatchState {
    // Check if server is considered offline (no heartbeat in 15 seconds, and not simulating)
    const now = Date.now();
    const isOnline = this.data.liveMatch.isSimulating || (this.data.liveMatch.lastHeartbeat > 0 && now - this.data.liveMatch.lastHeartbeat < 20000);
    return {
      ...this.data.liveMatch,
      serverConnected: isOnline,
    };
  }

  public updateLiveMatch(patch: Partial<LiveMatchState>): LiveMatchState {
    this.data.liveMatch = {
      ...this.data.liveMatch,
      ...patch,
      lastHeartbeat: patch.lastHeartbeat ?? Date.now(),
      serverConnected: true,
    };
    this.scheduleSave();
    return this.data.liveMatch;
  }
}

export const storage = new Storage();
