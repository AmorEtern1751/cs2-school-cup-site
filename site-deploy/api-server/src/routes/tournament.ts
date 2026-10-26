import { Router, type IRouter } from 'express';
import { storage } from '../storage';
import { liveManager } from '../liveManager';
import { verifyAdminAuth } from './admin';

const router: IRouter = Router();

// Public: Everyone can view the tournament bracket
router.get('/tournament', (_req, res) => {
  res.json(storage.getTournament());
});

// Protected: Only admins can edit tournament data
router.put('/tournament', verifyAdminAuth, async (req, res) => {
  const updated = storage.setTournament(req.body);
  await storage.flush();
  liveManager.broadcastTournamentUpdate();
  res.json(updated);
});

router.patch('/tournament/match/:id', verifyAdminAuth, async (req, res) => {
  const { id } = req.params;
  const updated = storage.updateMatch(id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Match not found' });
  }
  await storage.flush();
  liveManager.broadcastTournamentUpdate();
  res.json(updated);
});

router.patch('/tournament/team/:id', verifyAdminAuth, async (req, res) => {
  const { id } = req.params;
  const updated = storage.updateTeam(id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Team not found' });
  }
  await storage.flush();
  liveManager.broadcastTournamentUpdate();
  res.json(updated);
});

router.post('/tournament/reset', verifyAdminAuth, async (_req, res) => {
  const reset = storage.resetTournament();
  await storage.flush();
  liveManager.broadcastTournamentUpdate();
  liveManager.broadcastLiveUpdate(storage.getLiveMatch());
  res.json(reset);
});

export default router;
