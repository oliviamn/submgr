import { NextResponse } from 'next/server';

// Use external proxy for subscription requests to bypass Cloudflare bot protection
// This supports path-style proxies like: https://proxy.example.com/https://target.com/...
async function fetchViaProxy(targetUrl, userAgent, proxyUrl) {
    if (!proxyUrl) {
        console.log('[Proxy] No PROXY_URL configured, fetching directly');
        return null; // Will fall back to direct fetch
    }
    
    // Construct proxy URL in path-style format
    // Format: https://proxy.example.com/https://target.com/path
    // The target URL is appended to the proxy URL as a path segment
    // We use encodeURIComponent to ensure special chars don't break the URL
    const separator = proxyUrl.endsWith('/') ? '' : '/';
    const encodedTarget = encodeURIComponent(targetUrl);
    const proxiedUrl = `${proxyUrl}${separator}${encodedTarget}`;
    
    console.log(`[Proxy] Fetching via external proxy: ${proxyUrl}${separator}[encoded-target-url]`);
    
    const response = await fetch(proxiedUrl, {
        method: 'GET',
        headers: {
            'User-Agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
        },
    });
    
    console.log(`[Proxy] External proxy response: ${response.status}`);
    return response;
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const ua = searchParams.get('ua');

    if (!url) {
        return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    // Try to get PROXY_URL from env, fallback to hardcoded for development
    const proxyUrl = process.env.PROXY_URL || 'https://proxy.xorbitlab.xyz/';
    console.log(`[Proxy] PROXY_URL env: ${process.env.PROXY_URL || 'not set'}, using: ${proxyUrl}`);

    try {
        console.log(`[Proxy] Target URL: ${url}`);
        const userAgent = ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        
        let response = null;
        let usedProxy = false;
        
        // First, try fetching via external proxy if configured
        if (proxyUrl) {
            try {
                console.log('[Proxy] Attempting external proxy...');
                response = await fetchViaProxy(url, userAgent, proxyUrl);
                usedProxy = true;
                if (response && response.ok) {
                    console.log('[Proxy] Successfully fetched via external proxy');
                } else {
                    console.log(`[Proxy] External proxy returned status: ${response?.status}`);
                }
            } catch (proxyError) {
                console.warn('[Proxy] External proxy failed:', proxyError.message);
                response = null;
                usedProxy = false;
            }
        } else {
            console.log('[Proxy] No PROXY_URL configured, skipping external proxy');
        }
        
        // If proxy failed or not configured, try direct fetch
        if (!response || !response.ok) {
            console.log('[Proxy] Trying direct fetch...');
            try {
                response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'User-Agent': userAgent,
                        'Accept': '*/*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                    },
                    redirect: 'follow',
                });
            } catch (fetchError) {
                console.error('[Proxy] Direct fetch error:', fetchError.message);
                throw fetchError;
            }
        }

        console.log(`[Proxy] Final response status: ${response.status} ${response.statusText} (via ${usedProxy ? 'external proxy' : 'direct'})`);

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'No response body');
            console.error(`[Proxy] HTTP error! status: ${response.status}, body: ${errorText.substring(0, 500)}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.text();
        console.log(`[Proxy] Successfully fetched ${data.length} bytes`);
        
        return new NextResponse(data, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        console.error(`[Proxy] Error fetching ${url}:`, error);
        return NextResponse.json({ 
            error: error.message,
            url: url,
            usedProxy: usedProxy,
            reason: 'Cloudflare bot protection blocks automated requests from datacenter IPs (including Cloudflare Workers).',
            solution: 'Paste the content directly',
            steps: [
                `Run: curl -L -H "User-Agent: Mozilla/5.0" "${url}" | base64 -d`,
                'Or open the URL in your browser and copy the content',
                'Paste the result (base64 string or decoded nodes) into the input field'
            ]
        }, { status: 500 });
    }
}
