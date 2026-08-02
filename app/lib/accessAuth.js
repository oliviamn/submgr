import { createRemoteJWKSet, jwtVerify } from 'jose';

// Cloudflare Access authentication.
// Access performs the OAuth login at the edge; here we verify the JWT it issues
// so the Worker is also protected when reached directly (e.g. workers.dev).

const ACCESS_JWT_HEADER = 'CF-Access-Jwt-Assertion';
const ACCESS_COOKIE = 'CF_Authorization';

let cachedJwks = null;
let cachedTeamDomain = null;

function getAccessConfig(env) {
  const teamDomain = env?.CF_ACCESS_TEAM_DOMAIN || process.env.CF_ACCESS_TEAM_DOMAIN || '';
  const audience = env?.CF_ACCESS_AUD || process.env.CF_ACCESS_AUD || '';
  return { teamDomain, audience };
}

function getJwks(teamDomain) {
  if (!cachedJwks || cachedTeamDomain !== teamDomain) {
    cachedJwks = createRemoteJWKSet(
      new URL(`https://${teamDomain}/cdn-cgi/access/certs`)
    );
    cachedTeamDomain = teamDomain;
  }
  return cachedJwks;
}

function extractToken(request) {
  const headerToken = request.headers.get(ACCESS_JWT_HEADER);
  if (headerToken) return headerToken;

  const cookieHeader = request.headers.get('cookie') || '';
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === ACCESS_COOKIE) return rest.join('=');
  }
  return '';
}

/**
 * Verify that a request carries a valid Cloudflare Access JWT.
 * Returns { ok: true } or { ok: false, status, error }.
 *
 * Dev bypass: when CF_ACCESS_TEAM_DOMAIN or CF_ACCESS_AUD is not configured,
 * every request is allowed (local `next dev` convenience).
 */
export async function verifyAccessRequest(request, env) {
  const { teamDomain, audience } = getAccessConfig(env);

  if (!teamDomain || !audience) {
    console.warn('[auth] Cloudflare Access not configured; allowing request (dev bypass)');
    return { ok: true };
  }

  const token = extractToken(request);
  if (!token) {
    return { ok: false, status: 401, error: 'Missing Cloudflare Access credentials' };
  }

  try {
    await jwtVerify(token, getJwks(teamDomain), {
      issuer: `https://${teamDomain}`,
      audience,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, status: 401, error: `Invalid Cloudflare Access token: ${error.message}` };
  }
}
