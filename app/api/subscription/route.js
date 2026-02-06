import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { ProxyParser } from '../../lib/ProxyParsers.js';
import { fetchSubscription } from '../../lib/subscriptionFetcher.js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Hash URL for identification
function hashUrl(url) {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).substring(0, 8);
}

// POST - Fetch and cache a subscription
export async function POST(request) {
  try {
    const { url, shortCode, userAgent = 'curl/7.74.0' } = await request.json();
    const { env } = getCloudflareContext();

    if (!url || !shortCode) {
      return NextResponse.json(
        { error: 'Missing required fields: url and shortCode' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return NextResponse.json(
        { error: 'Invalid URL. Must be http:// or https://' },
        { status: 400, headers: corsHeaders }
      );
    }

    const subId = `sub_${shortCode}_${hashUrl(url)}`;

    try {
      // Fetch subscription using the shared fetcher (with proxy support)
      console.log('[SubscriptionAPI] Fetching subscription:', url);
      const text = await fetchSubscription(url, userAgent);
      console.log(`[SubscriptionAPI] Received ${text.length} bytes`);

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
          { error: 'No valid proxies found in subscription' },
          { status: 400, headers: corsHeaders }
        );
      }

      // Cache to KV
      const cacheData = {
        url,
        proxies,
        fetchedAt: new Date().toISOString(),
        proxyCount: proxies.length,
        shortCode,
      };

      await env.SUBMGR_KV.put(subId, JSON.stringify(cacheData));
      console.log('[SubscriptionAPI] Cached subscription:', subId, 'with', proxies.length, 'proxies');

      return NextResponse.json({
        success: true,
        subId,
        url,
        proxyCount: proxies.length,
        fetchedAt: cacheData.fetchedAt,
        name: `Subscription (${proxies.length} nodes)`,
      }, { headers: corsHeaders });

    } catch (fetchError) {
      console.error('[SubscriptionAPI] Fetch error:', fetchError);
      
      // Return structured error for Cloudflare protection
      return NextResponse.json(
        { 
          error: fetchError.message || 'Failed to fetch subscription',
          reason: 'Cloudflare bot protection blocks automated requests from datacenter IPs (including Cloudflare Workers).',
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
    console.error('[SubscriptionAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

// GET - List cached subscriptions for a shortcode
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const shortCode = searchParams.get('shortCode');
    const { env } = getCloudflareContext();

    if (!shortCode) {
      return NextResponse.json(
        { error: 'Missing shortCode parameter' },
        { status: 400, headers: corsHeaders }
      );
    }

    // List all keys with prefix
    const prefix = `sub_${shortCode}_`;
    const keys = await env.SUBMGR_KV.list({ prefix });
    
    const subscriptions = [];
    for (const key of keys.keys) {
      try {
        const data = await env.SUBMGR_KV.get(key.name);
        if (data) {
          const parsed = JSON.parse(data);
          subscriptions.push({
            subId: key.name,
            url: parsed.url,
            proxyCount: parsed.proxyCount,
            fetchedAt: parsed.fetchedAt,
            name: parsed.name || `Subscription (${parsed.proxyCount} nodes)`,
          });
        }
      } catch (e) {
        console.warn('[SubscriptionAPI] Failed to parse subscription:', key.name);
      }
    }

    return NextResponse.json({
      success: true,
      subscriptions,
      count: subscriptions.length,
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[SubscriptionAPI] List error:', error);
    return NextResponse.json(
      { error: 'Failed to list subscriptions', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

// DELETE - Remove cached subscription
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const subId = searchParams.get('subId');
    const { env } = getCloudflareContext();

    if (!subId) {
      return NextResponse.json(
        { error: 'Missing subId parameter' },
        { status: 400, headers: corsHeaders }
      );
    }

    await env.SUBMGR_KV.delete(subId);
    console.log('[SubscriptionAPI] Deleted subscription:', subId);

    return NextResponse.json({
      success: true,
      message: 'Subscription deleted',
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[SubscriptionAPI] Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete subscription', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
