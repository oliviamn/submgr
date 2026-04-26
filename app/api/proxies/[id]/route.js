import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { deleteProxyNode, getProxyNode } from '../../../lib/proxyNodeStore.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { env } = getCloudflareContext();
    const proxyNode = await getProxyNode(env, id);

    if (!proxyNode) {
      return NextResponse.json({
        error: 'Proxy node not found',
      }, {
        status: 404,
        headers: corsHeaders,
      });
    }

    return NextResponse.json({
      success: true,
      proxyNode,
    }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get proxy node',
      details: error.message,
    }, {
      status: 500,
      headers: corsHeaders,
    });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { env } = getCloudflareContext();
    const proxyNode = await getProxyNode(env, id);

    if (!proxyNode) {
      return NextResponse.json({
        error: 'Proxy node not found',
      }, {
        status: 404,
        headers: corsHeaders,
      });
    }

    await deleteProxyNode(env, id);

    return NextResponse.json({
      success: true,
    }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to delete proxy node',
      details: error.message,
    }, {
      status: 500,
      headers: corsHeaders,
    });
  }
}
