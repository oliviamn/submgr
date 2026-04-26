export const SESSION_ADMIN_HEADER = 'x-submgr-admin-key';

export function getConfiguredSessionAdminKey(env) {
  return env?.SUBMGR_ADMIN_KEY || process.env.SUBMGR_ADMIN_KEY || '';
}

export function validateSessionAdminRequest(request, env) {
  const configuredKey = getConfiguredSessionAdminKey(env);

  if (!configuredKey) {
    return {
      ok: false,
      status: 503,
      error: 'Session admin key is not configured',
    };
  }

  const providedKey = request.headers.get(SESSION_ADMIN_HEADER) || '';
  if (!providedKey) {
    return {
      ok: false,
      status: 401,
      error: 'Missing session admin key',
    };
  }

  if (providedKey !== configuredKey) {
    return {
      ok: false,
      status: 403,
      error: 'Invalid session admin key',
    };
  }

  return { ok: true };
}
