import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

type TelegramWebApp = {
  initData: string;
  ready(): void;
  expand(): void;
  isVersionAtLeast(version: string): boolean;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
};
declare global { interface Window { Telegram?: { WebApp?: TelegramWebApp } } }
const INSTAGRAM_LOGIN = 'https://www.instagram.com/accounts/login/';
function App() {
  const [status, setStatus] = useState<'loading' | 'verified' | 'error'>('loading');
  const [message, setMessage] = useState('Checking your Telegram session…');
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const tg = window.Telegram?.WebApp;
    tg?.ready();
    tg?.expand();
    if (!tg?.initData) {
      setStatus('error'); setMessage('Open this app from the Telegram bot on iOS or Android to continue.');
      return;
    }
    if (!tg.isVersionAtLeast('6.1')) {
      setStatus('error'); setMessage('Update Telegram to use secure link opening.'); return;
    }
    void fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData }), signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error(response.status === 401 ? 'Your session expired. Close this app and reopen it from the bot.' : 'Session verification is unavailable. Please try again later.');
      setStatus('verified'); setMessage('Telegram session verified');
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setStatus('error'); setMessage(error instanceof Error ? error.message : 'Unable to verify your session.');
    });
    return () => controller.abort();
  }, []);
  function openInstagram() {
    try {
      window.Telegram!.WebApp!.openLink(INSTAGRAM_LOGIN, { try_instant_view: false });
      setOpened(true);
    } catch { setMessage('Could not open the link. Update Telegram and try again.'); }
  }
  return <main>
    <div className="brand"><span className="mark" aria-hidden="true">↗</span> Instagram Link</div>
    <section className="card">
      <p className="eyebrow">YOUR NEXT STOP</p>
      <h1>Instagram.<br />On its own terms.</h1>
      <p className="intro">Continue to Instagram’s official website to log in securely.</p>
      <div className="destination"><span aria-hidden="true">↗</span><div><strong>instagram.com</strong><small>Official login page</small></div><span className="secure">HTTPS</span></div>
      <button disabled={status !== 'verified'} onClick={openInstagram}>{status === 'loading' ? 'Verifying session…' : 'Open Instagram'} <span aria-hidden="true">↗</span></button>
      <p className={`status ${status}`} role="status">{message}</p>
      {opened && <p role="status">Instagram was requested in your browser. If it did not open, return here and tap again.</p>}
    </section>
    <aside><h2>Your login stays with Instagram</h2><p>We never ask for or receive your Instagram password, cookies, or session tokens. Login happens only on Instagram.</p></aside>
    <footer>Independent link launcher. Not affiliated with Instagram or Meta. Telegram and your device control how the link opens. No VPN settings are changed.</footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
