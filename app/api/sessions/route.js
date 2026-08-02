import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { importManagedSessionFromShortCode, listManagedSessions } from '../../lib/sessionStore.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function withCors(response, init = {}) {
  return NextResponse.json(response, {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init.headers || {}),
    },
  });
}

export async function OPTIONS() {
  return withCors({});
}

export async function GET(request) {
  try {
    const { env } = getCloudflareContext();

    const sessions = await listManagedSessions(env);
    return withCors({
      success: true,
      sessions,
      count: sessions.length,
    });
  } catch (error) {
    return withCors({
      error: 'Failed to list sessions',
      details: error.message,
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { env } = getCloudflareContext();

    const { shortCode } = await request.json();
    if (!shortCode) {
      return withCors({ error: 'Missing shortCode' }, { status: 400 });
    }

    const session = await importManagedSessionFromShortCode(env, shortCode);
    if (!session) {
      return withCors({ error: 'Session not found for shortcode' }, { status: 404 });
    }

    return withCors({
      success: true,
      session,
    });
  } catch (error) {
    return withCors({
      error: 'Failed to import session',
      details: error.message,
    }, { status: 500 });
  }
}
