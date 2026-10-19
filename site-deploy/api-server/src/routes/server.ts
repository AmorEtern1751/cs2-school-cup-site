import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express';
import { storage } from '../storage';
import { liveManager } from '../liveManager';

const router: IRouter = Router();

// Middleware to verify server token
function verifyServerToken(req: Request, res: Response, next: NextFunction) {
  const settings = storage.getSettings();
  const token =
    req.headers['x-server-token'] ||
    req.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
    req.query.token;

  // Allow if no token configured or tokens match
  if (!settings.serverToken || token === settings.serverToken) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized: Invalid server token' });
}

/**
 * Main webhook endpoint for CounterStrikeSharp plugin
 * POST /api/server/live
 */
router.post('/server/live', verifyServerToken, (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  liveManager.handleServerPayload(payload);
  return res.json({ status: 'ok', time: Date.now() });
});

/**
 * Event-based webhook for discrete events (kills, bomb plants, etc.)
 * POST /api/server/event
 */
router.post('/server/event', verifyServerToken, (req, res) => {
  const { type, text, attackerName, attackerTeam, victimName, victimTeam, weapon, headshot } = req.body;

  if (text) {
    liveManager.addEvent({
      type: type || 'info',
      text,
      attackerName,
      attackerTeam,
      victimName,
      victimTeam,
      weapon,
      headshot: Boolean(headshot),
    });
  }

  return res.json({ status: 'ok' });
});

/**
 * MatchZy webhook compatibility endpoint
 * POST /api/server/matchzy
 */
router.post('/server/matchzy', (req, res) => {
  const data = req.body;
  if (!data) return res.status(400).json({ error: 'No data' });

  // MatchZy sends event names like "round_end", "player_death", "series_start", "map_result"
  const eventName = data.event || data.type;

  if (eventName === 'round_end') {
    const live = storage.getLiveMatch();
    const winner = data.winner === 'CT' || data.winner === 'TERRORIST'
      ? (data.winner === 'CT' ? 'CT' : 'T')
      : 'CT';
    const ctScore = data.team1?.score ?? data.ct_score ?? live.teamCT.score;
    const tScore = data.team2?.score ?? data.t_score ?? live.teamT.score;

    liveManager.handleServerPayload({
      currentRound: (live.currentRound || 1) + 1,
      phase: 'round_ended',
      teamCT: { ...live.teamCT, score: ctScore },
      teamT: { ...live.teamT, score: tScore },
    });

    liveManager.addEvent({
      type: 'round',
      text: `[MatchZy] Раунд завершён! Победитель: ${winner}. Счёт: ${ctScore} : ${tScore}`,
    });
  } else if (eventName === 'player_death') {
    const attacker = data.attacker?.name || 'Игрок';
    const victim = data.victim?.name || 'Игрок';
    const weapon = data.weapon || 'CS2';
    const headshot = Boolean(data.headshot);

    liveManager.addEvent({
      type: 'kill',
      text: `${attacker} убил ${victim} (${weapon}${headshot ? ', хедшот' : ''})`,
      attackerName: attacker,
      victimName: victim,
      weapon,
      headshot,
    });
  }

  return res.json({ status: 'ok' });
});

/**
 * Health & connection status for game server
 * GET /api/server/status
 */
router.get('/server/status', (req, res) => {
  const live = storage.getLiveMatch();
  const settings = storage.getSettings();
  res.json({
    connected: live.serverConnected,
    isSimulating: Boolean(live.isSimulating),
    lastHeartbeat: live.lastHeartbeat,
    serverName: live.serverName,
    map: live.map,
    currentRound: live.currentRound,
    activeMatchId: settings.activeMatchId,
    tokenConfigured: Boolean(settings.serverToken),
  });
});

export default router;
