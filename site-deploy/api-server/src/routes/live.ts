import { Router, type IRouter } from 'express';
import { storage } from '../storage';
import { liveManager } from '../liveManager';

const router: IRouter = Router();

router.get('/live', (_req, res) => {
  res.json(storage.getLiveMatch());
});

router.get('/live/stream', (req, res) => {
  liveManager.addClient(res);
});

export default router;
