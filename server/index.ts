import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import { z } from 'zod';
import { createApp } from './app.js';

const config = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('127.0.0.1'),
  BOT_TOKEN: z.string().default(''),
  BOT_ENABLED: z.enum(['true', 'false']).default('true'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  APP_URL: z.url().refine(v => new URL(v).protocol === 'https:', 'APP_URL must use HTTPS').optional(),
}).parse(process.env);
if (config.BOT_ENABLED === 'true' && (!config.BOT_TOKEN || !config.APP_URL)) {
  throw new Error('BOT_TOKEN and HTTPS APP_URL are required when BOT_ENABLED=true');
}
const app = createApp(config.BOT_TOKEN, config.TRUST_PROXY === 'true');
const server = app.listen(config.PORT, config.HOST, () => console.log(`API listening on port ${config.PORT}`));
let bot: Telegraf | undefined;
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  if (bot) { try { bot.stop('shutdown'); } catch { /* launch may still be pending */ } }
  server.close();
  setTimeout(() => process.exit(process.exitCode ?? 0), 5000).unref();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
if (config.BOT_ENABLED === 'true') {
  bot = new Telegraf(config.BOT_TOKEN);
  bot.start(ctx => ctx.reply('Open the Mini App to continue to Instagram’s official website.',
    Markup.inlineKeyboard([Markup.button.webApp('Open App', config.APP_URL!)])));
  bot.command('help', ctx => ctx.reply('Use /start in this private chat, then tap Open App. This app never receives your Instagram login details.'));
  bot.catch(() => console.error('Telegram update failed'));
  // Long polling: run exactly one instance and remove any previous webhook first.
  void (async () => {
    await bot!.telegram.deleteWebhook();
    if (stopping) return;
    await bot!.telegram.setChatMenuButton({ menuButton: { type: 'web_app', text: 'Open App', web_app: { url: config.APP_URL! } } });
    await bot!.launch();
  })().catch(() => { console.error('Bot startup failed. Check Telegram access, token, and APP_URL.'); process.exitCode = 1; shutdown(); });
}
