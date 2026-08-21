import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { cloneProxyNode } from '../../../../lib/proxyNodeStore.js';

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
    const { id } = await params;
    const { tag } = await request.json().catch(() => ({}));

    const proxyNode = await cloneProxyNode(env, id, { tag });
    if (!proxyNode) {
      return withCors({ error: 'Proxy node not found' }, { status: 404 });
    }

    return withCors({
      success: true,
      proxyNode,
    });
  } catch (error) {
    return withCors({
      error: 'Failed to clone proxy node',
      details: error.message,
    }, { status: 500 });
  }
}
