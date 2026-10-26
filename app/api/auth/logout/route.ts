import { apiSuccess } from '@/lib/server/api-response';
import { LOCAL_LOGIN_COOKIE } from '@/lib/server/local-login';
import { cookiesAreSecure } from '@/lib/server/cookie-secure';

export async function POST() {
  const response = apiSuccess({ authenticated: false });
  for (const name of [LOCAL_LOGIN_COOKIE, 'openmaic_access']) {
    response.cookies.set(name, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookiesAreSecure(),
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });
  }
  return response;
}
