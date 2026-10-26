/** Local single-account login used by a self-hosted teaching workspace. */
export const LOCAL_LOGIN_COOKIE = 'openmaic_local_session';
export const LOCAL_LOGIN_TTL_SECONDS = 60 * 60 * 24 * 7;

const CLOCK_SKEW_MS = 5 * 60 * 1000;

export function localLoginEnabled(): boolean {
  return !!(
    process.env.LOCAL_LOGIN_EMAIL?.trim() &&
    process.env.LOCAL_LOGIN_PASSWORD &&
    (process.env.LOCAL_LOGIN_SECRET?.length ?? 0) >= 32
  );
}

export function configuredLocalLoginEmail(): string {
  return process.env.LOCAL_LOGIN_EMAIL?.trim().toLowerCase() ?? '';
}

export function configuredLocalLoginPassword(): string {
  return process.env.LOCAL_LOGIN_PASSWORD ?? '';
}

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function hex(value: ArrayBuffer): string {
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sign(expiry: string): Promise<string> {
  const secret = process.env.LOCAL_LOGIN_SECRET;
  if (!secret || secret.length < 32) throw new Error('LOCAL_LOGIN_SECRET must be at least 32 characters');
  const keyBytes = encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const payload = encode(`openmaic-local-login:v1:${expiry}`);
  return hex(await crypto.subtle.sign('HMAC', key, payload.buffer as ArrayBuffer));
}

export async function createLocalLoginToken(now = Date.now()): Promise<string> {
  const expiry = String(now + LOCAL_LOGIN_TTL_SECONDS * 1000);
  return `${expiry}.${await sign(expiry)}`;
}

export async function verifyLocalLoginToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token || !localLoginEnabled()) return false;
  const separator = token.indexOf('.');
  if (separator < 1) return false;
  const expiry = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!/^\d{13}$/.test(expiry) || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const expiresAt = Number(expiry);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + LOCAL_LOGIN_TTL_SECONDS * 1000 + CLOCK_SKEW_MS) {
    return false;
  }
  const expected = await sign(expiry);
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return mismatch === 0;
}
