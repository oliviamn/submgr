import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { verifyAccessRequest } from './app/lib/accessAuth.js';

// Client-facing short-link endpoints stay public so proxy clients can fetch
// their configs without credentials. Only reads are public; writes (POST)
// on the same paths require auth.
const PUBLIC_API_PATTERN = /^\/api\/(xray|singbox|clash|surge|raw)\/[^/]+$/;

function isPublicRequest(request: NextRequest) {
  const method = request.method;
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    return false;
  }
  return PUBLIC_API_PATTERN.test(request.nextUrl.pathname);
}

export async function middleware(request: NextRequest) {
  if (isPublicRequest(request)) {
    return NextResponse.next();
  }

  const { env } = getCloudflareContext();
  const auth = await verifyAccessRequest(request, env);
  if (auth.ok) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  return new NextResponse('Unauthorized', { status: auth.status });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|file.svg|globe.svg|next.svg|vercel.svg|window.svg).*)',
  ],
};
