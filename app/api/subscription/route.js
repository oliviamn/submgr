import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { fetchSubscription } from '../../lib/subscriptionFetcher.js';
import { deriveProviderName, extractAndStoreProviderRuleSets, parseSubscriptionProxies } from '../../lib/subscriptionProcessing.js';
import { createManagedSubscriptionId, deleteManagedSubscription, listManagedSubscriptions, saveManagedSubscription } from '../../lib/subscriptionStore.js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST - Fetch and cache a globally managed subscription
export async function POST(request) {
  try {
    const { url, userAgent = 'curl/7.74.0', proxyUrl } = await request.json();
    const { env } = getCloudflareContext();

    if (!url) {
      return NextResponse.json(
        { error: 'Missing required field: url' },
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
      const subId = createManagedSubscriptionId({ url, userAgent, proxyUrl });

      const extractedRuleResult = await extractAndStoreProviderRuleSets({
        env,
        url,
        subscriptionId: subId,
        proxyUrl,
      });

      const extractedRuleSets = extractedRuleResult.extractedRuleSets || [];
      const cacheData = {
        subId,
        url,
        proxies,
        fetchedAt: new Date().toISOString(),
        proxyCount: proxies.length,
        userAgent,
        proxyUrl,
        providerName: deriveProviderName(url),
        providerRuleSetIds: extractedRuleSets.map(ruleSet => ruleSet.id),
        providerRuleSetNames: extractedRuleSets.map(ruleSet => ruleSet.name),
        providerRuleSetCount: extractedRuleSets.length,
      };

      await saveManagedSubscription(env, cacheData);
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

// GET - List globally managed subscriptions, or resolve a specific set of ids
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');
    const { env } = getCloudflareContext();
    const requestedIds = ids
      ? ids.split(',').map(id => id.trim()).filter(Boolean)
      : [];
    const storedSubscriptions = await listManagedSubscriptions(env, requestedIds);
    const subscriptions = storedSubscriptions.map(parsed => ({
      subId: parsed.subId,
      url: parsed.url,
      proxyCount: parsed.proxyCount,
      fetchedAt: parsed.fetchedAt,
      name: parsed.name || `Subscription (${parsed.proxyCount} nodes)`,
      providerName: parsed.providerName,
      providerRuleSetIds: parsed.providerRuleSetIds || [],
      providerRuleSetNames: parsed.providerRuleSetNames || [],
      providerRuleSetCount: parsed.providerRuleSetCount || 0,
    }));

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

// DELETE - Remove a globally managed subscription
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

    await deleteManagedSubscription(env, subId);
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
