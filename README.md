# Instagram Telegram Mini App

A mobile React Mini App, Express API, and Telegraf bot. The bot provides an **Open App** button and chat menu button. After verifying the Telegram session, the Mini App opens Instagram’s official login page using `Telegram.WebApp.openLink`.

This is an independent link launcher, not an Instagram integration. It never collects Instagram passwords, cookies, or tokens, imitates login forms, proxies authentication, or bypasses Meta restrictions. It does not configure a device VPN. There is no Instagram OAuth callback, account connection, or claim that opening a page proves login.

## Requirements

- Node.js 22.12+ or 24 LTS and npm (use the committed lockfile).
- A Telegram bot token from @BotFather and a public HTTPS hostname for full operation.
- Outbound HTTPS access to `api.telegram.org`; browser access to `telegram.org` (Telegram SDK) and `www.instagram.com`.

## Local development

```sh
npm ci
```

Copy `.env.example` to `.env` and configure the values. Never commit `.env` or expose the bot token through a `VITE_` variable. For frontend/API development without a bot, set `BOT_ENABLED=false`, leave `BOT_TOKEN` empty, and set `NODE_ENV=development`.

```sh
npm run dev
npm run check
npm test
npm run build
```

Vite serves port 5173 and proxies `/api` to Express on port 3000. A regular browser shows instructions to open Telegram; fake sessions are rejected. To test the full flow, expose the development frontend through your own HTTPS endpoint, set `APP_URL` to that address, and enable the bot. Configure the hostname in @BotFather's Bot Settings / Menu Button as needed. Start a **private chat** with the bot, send `/start`, and tap **Open App**.

Production runs `npm run build` then `npm start`; Express serves both the built UI and API from the repository working directory. `/api/health` checks HTTP availability only; it does not prove bot polling works. One bot process must run at a time. Startup removes any previous bot webhook because this deployment uses long polling.

## Configuration

| Variable | Purpose |
| --- | --- |
| `BOT_TOKEN` | Secret token from @BotFather; required when the bot is enabled and for successful session validation |
| `APP_URL` | Public HTTPS Mini App URL; required when bot is enabled |
| `BOT_ENABLED` | `true` by default; `false` allows development without bot credentials |
| `PORT` | Express port, default `3000` |
| `HOST` | Bind address, default `127.0.0.1` |
| `TRUST_PROXY` | Default `false`; set `true` only behind the local reverse proxy below |
| `NODE_ENV` | Use `production` in deployment |

Session verification uses Telegram's HMAC-SHA256 algorithm, constant-time hash comparison, duplicate-field rejection, five-minute expiry, and a 30-second future-clock allowance. Keep the server clock synchronized. The API returns only the verified Telegram user ID, stores no session, and does not log signed data. Every future protected endpoint must independently validate initData or use a separately designed server session; this verification response is not an access token. Signed data can be replayed within its validity window, so do not use it as a one-time transaction authorization. Rate limiting is in-memory for the documented single instance.

## Windows RDP server with HTTPS

RDP provides administration, not HTTPS hosting. Use a Windows server with a public IP, a domain pointing to it, and inbound TCP 80/443 allowed in both the cloud firewall and Windows Firewall. Keep port 3000 private. Install Node.js 24 LTS, Git, and the official Caddy Windows binary from trusted sources. Do not disable TLS verification.

1. Clone this repository to `C:\apps\instagram-telegram-miniapp`. In PowerShell there, run `npm ci`, `npm run check`, `npm test`, and `npm run build`.
2. Run `Copy-Item .env.example .env`. Edit `.env`: set the real `BOT_TOKEN`, `APP_URL=https://your-domain.example`, `BOT_ENABLED=true`, `NODE_ENV=production`, `HOST=127.0.0.1`, and `TRUST_PROXY=true`. Restrict file access to the service account and administrators.
3. Edit `deploy\Caddyfile` with your domain and certificate contact email. Start the application with `npm start` from the repository directory. Start Caddy with `caddy run --config C:\apps\instagram-telegram-miniapp\deploy\Caddyfile --adapter caddyfile`. Caddy obtains/renews the certificate and forwards to the loopback API. Do not expose Node directly.
4. Verify `Invoke-RestMethod https://your-domain.example/api/health` returns `status: ok`. An unsigned POST to `/api/auth` must return 401. Check the browser certificate and send `/start` to the bot.
5. For restart persistence, create two Windows Task Scheduler tasks under a restricted service account, triggered **At startup**, configured **Run whether user is logged on or not**, with restart-on-failure enabled and no execution time limit. App action: full path to `node.exe`, arguments `--env-file=.env dist/server/index.js`, Start in `C:\apps\instagram-telegram-miniapp`. Caddy action: full path to `caddy.exe`, arguments `run --config C:\apps\instagram-telegram-miniapp\deploy\Caddyfile --adapter caddyfile`, same working directory. Retain Caddy's writable certificate storage for that account. Stop interactive copies before starting tasks.
6. Reboot and repeat the HTTPS and bot checks. Restrict RDP access separately. Back up configuration securely; never put secrets in command arguments or source control.

To update, stop the application task, pull the desired commit, run `npm ci && npm run build` in a shell supporting that syntax (or run each command separately in Windows PowerShell), and restart the task. Keep Caddy running.

## Validation and mobile acceptance

Automated tests cover signed payload acceptance, tampering, wrong tokens, stale/future dates, duplicate fields, malformed users, and HTTP auth behavior. `npm run build` checks frontend/backend TypeScript and produces `dist/client` and `dist/server`.

On **both iOS and Android**, use a current Telegram client: open the bot's private chat, launch the Mini App, confirm session verification, tap Open Instagram, and check that the official `https://www.instagram.com/accounts/login/` destination opens. Return to Telegram, close/reopen the Mini App after five minutes, and verify a fresh launch works. Browser choice and installed-app routing are controlled by Telegram and the OS; the app cannot force a specific browser or guarantee Instagram availability. No credentials should ever be entered in the Mini App. Real-device and live bot tests require your deployment and bot token and are not covered by the automated suite.
