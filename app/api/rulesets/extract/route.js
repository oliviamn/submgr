import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { extractAndStoreProviderRuleSets } from '../../../lib/subscriptionProcessing.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const { env } = getCloudflareContext();
    const { url, proxyUrl, subscriptionId } = await request.json();

    if (!url) {
      return NextResponse.json({
        error: 'Missing subscription URL',
      }, {
        status: 400,
        headers: corsHeaders,
      });
    }

    const result = await extractAndStoreProviderRuleSets({
      env,
      url,
      proxyUrl,
      subscriptionId,
    });

    return NextResponse.json({
      success: true,
      ...result,
      count: result.extractedRuleSets.length,
    }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to extract provider rule sets',
      details: error.message,
    }, {
      status: 500,
      headers: corsHeaders,
    });
  }
}
