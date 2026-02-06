// Shared utility for fetching subscriptions with proxy support
// Extracted to be used by both API routes and client-side code

const DEFAULT_PROXY_URL = 'https://proxy.xorbitlab.xyz/';

async function fetchViaProxy(targetUrl, userAgent, proxyUrl) {
    if (!proxyUrl) {
        console.log('[SubscriptionFetcher] No proxy URL configured, fetching directly');
        return null;
    }
    
    // Construct proxy URL in path-style format
    const separator = proxyUrl.endsWith('/') ? '' : '/';
    const encodedTarget = encodeURIComponent(targetUrl);
    const proxiedUrl = `${proxyUrl}${separator}${encodedTarget}`;
    
    console.log(`[SubscriptionFetcher] Fetching via external proxy`);
    
    const response = await fetch(proxiedUrl, {
        method: 'GET',
        headers: {
            'User-Agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
        },
    });
    
    console.log(`[SubscriptionFetcher] External proxy response: ${response.status}`);
    return response;
}

export async function fetchSubscription(url, userAgent) {
    const proxyUrl = process.env.PROXY_URL || DEFAULT_PROXY_URL;
    console.log(`[SubscriptionFetcher] Target URL: ${url}`);
    console.log(`[SubscriptionFetcher] PROXY_URL: ${proxyUrl}`);
    
    const finalUserAgent = userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    
    let response = null;
    let usedProxy = false;
    
    // First, try fetching via external proxy if configured
    if (proxyUrl) {
        try {
            console.log('[SubscriptionFetcher] Attempting external proxy...');
            response = await fetchViaProxy(url, finalUserAgent, proxyUrl);
            usedProxy = true;
            if (response && response.ok) {
                console.log('[SubscriptionFetcher] Successfully fetched via external proxy');
            } else {
                console.log(`[SubscriptionFetcher] External proxy returned status: ${response?.status}`);
            }
        } catch (proxyError) {
            console.warn('[SubscriptionFetcher] External proxy failed:', proxyError.message);
            response = null;
            usedProxy = false;
        }
    }
    
    // If proxy failed or not configured, try direct fetch
    if (!response || !response.ok) {
        console.log('[SubscriptionFetcher] Trying direct fetch...');
        try {
            response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': finalUserAgent,
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
                redirect: 'follow',
            });
        } catch (fetchError) {
            console.error('[SubscriptionFetcher] Direct fetch error:', fetchError.message);
            throw fetchError;
        }
    }

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'No response body');
        console.error(`[SubscriptionFetcher] HTTP error! status: ${response.status}`);
        
        const error = new Error(`HTTP error! status: ${response.status}`);
        error.status = response.status;
        error.responseText = errorText;
        error.usedProxy = usedProxy;
        throw error;
    }

    const data = await response.text();
    console.log(`[SubscriptionFetcher] Successfully fetched ${data.length} bytes`);
    
    return data;
}
