import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const VALID_TYPES = ['xray', 'singbox', 'clash', 'surge'];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const [_, type] = pathname.split('/');

  // Only run on our config routes
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.next();
  }

  // Could add additional preprocessing here if needed
  // For example: rate limiting, authentication, etc.

  return NextResponse.next();
}

export const config = {
  matcher: ['/xray/:shortcode*', '/singbox/:shortcode*', '/clash/:shortcode*', '/surge/:shortcode*']
};
