import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express';
import { storage } from '../storage';
import { liveManager } from '../liveManager';

const router: IRouter = Router();

export function verifyAdminAuth(req: Request, res: Response, next: NextFunction) {
  const settings = storage.getSettings();
  const currentPassword = settings.adminPassword || 'admin123';

  const provided =
    req.headers['x-admin-password'] ||
    req.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
    req.query.adminPassword;

  if (provided === currentPassword) {
    return next();
  }

  return res.status(401).json({ error: 'Требуется пароль администратора' });
}

/**
 * Check admin login
 * POST /api/admin/login
 */
router.post('/admin/login', (req, res) => {
  const { password } = req.body;
  const settings = storage.getSettings();
  const currentPassword = settings.adminPassword || 'admin123';

  if (password === currentPassword) {
    return res.json({ success: true, token: currentPassword });
  }

  return res.status(401).json({ error: 'Неверный пароль администратора' });
});

/**
 * Verify if token/password is valid
 * GET /api/admin/auth-check
 */
router.get('/admin/auth-check', verifyAdminAuth, (_req, res) => {
  res.json({ authenticated: true });
});

/**
 * Change admin password
 * POST /api/admin/change-password
 */
router.post('/admin/change-password', verifyAdminAuth, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
    return res.status(400).json({ error: 'Пароль должен содержать не менее 4 символов' });
  }

  storage.updateSettings({ adminPassword: newPassword.trim() });
  await storage.flush();
  return res.json({ success: true, message: 'Пароль успешно изменён' });
});

/**
 * Protected Admin Settings
 */
router.get('/admin/settings', verifyAdminAuth, (_req, res) => {
  res.json(storage.getSettings());
});

router.post('/admin/settings', verifyAdminAuth, async (req, res) => {
  const updated = storage.updateSettings(req.body);
  await storage.flush();
  liveManager.broadcast('settings_update', updated);
  res.json(updated);
});

/**
 * Protected Simulation Controls
 */
router.post('/admin/simulate/start', verifyAdminAuth, (_req, res) => {
  liveManager.startSimulator();
  res.json({ status: 'ok', simulating: true });
});

router.post('/admin/simulate/stop', verifyAdminAuth, (_req, res) => {
  liveManager.stopSimulator();
  res.json({ status: 'ok', simulating: false });
});

export default router;
