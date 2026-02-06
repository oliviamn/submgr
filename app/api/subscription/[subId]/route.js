import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { ProxyParser } from '../../../lib/ProxyParsers.js';
import { fetchSubscription } from '../../../lib/subscriptionFetcher.js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET - Get a single subscription by ID
export async function GET(request, { params }) {
  try {
    const { subId } = await params;
    const { env } = getCloudflareContext();

    if (!subId || !subId.startsWith('sub_')) {
      return NextResponse.json(
        { error: 'Invalid subId' },
        { status: 400, headers: corsHeaders }
      );
    }

    const data = await env.SUBMGR_KV.get(subId);
    if (!data) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const parsed = JSON.parse(data);
    return NextResponse.json({
      success: true,
      subId,
      ...parsed
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[SubscriptionAPI] Get error:', error);
    return NextResponse.json(
      { error: 'Failed to get subscription', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

// PUT - Refresh a cached subscription
export async function PUT(request, { params }) {
  try {
    const { subId } = await params;
    const { userAgent = 'curl/7.74.0' } = await request.json();
    const { env } = getCloudflareContext();

    if (!subId || !subId.startsWith('sub_')) {
      return NextResponse.json(
        { error: 'Invalid subId' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get existing cached data to retrieve the URL
    const existingData = await env.SUBMGR_KV.get(subId);
    if (!existingData) {
      return NextResponse.json(
        { error: 'Subscription not found in cache' },
        { status: 404, headers: corsHeaders }
      );
    }

    const parsed = JSON.parse(existingData);
    const url = parsed.url;

    try {
      // Re-fetch the subscription using the shared fetcher
      console.log('[SubscriptionAPI] Refreshing subscription:', url);
      const text = await fetchSubscription(url, userAgent);

      // Decode base64 if needed
      let decodedText;
      try {
        decodedText = atob(text.trim());
        if (decodedText.includes('%')) {
          decodedText = decodeURIComponent(decodedText);
        }
      } catch (e) {
        decodedText = text;
        if (decodedText.includes('%')) {
          try {
            decodedText = decodeURIComponent(decodedText);
          } catch (urlError) {
            console.warn('[SubscriptionAPI] Failed to URL decode:', urlError);
          }
        }
      }

      // Parse proxy URLs
      const lines = decodedText.split('\n').filter(line => line.trim() !== '');
      const proxies = [];

      for (const line of lines) {
        try {
          const result = await ProxyParser.parse(line, userAgent);
          if (result && !Array.isArray(result)) {
            proxies.push(result);
          }
        } catch (e) {
          console.warn('[SubscriptionAPI] Failed to parse line:', line.substring(0, 50));
        }
      }

      if (proxies.length === 0) {
        return NextResponse.json(
          { error: 'No valid proxies found in subscription after refresh' },
          { status: 400, headers: corsHeaders }
        );
      }

      // Update cache
      const cacheData = {
        url,
        proxies,
        fetchedAt: new Date().toISOString(),
        proxyCount: proxies.length,
        shortCode: parsed.shortCode,
      };

      await env.SUBMGR_KV.put(subId, JSON.stringify(cacheData));
      console.log('[SubscriptionAPI] Refreshed subscription:', subId, 'with', proxies.length, 'proxies');

      return NextResponse.json({
        success: true,
        subId,
        url,
        proxyCount: proxies.length,
        fetchedAt: cacheData.fetchedAt,
        name: `Subscription (${proxies.length} nodes)`,
      }, { headers: corsHeaders });

    } catch (fetchError) {
      console.error('[SubscriptionAPI] Refresh fetch error:', fetchError);
      
      return NextResponse.json(
        { 
          error: fetchError.message || 'Failed to refresh subscription',
          reason: 'Cloudflare bot protection blocks automated requests from datacenter IPs.',
          solution: 'Paste the content directly',
          steps: [
            `Run: curl -L -H "User-Agent: Mozilla/5.0" "${url}" | base64 -d`,
            'Or open the URL in your browser and copy the content',
            'Paste the result (base64 string or decoded nodes) into the standalone proxies field'
          ]
        },
        { status: 502, headers: corsHeaders }
      );
    }

  } catch (error) {
    console.error('[SubscriptionAPI] Refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh subscription', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
