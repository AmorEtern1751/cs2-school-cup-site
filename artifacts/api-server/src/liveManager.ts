import type { Response } from 'express';
import { storage } from './storage';
import {
  LiveMatchState,
  LivePlayer,
  LiveRoundHistory,
  LiveEvent,
  Match,
  resolveMatch,
} from './types/tournament';

class LiveManager {
  private clients: Set<Response> = new Set();
  private pingInterval: NodeJS.Timeout | null = null;
  private simulatorInterval: NodeJS.Timeout | null = null;
  private simStep = 0;

  constructor() {
    this.startPing();
  }

  private startPing() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      this.broadcast('ping', { time: Date.now() });
    }, 15000);
  }

  public addClient(res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    this.clients.add(res);

    // Send initial snapshot immediately
    const live = storage.getLiveMatch();
    const tournament = storage.getTournament();
    const settings = storage.getSettings();

    res.write(`event: init\ndata: ${JSON.stringify({ live, tournament, settings })}\n\n`);

    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  public broadcast(event: string, data: unknown) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of this.clients) {
      try {
        res.write(message);
      } catch {
        this.clients.delete(res);
      }
    }
  }

  public broadcastLiveUpdate(live: LiveMatchState) {
    this.broadcast('live_update', live);
  }

  public broadcastTournamentUpdate() {
    const tournament = storage.getTournament();
    this.broadcast('tournament_update', tournament);
  }

  public broadcastEvent(event: LiveEvent) {
    this.broadcast('game_event', event);
  }

  /**
   * Process incoming payload from CounterStrikeSharp plugin or GSI
   */
  public handleServerPayload(payload: Partial<LiveMatchState> & {
    eventType?: string;
    eventData?: unknown;
  }) {
    const settings = storage.getSettings();
    const currentLive = storage.getLiveMatch();
    const targetMatchId = payload.matchId || settings.activeMatchId;
    const tournament = storage.getTournament();
    const activeMatch = tournament.matches.find(m => m.id === targetMatchId);
    const resolvedPair = activeMatch ? resolveMatch(tournament, activeMatch) : { a: undefined, b: undefined };

    // Build updated live state
    const updatedPlayers = payload.players ?? currentLive.players;
    const teamCT = payload.teamCT ? { ...currentLive.teamCT, ...payload.teamCT } : { ...currentLive.teamCT };
    const teamT = payload.teamT ? { ...currentLive.teamT, ...payload.teamT } : { ...currentLive.teamT };

    const cleanMap = (payload.map || currentLive.map || 'de_mirage').replace(/^de_/, '');
    const capitalizedMap = cleanMap.charAt(0).toUpperCase() + cleanMap.slice(1);

    // Track which team (Team A or Team B) is currently playing as CT
    // In CS2, teams swap sides at half-time (round 13 for MR12, or round 15 for MR15)
    // and can swap during overtimes (every 3 rounds).
    const ctScore = teamCT.score ?? 0;
    const tScore = teamT.score ?? 0;
    const currentRoundNumber = payload.currentRound ?? (ctScore + tScore + 1);

    let isTeamACurrentlyCT = true;
    if (currentRoundNumber <= 12) {
      isTeamACurrentlyCT = true;
    } else if (currentRoundNumber <= 24) {
      isTeamACurrentlyCT = false;
    } else {
      // Overtime: 3 rounds per half (25-27, 28-30, etc.)
      const otRound = currentRoundNumber - 24;
      const otHalf = Math.floor((otRound - 1) / 3);
      isTeamACurrentlyCT = otHalf % 2 === 1;
    }

    const teamForCT = isTeamACurrentlyCT ? resolvedPair.a : resolvedPair.b;
    const teamForT = isTeamACurrentlyCT ? resolvedPair.b : resolvedPair.a;

    if (teamForCT) {
      teamCT.name = teamForCT.name;
      teamCT.id = teamForCT.id;
    }
    if (teamForT) {
      teamT.name = teamForT.name;
      teamT.id = teamForT.id;
    }

    const newLive: LiveMatchState = {
      ...currentLive,
      serverConnected: true,
      lastHeartbeat: Date.now(),
      serverName: payload.serverName || currentLive.serverName,
      matchId: targetMatchId,
      map: payload.map || currentLive.map,
      currentRound: payload.currentRound ?? currentLive.currentRound,
      phase: payload.phase ?? currentLive.phase,
      teamCT,
      teamT,
      bomb: payload.bomb ? { ...currentLive.bomb, ...payload.bomb } : currentLive.bomb,
      players: updatedPlayers,
      roundHistory: payload.roundHistory ?? currentLive.roundHistory,
      recentEvents: payload.recentEvents ?? currentLive.recentEvents,
      isSimulating: false,
    };

    storage.updateLiveMatch(newLive);
    this.broadcastLiveUpdate(newLive);

    // Keep tournament bracket match synchronized with server
    if (targetMatchId) {
      const tournament = storage.getTournament();
      const match = tournament.matches.find(m => m.id === targetMatchId);
      if (match) {
        const patch: Partial<Match> = {};
        if (match.status !== 'LIVE' && match.status !== 'Завершён') {
          patch.status = 'LIVE';
        }
        patch.currentMap = capitalizedMap;
        patch.currentRound = `${teamCT.score} : ${teamT.score}`;

        // Map live players to tournament player stats
        if (updatedPlayers.length > 0) {
          const resolved = resolveMatch(tournament, match);
          patch.players = updatedPlayers.map(p => {
            const teamId = p.team === 'CT'
              ? (teamCT.id || resolved.a?.id || 'echo')
              : (teamT.id || resolved.b?.id || 'tactic');
            return {
              name: p.name,
              teamId,
              kills: p.kills,
              deaths: p.deaths,
              assists: p.assists,
              adr: p.adr,
              hs: p.headshots,
              mvp: p.mvps,
            };
          });
        }

        // If game is finished on CS2 server
        if (payload.phase === 'game_over' || teamCT.score >= 13 || teamT.score >= 13) {
          // If this map isn't recorded yet, add it
          const existingMapIndex = match.maps.findIndex(m => m.map.toLowerCase() === capitalizedMap.toLowerCase());
          const newMaps = [...match.maps];
          if (existingMapIndex >= 0) {
            newMaps[existingMapIndex] = { map: capitalizedMap, a: teamCT.score, b: teamT.score };
          } else {
            newMaps.push({ map: capitalizedMap, a: teamCT.score, b: teamT.score });
          }
          patch.maps = newMaps;

          const winsNeeded = match.round === 'final' ? 3 : 2;
          const winsA = newMaps.filter(m => m.a > m.b).length;
          const winsB = newMaps.filter(m => m.b > m.a).length;

          if (winsA >= winsNeeded || winsB >= winsNeeded) {
            patch.status = 'Завершён';
          }
        }

        storage.updateMatch(match.id, patch);
        this.broadcastTournamentUpdate();
      }
    }
  }

  /**
   * Record a discrete event from CounterStrikeSharp (e.g. kill, bomb plant)
   */
  public addEvent(event: Omit<LiveEvent, 'id' | 'time'>) {
    const live = storage.getLiveMatch();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const newEvent: LiveEvent = {
      ...event,
      id: Math.random().toString(36).substring(2, 9),
      time: timeStr,
    };

    const recentEvents = [newEvent, ...live.recentEvents.slice(0, 19)];
    storage.updateLiveMatch({ recentEvents });
    this.broadcastEvent(newEvent);
  }

  /**
   * Start built-in realistic CS2 match simulation for testing without game server
   */
  public startSimulator() {
    if (this.simulatorInterval) return;

    const weaponsCT = ['m4a1_silencer', 'm4a4', 'awp', 'famas', 'usp_silencer', 'mp9'];
    const weaponsT = ['ak47', 'awp', 'galilar', 'glock', 'mac10', 'sg553'];

    let live = storage.getLiveMatch();
    live = {
      ...live,
      isSimulating: true,
      serverConnected: true,
      serverName: 'Школьный CS2 Сервер · СИМУЛЯЦИЯ',
      map: 'de_mirage',
      phase: 'live',
      bomb: { state: null, site: null, plantedAt: null, planterName: null },
    };
    storage.updateLiveMatch(live);
    this.broadcastLiveUpdate(live);

    this.simStep = 0;

    this.simulatorInterval = setInterval(() => {
      live = storage.getLiveMatch();
      if (!live.isSimulating) {
        this.stopSimulator();
        return;
      }

      this.simStep++;
      const aliveCT = live.players.filter(p => p.team === 'CT' && p.isAlive);
      const aliveT = live.players.filter(p => p.team === 'T' && p.isAlive);

      // Random kill event
      if (aliveCT.length > 0 && aliveT.length > 0 && Math.random() > 0.35) {
        const ctKills = Math.random() > 0.5;
        const attacker = ctKills
          ? aliveCT[Math.floor(Math.random() * aliveCT.length)]
          : aliveT[Math.floor(Math.random() * aliveT.length)];
        const victim = ctKills
          ? aliveT[Math.floor(Math.random() * aliveT.length)]
          : aliveCT[Math.floor(Math.random() * aliveCT.length)];

        const isHeadshot = Math.random() > 0.45;
        const weaponList = ctKills ? weaponsCT : weaponsT;
        const weapon = weaponList[Math.floor(Math.random() * weaponList.length)];

        // Update player stats
        attacker.kills += 1;
        if (isHeadshot) attacker.headshots += 1;
        attacker.damage += isHeadshot ? 100 : 85;
        attacker.hsPercentage = Math.round((attacker.headshots / attacker.kills) * 100);
        victim.isAlive = false;
        victim.health = 0;
        victim.deaths += 1;

        const eventText = `${attacker.name} ликвидировал ${victim.name} (${weapon.toUpperCase()}${isHeadshot ? ', в голову' : ''})`;
        this.addEvent({
          type: 'kill',
          text: eventText,
          attackerName: attacker.name,
          attackerTeam: attacker.team as 'CT' | 'T',
          victimName: victim.name,
          victimTeam: victim.team as 'CT' | 'T',
          weapon,
          headshot: isHeadshot,
        });
      }

      // Bomb planting
      if (!live.bomb.state && aliveT.length > 0 && this.simStep % 6 === 0) {
        const planter = aliveT[0];
        const site = Math.random() > 0.5 ? 'A' : 'B';
        live.bomb = {
          state: 'planted',
          site,
          plantedAt: Date.now(),
          planterName: planter.name,
        };
        live.phase = 'bomb_planted';
        this.addEvent({
          type: 'bomb',
          text: `Бомба заложена на точке ${site} игроком ${planter.name}!`,
        });
      }

      // Check round end
      const remainingCT = live.players.filter(p => p.team === 'CT' && p.isAlive).length;
      const remainingT = live.players.filter(p => p.team === 'T' && p.isAlive).length;

      let roundWinner: 'CT' | 'T' | null = null;
      let reason: 'elimination' | 'defused' | 'exploded' | 'timeout' = 'elimination';

      if (remainingCT === 0 && live.bomb.state === 'planted') {
        roundWinner = 'T';
        reason = 'exploded';
      } else if (remainingCT === 0) {
        roundWinner = 'T';
        reason = 'elimination';
      } else if (remainingT === 0 && live.bomb.state === 'planted') {
        // CT defuse chance
        if (Math.random() > 0.3) {
          roundWinner = 'CT';
          reason = 'defused';
        } else {
          roundWinner = 'T';
          reason = 'exploded';
        }
      } else if (remainingT === 0) {
        roundWinner = 'CT';
        reason = 'elimination';
      }

      if (roundWinner) {
        if (roundWinner === 'CT') {
          live.teamCT.score += 1;
        } else {
          live.teamT.score += 1;
        }

        const newHistory: LiveRoundHistory = {
          round: live.currentRound,
          winner: roundWinner,
          reason,
          scoreCT: live.teamCT.score,
          scoreT: live.teamT.score,
        };

        live.roundHistory.push(newHistory);
        live.currentRound += 1;
        live.phase = 'round_ended';
        live.bomb = { state: null, site: null, plantedAt: null, planterName: null };

        this.addEvent({
          type: 'round',
          text: `Раунд завершен! Победа ${roundWinner === 'CT' ? live.teamCT.name : live.teamT.name} (${reason === 'defused' ? 'разминирование' : reason === 'exploded' ? 'взрыв бомбы' : 'уничтожение соперника'}). Счёт: ${live.teamCT.score} : ${live.teamT.score}`,
        });

        // Reset players for next round
        for (const p of live.players) {
          p.isAlive = true;
          p.health = 100;
          p.armor = 100;
          p.money += roundWinner === p.team ? 3250 : 1900;
          p.adr = Math.round(p.damage / Math.max(1, live.currentRound));
        }

        // Check map win (first to 13)
        if (live.teamCT.score >= 13 || live.teamT.score >= 13) {
          live.phase = 'game_over';
          const winnerName = live.teamCT.score >= 13 ? live.teamCT.name : live.teamT.name;
          this.addEvent({
            type: 'info',
            text: `Матч на карте завершён! Победитель: ${winnerName}!`,
          });
        }
      }

      storage.updateLiveMatch(live);
      this.handleServerPayload(live);
    }, 3000);
  }

  public stopSimulator() {
    if (this.simulatorInterval) {
      clearInterval(this.simulatorInterval);
      this.simulatorInterval = null;
    }
    const live = storage.getLiveMatch();
    live.isSimulating = false;
    storage.updateLiveMatch(live);
    this.broadcastLiveUpdate(live);
  }
}

export const liveManager = new LiveManager();
