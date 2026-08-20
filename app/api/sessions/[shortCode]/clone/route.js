import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { cloneManagedSession } from '../../../../lib/sessionStore.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

export async function POST(request, { params }) {
  try {
    const { env } = getCloudflareContext();
    const { shortCode } = await params;

    const result = await cloneManagedSession(env, shortCode);
    if (!result) {
      return withCors({ error: 'Session not found for shortcode' }, { status: 404 });
    }

    return withCors({
      success: true,
      ...result,
    });
  } catch (error) {
    return withCors({
      error: 'Failed to clone session',
      details: error.message,
    }, { status: 500 });
  }
}
