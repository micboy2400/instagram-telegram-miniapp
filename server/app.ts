import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { resolve } from 'node:path';
import { validateInitData } from './auth.js';

export function createApp(token: string, trustProxy = false) {
  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 'loopback');
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'", 'https://telegram.org'],
    styleSrc: ["'self'"], connectSrc: ["'self'"], imgSrc: ["'self'", 'data:'],
    frameAncestors: ['https://web.telegram.org', 'https://*.telegram.org'],
  } }, frameguard: false }));
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.post('/api/auth', rateLimit({ windowMs: 60_000, limit: 30 }), express.json({ limit: '20kb' }), (req, res) => {
    if (!token) { res.status(503).json({ error: 'Telegram authentication is not configured' }); return; }
    try {
      if (typeof req.body?.initData !== 'string') throw new Error('Missing data');
      const user = validateInitData(req.body.initData, token);
      res.json({ user });
    } catch { res.status(401).json({ error: 'Invalid or expired Telegram session. Reopen the app from the bot.' }); }
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  const client = resolve('dist/client');
  app.use(express.static(client));
  app.get('/', (_req, res) => res.sendFile(resolve(client, 'index.html')));
  app.use((err: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status === 413 ? 413 : 400).json({ error: 'Invalid request' });
  });
  return app;
}
