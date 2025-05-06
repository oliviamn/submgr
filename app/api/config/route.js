import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// Content type mapping
const CONTENT_TYPES = {
  clash: 'application/yaml',
  surge: 'text/plain',
  xray: 'application/json',
  singbox: 'application/json',
  raw: 'application/json'
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

export async function POST(request) {
  try {
    const { type, config, shortCode } = await request.json();
    const { env } = getCloudflareContext();

    if (!type || !config || !shortCode) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }
    
    const configId = `${type}_${shortCode}`;
    
    try {
      // Convert config to appropriate format based on type
      let configContent;
      switch (type) {
        case 'raw':
          configContent = JSON.stringify(config, null, 2);
          break;
        case 'surge':
          // Surge config is already in text format
          configContent = config;
          break;
        case 'clash':
          // Clash config is in YAML format
          configContent = config;
          break;
        case 'singbox':
        case 'xray':
          // Singbox and Xray configs are in JSON format
          configContent = JSON.stringify(config, null, 2);
          break;
        default:
          throw new Error(`Unsupported config type: ${type}`);
      }
      
      // Store in Cloudflare KV
      console.log('Storing config:', { type, configId, contentLength: configContent.length });
      if (type === 'raw') {
        console.log('Raw config:', configContent);
      }

      await env.SUBMGR_KV.put(configId, configContent);
      console.log('Config stored successfully');
      
      return NextResponse.json({ 
        success: true, 
        configId,
        message: `Config stored successfully with configId: ${configId}`
      }, {
        headers: corsHeaders
      });
    } catch (kvError) {
      console.error('KV storage error:', {
        error: kvError,
        message: kvError.message,
        stack: kvError.stack,
        type,
        configId
      });
      return NextResponse.json(
        { 
          error: 'Failed to store configuration in KV',
          details: kvError.message
        },
        { 
          status: 500,
          headers: corsHeaders
        }
      );
    }

  } catch (error) {
    console.error('Error processing request:', {
      error,
      message: error.message,
      stack: error.stack
    });
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        details: error.message
      },
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
}
