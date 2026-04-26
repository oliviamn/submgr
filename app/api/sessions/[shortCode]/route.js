import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SESSION_ADMIN_HEADER, validateSessionAdminRequest } from '../../../lib/sessionAdmin.js';
import { deleteManagedSession, getManagedSessionSummary, importManagedSessionFromShortCode } from '../../../lib/sessionStore.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': `Content-Type, ${SESSION_ADMIN_HEADER}`,
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

export async function GET(request, { params }) {
  try {
    const { env } = getCloudflareContext();
    const auth = validateSessionAdminRequest(request, env);
    if (!auth.ok) {
      return withCors({ error: auth.error }, { status: auth.status });
    }

    const { shortCode } = await params;
    const session = await getManagedSessionSummary(env, shortCode) || await importManagedSessionFromShortCode(env, shortCode);
    if (!session) {
      return withCors({ error: 'Session not found' }, { status: 404 });
    }

    return withCors({
      success: true,
      session,
    });
  } catch (error) {
    return withCors({
      error: 'Failed to read session',
      details: error.message,
    }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { env } = getCloudflareContext();
    const auth = validateSessionAdminRequest(request, env);
    if (!auth.ok) {
      return withCors({ error: auth.error }, { status: auth.status });
    }

    const { shortCode } = await params;
    await deleteManagedSession(env, shortCode);

    return withCors({
      success: true,
      message: 'Session deleted',
    });
  } catch (error) {
    return withCors({
      error: 'Failed to delete session',
      details: error.message,
    }, { status: 500 });
  }
}
