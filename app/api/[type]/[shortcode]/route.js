import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// Validate client type
const VALID_TYPES = ['xray', 'singbox', 'clash', 'surge', 'raw'];

// Content type mapping
const CONTENT_TYPES = {
  clash: 'application/yaml; charset=utf-8',
  surge: 'text/plain; charset=utf-8',
  xray: 'application/json; charset=utf-8',
  singbox: 'application/json; charset=utf-8',
  raw: 'application/json; charset=utf-8'
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  request,
  { params }
) {
  try {
    const { type, shortcode } = await params;
    console.log('[API] GET request:', { type, shortcode });
    
    const { env } = getCloudflareContext();
    
    if (!env || !env.SUBMGR_KV) {
      console.error('[API] KV binding not available');
      return NextResponse.json(
        { error: 'KV storage not configured' },
        { status: 500, headers: corsHeaders }
      );
    }

    // Validate type
    if (!VALID_TYPES.includes(type)) {
      console.log('[API] Invalid type:', type);
      return NextResponse.json(
        { error: 'Invalid client type' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get the config from Cloudflare KV
    const configId = `${type}_${shortcode}`;
    console.log('[API] Retrieving config:', configId);
    const config = await env.SUBMGR_KV.get(configId);
    console.log('[API] Config found:', !!config, 'Length:', config?.length);
    
    if (!config) {
      return NextResponse.json(
        { error: `Configuration not found for ID: ${configId}` },
        { status: 404, headers: corsHeaders }
      );
    }

    // Return the config with appropriate content type
    return new Response(config, {
      headers: {
        'Content-Type': CONTENT_TYPES[type],
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Content-Encoding': 'UTF-8',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error retrieving config:', {
      error,
      message: error.message,
      stack: error.stack
    });
    return NextResponse.json(
      { 
        error: 'Failed to retrieve configuration',
        details: error.message
      },
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

export async function POST(request) {
  try {
    const { type, shortcode, config } = await request.json();

    if (!type || !shortcode || !config) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate type
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid client type' },
        { status: 400 }
      );
    }

    // Store the config in Cloudflare KV
    const configId = `${type}_${shortcode}`;
    await SUBMGR_KV.put(configId, config);

    return NextResponse.json({
      success: true,
      message: 'Configuration stored successfully'
    });

  } catch (error) {
    console.error('Error storing config:', error);
    return NextResponse.json(
      { error: 'Failed to store configuration' },
      { status: 500 }
    );
  }
}
