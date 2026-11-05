import { createHmac, timingSafeEqual } from 'node:crypto';

/** Verify the original Telegram query string; never trust initDataUnsafe. */
export function validateInitData(raw: string, token: string, now = Math.floor(Date.now() / 1000)) {
  if (!raw || raw.length > 16_384 || !token) throw new Error('Invalid Telegram data');
  const params = new URLSearchParams(raw);
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate fields');
  const hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) throw new Error('Invalid hash');
  params.delete('hash');
  const data = [...params.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const expected = createHmac('sha256', secret).update(data).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) throw new Error('Invalid signature');
  const authDate = Number(params.get('auth_date'));
  if (!Number.isInteger(authDate) || authDate <= 0 || now - authDate > 300 || authDate > now + 30) {
    throw new Error('Expired Telegram data');
  }
  const user: unknown = JSON.parse(params.get('user') ?? 'null');
  if (!user || typeof user !== 'object' || !('id' in user) ||
      typeof user.id !== 'number' || !Number.isSafeInteger(user.id) || user.id <= 0) {
    throw new Error('Missing Telegram user');
  }
  // Only expose the verified ID; never echo the original signed payload.
  return { id: user.id };
}
