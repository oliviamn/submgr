import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { fetchSubscription } from '../../../lib/subscriptionFetcher.js';
import { deriveProviderName, extractAndStoreProviderRuleSets, parseSubscriptionProxies } from '../../../lib/subscriptionProcessing.js';
import { getManagedSubscription, saveManagedSubscription } from '../../../lib/subscriptionStore.js';

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

    if (!subId || !subId.startsWith('sub')) {
      return NextResponse.json(
        { error: 'Invalid subId' },
        { status: 400, headers: corsHeaders }
      );
    }

    const subscription = await getManagedSubscription(env, subId);
    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json({
      success: true,
      subId,
      ...subscription
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

    if (!subId || !subId.startsWith('sub')) {
      return NextResponse.json(
        { error: 'Invalid subId' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get existing cached data to retrieve the URL
    const parsed = await getManagedSubscription(env, subId);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Subscription not found in cache' },
        { status: 404, headers: corsHeaders }
      );
    }
    const url = parsed.url;

    try {
      // Re-fetch the subscription using the shared fetcher
      console.log('[SubscriptionAPI] Refreshing subscription:', url);
      const text = await fetchSubscription(url, userAgent, parsed.proxyUrl);
      const { proxies } = await parseSubscriptionProxies(text, userAgent);

      if (proxies.length === 0) {
        return NextResponse.json(
          { error: 'No valid proxies found in subscription after refresh' },
          { status: 400, headers: corsHeaders }
        );
      }

      // Update cache
      const extractedRuleResult = await extractAndStoreProviderRuleSets({
        env,
        url,
        subscriptionId: subId,
        proxyUrl: parsed.proxyUrl,
      });

      const extractedRuleSets = extractedRuleResult.extractedRuleSets?.length > 0
        ? extractedRuleResult.extractedRuleSets
        : (parsed.providerRuleSetIds || []).map((id, index) => ({
            id,
            name: parsed.providerRuleSetNames?.[index] || id,
          }));

      const cacheData = {
        subId,
        url,
        proxies,
        fetchedAt: new Date().toISOString(),
        proxyCount: proxies.length,
        userAgent,
        proxyUrl: parsed.proxyUrl,
        providerName: parsed.providerName || deriveProviderName(url),
        providerRuleSetIds: extractedRuleSets.map(ruleSet => ruleSet.id),
        providerRuleSetNames: extractedRuleSets.map(ruleSet => ruleSet.name),
        providerRuleSetCount: extractedRuleSets.length,
      };

      await saveManagedSubscription(env, cacheData);
      console.log('[SubscriptionAPI] Refreshed subscription:', subId, 'with', proxies.length, 'proxies');

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
