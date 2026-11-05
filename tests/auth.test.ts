import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { createApp } from '../server/app.js';
import { validateInitData } from '../server/auth.js';
const token = 'test-only-token';
const now = Math.floor(Date.now() / 1000);
function signed(date = now, user = JSON.stringify({ id: 123 })) {
  const params = new URLSearchParams({ auth_date: String(date), query_id: 'abc', user });
  const data = [...params].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secret).update(data).digest('hex'));
  return params.toString();
}
test('accepts correctly signed Telegram user', () => {
  assert.deepEqual(validateInitData(signed(), token, now), { id: 123 });
});
test('rejects tampering and wrong bot token', () => {
  assert.throws(() => validateInitData(signed().replace('abc', 'altered'), token, now));
  assert.throws(() => validateInitData(signed(), 'wrong', now));
});
test('rejects old and future sessions', () => {
  assert.throws(() => validateInitData(signed(now - 301), token, now));
  assert.throws(() => validateInitData(signed(now + 31), token, now));
});
test('rejects malformed signatures, duplicate fields, and invalid users', () => {
  assert.throws(() => validateInitData('hash=bad', token, now));
  assert.throws(() => validateInitData(signed() + '&auth_date=1', token, now));
  assert.throws(() => validateInitData(signed(now, '{"id":"123"}'), token, now));
  assert.throws(() => validateInitData(signed(now, 'invalid'), token, now));
});
test('HTTP API returns health, verifies user, rejects invalid input, and disables caching', async () => {
  const server = createApp(token).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  try {
    assert.deepEqual(await (await fetch(url + '/api/health')).json(), { status: 'ok' });
    const valid = await fetch(url + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: signed() }) });
    assert.equal(valid.status, 200);
    assert.equal(valid.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await valid.json(), { user: { id: 123 } });
    const invalid = await fetch(url + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: 'fake' }) });
    assert.equal(invalid.status, 401);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
