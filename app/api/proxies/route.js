import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { listProxyNodes, saveProxyNode, saveProxyNodesFromContent } from '../../lib/proxyNodeStore.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request) {
  try {
    const { env } = getCloudflareContext();
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');
    const requestedIds = ids ? ids.split(',').map(id => id.trim()).filter(Boolean) : [];
    const proxyNodes = await listProxyNodes(env, requestedIds);

    return NextResponse.json({
      success: true,
      proxyNodes,
      count: proxyNodes.length,
    }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to list proxy nodes',
      details: error.message,
    }, {
      status: 500,
      headers: corsHeaders,
    });
  }
}

export async function POST(request) {
  try {
    const { env } = getCloudflareContext();
    const payload = await request.json();

    if (payload.content) {
      const proxyNodes = await saveProxyNodesFromContent(env, payload.content, payload.userAgent);
      return NextResponse.json({
        success: true,
        proxyNodes,
        count: proxyNodes.length,
      }, { headers: corsHeaders });
    }

    if (!payload.proxyNode) {
      return NextResponse.json({
        error: 'Missing proxy node payload',
      }, {
        status: 400,
        headers: corsHeaders,
      });
    }

    const savedProxyNode = await saveProxyNode(env, payload.proxyNode, payload.rawValue);

    return NextResponse.json({
      success: true,
      proxyNode: savedProxyNode,
    }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to save proxy node',
      details: error.message,
    }, {
      status: 500,
      headers: corsHeaders,
    });
  }
}
