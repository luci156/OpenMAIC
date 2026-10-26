import { LOCAL_LOGIN_COOKIE, verifyLocalLoginToken } from '@/lib/server/local-login';
import { OWNER_ROLES, type OwnerAuthMethod, type OwnerAuthMethodResult } from '@/lib/server/identity';

const LOCAL_TEACHER_OWNER_ID = 'local';
const TEACHER_ROLES: ReadonlySet<string> = new Set([OWNER_ROLES.coursePublish]);

function cookieValue(header: string | null): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== LOCAL_LOGIN_COOKIE) continue;
    return part.slice(separator + 1).trim();
  }
  return undefined;
}

async function authenticate(headers: Headers): Promise<OwnerAuthMethodResult> {
  const token = cookieValue(headers.get('cookie'));
  if (!token) return { status: 'not-applicable' };
  if (!(await verifyLocalLoginToken(token))) return { status: 'invalid', reason: 'invalid local login session' };
  return {
    status: 'authenticated',
    principal: {
      ownerId: LOCAL_TEACHER_OWNER_ID,
      kind: 'user',
      roles: TEACHER_ROLES,
      assurance: 'verified',
      channel: 'local-login',
    },
  };
}

export const localLoginAuthMethod: OwnerAuthMethod = {
  name: 'localTeacherLogin',
  authenticate: (request) => authenticate(request.headers),
  authenticateFromContext: async () => {
    const { headers } = await import('next/headers');
    return authenticate(new Headers(await headers()));
  },
  describeStoredOwner: (ownerId) =>
    ownerId === LOCAL_TEACHER_OWNER_ID ? { kind: 'user', roles: TEACHER_ROLES } : undefined,
};
