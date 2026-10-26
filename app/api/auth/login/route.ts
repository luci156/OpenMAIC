import { createHash, timingSafeEqual } from 'node:crypto';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createLocalLoginToken, localLoginEnabled, LOCAL_LOGIN_COOKIE, LOCAL_LOGIN_TTL_SECONDS, configuredLocalLoginEmail, configuredLocalLoginPassword } from '@/lib/server/local-login';
import { cookiesAreSecure } from '@/lib/server/cookie-secure';

const failedAttempts: number[] = [];
const ATTEMPT_WINDOW_MS = 60_000;
const ATTEMPT_LIMIT = 10;

function sameValue(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!localLoginEnabled()) return apiError('UNAUTHENTICATED', 404, 'Local login is not configured');
  if (!sameOrigin(request)) return apiError('INVALID_REQUEST', 403, 'Cross-origin login is not allowed');

  const now = Date.now();
  while (failedAttempts.length && failedAttempts[0]! <= now - ATTEMPT_WINDOW_MS) failedAttempts.shift();
  if (failedAttempts.length >= ATTEMPT_LIMIT) {
    const response = apiError('RATE_LIMITED', 429, 'Too many login attempts');
    response.headers.set('Retry-After', String(Math.max(1, Math.ceil((failedAttempts[0]! + ATTEMPT_WINDOW_MS - now) / 1000))));
    return response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  }
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const email = typeof record.email === 'string' ? record.email.trim().toLowerCase().slice(0, 256) : '';
  const password = typeof record.password === 'string' ? record.password.slice(0, 256) : '';
  const valid = sameValue(email, configuredLocalLoginEmail()) && sameValue(password, configuredLocalLoginPassword());
  if (!valid) {
    failedAttempts.push(now);
    return apiError('UNAUTHENTICATED', 401, 'Email or password is incorrect');
  }

  failedAttempts.length = 0;
  const token = await createLocalLoginToken(now);
  const response = apiSuccess({ authenticated: true, email: configuredLocalLoginEmail() });
  response.cookies.set(LOCAL_LOGIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookiesAreSecure(),
    path: '/',
    maxAge: LOCAL_LOGIN_TTL_SECONDS,
  });
  return response;
}
