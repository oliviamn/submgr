import { ProxyParser } from './ProxyParsers.js';
import { ProviderRuleParser } from './ProviderRuleParser.js';
import { saveProviderRuleSets } from './providerRuleStore.js';
import { fetchSubscription } from './subscriptionFetcher.js';
import { decodeBase64 } from './utils.js';

export const SURGE_RULES_USER_AGENT = 'Surge/5.0.8';

export function deriveProviderName(subscriptionUrl = '') {
  try {
    const hostname = new URL(subscriptionUrl).hostname.replace(/^www\./, '');
    return hostname.split('.')[0] || hostname;
  } catch (error) {
    return 'provider';
  }
}

export function decodeSubscriptionText(text = '') {
  try {
    const decoded = decodeBase64(text.trim());
    if (!decoded) {
      return text;
    }

    if (decoded.includes('%')) {
      try {
        return decodeURIComponent(decoded);
      } catch (error) {
        return decoded;
      }
    }

    return decoded;
  } catch (error) {
    if (text.includes('%')) {
      try {
        return decodeURIComponent(text);
      } catch (decodeError) {
        return text;
      }
    }

    return text;
  }
}

export async function parseSubscriptionProxies(text, userAgent) {
  const decodedText = decodeSubscriptionText(text);
  const lines = decodedText.split('\n').filter(line => line.trim() !== '');
  const proxies = [];

  for (const line of lines) {
    try {
      const result = await ProxyParser.parse(line, userAgent);
      if (result && !Array.isArray(result)) {
        proxies.push(result);
      }
    } catch (error) {
      console.warn('[SubscriptionProcessing] Failed to parse line:', line.substring(0, 50));
    }
  }

  if (proxies.length === 0) {
    proxies.push(...ProviderRuleParser.extractProxyObjects(decodedText));
  }

  return {
    decodedText,
    lines,
    proxies,
  };
}

export async function extractAndStoreProviderRuleSets({
  env,
  url,
  subscriptionId,
  proxyUrl,
}) {
  const fetchedAt = new Date().toISOString();

  try {
    const text = await fetchSubscription(url, SURGE_RULES_USER_AGENT, proxyUrl);
    const extractedRuleSets = ProviderRuleParser.extractRuleSets(text).map(ruleSet => ({
      ...ruleSet,
      source: {
        ...ruleSet.source,
        subscriptionId,
        subscriptionUrl: url,
        providerName: deriveProviderName(url),
        fetchedAt,
        userAgent: SURGE_RULES_USER_AGENT,
      },
    }));

    if (extractedRuleSets.length === 0) {
      return {
        extractedRuleSets: [],
        format: ProviderRuleParser.detect(text),
      };
    }

    const savedRuleSets = await saveProviderRuleSets(env, extractedRuleSets);

    return {
      extractedRuleSets: savedRuleSets,
      format: ProviderRuleParser.detect(text),
    };
  } catch (error) {
    console.warn('[SubscriptionProcessing] Provider rule extraction failed:', error.message);
    return {
      extractedRuleSets: [],
      format: 'unknown',
      error,
    };
  }
}
