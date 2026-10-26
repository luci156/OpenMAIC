import { cookies } from 'next/headers';
import { apiSuccess } from '@/lib/server/api-response';
import { LOCAL_LOGIN_COOKIE, localLoginEnabled, verifyLocalLoginToken, configuredLocalLoginEmail } from '@/lib/server/local-login';

export async function GET() {
  const cookieStore = await cookies();
  const authenticated =
    localLoginEnabled() &&
    (await verifyLocalLoginToken(cookieStore.get(LOCAL_LOGIN_COOKIE)?.value));
  const response = apiSuccess({
    enabled: localLoginEnabled(),
    authenticated,
    ...(authenticated ? { email: configuredLocalLoginEmail() } : {}),
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
