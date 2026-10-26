import { cookies } from 'next/headers';
import { apiSuccess } from '@/lib/server/api-response';
import { verifyAccessToken } from '@/lib/server/access-token';
import {
  localLoginEnabled,
  LOCAL_LOGIN_COOKIE,
  verifyLocalLoginToken,
} from '@/lib/server/local-login';

export async function GET() {
  if (localLoginEnabled()) {
    const cookieStore = await cookies();
    const authenticated = await verifyLocalLoginToken(
      cookieStore.get(LOCAL_LOGIN_COOKIE)?.value,
    );
    return apiSuccess({ enabled: false, authenticated });
  }

  const accessCode = process.env.ACCESS_CODE;
  const enabled = !!accessCode;

  let authenticated = false;
  if (enabled) {
    const cookieStore = await cookies();
    const token = cookieStore.get('openmaic_access')?.value;
    authenticated = !!token && verifyAccessToken(token, accessCode);
  }

  return apiSuccess({ enabled, authenticated });
}
