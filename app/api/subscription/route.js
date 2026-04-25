import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { fetchSubscription } from '../../lib/subscriptionFetcher.js';
import { deriveProviderName, extractAndStoreProviderRuleSets, parseSubscriptionProxies } from '../../lib/subscriptionProcessing.js';

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
    const { url, shortCode, userAgent = 'curl/7.74.0', proxyUrl } = await request.json();
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
      const text = await fetchSubscription(url, userAgent, proxyUrl);
      console.log(`[SubscriptionAPI] Received ${text.length} bytes`);
      const { proxies } = await parseSubscriptionProxies(text, userAgent);

      if (proxies.length === 0) {
        return NextResponse.json(
          { error: 'No valid proxies found in subscription' },
          { status: 400, headers: corsHeaders }
        );
      }

      // Cache to KV
      const extractedRuleResult = await extractAndStoreProviderRuleSets({
        env,
        url,
        subscriptionId: subId,
        proxyUrl,
      });

      const extractedRuleSets = extractedRuleResult.extractedRuleSets || [];
      const cacheData = {
        url,
        proxies,
        fetchedAt: new Date().toISOString(),
        proxyCount: proxies.length,
        shortCode,
        userAgent,
        proxyUrl,
        providerName: deriveProviderName(url),
        providerRuleSetIds: extractedRuleSets.map(ruleSet => ruleSet.id),
        providerRuleSetNames: extractedRuleSets.map(ruleSet => ruleSet.name),
        providerRuleSetCount: extractedRuleSets.length,
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
        providerRuleSetCount: cacheData.providerRuleSetCount,
        providerRuleSetNames: cacheData.providerRuleSetNames,
        extractedRuleSets,
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
              providerName: parsed.providerName,
              providerRuleSetIds: parsed.providerRuleSetIds || [],
              providerRuleSetNames: parsed.providerRuleSetNames || [],
              providerRuleSetCount: parsed.providerRuleSetCount || 0,
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
