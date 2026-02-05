import { ProxyParser } from './ProxyParsers.js';
import { DeepCopy, decodeBase64 } from './utils.js';
import { t, setLanguage } from './i18n/index.js';
import { generateRules, getOutbounds, PREDEFINED_RULE_SETS } from './config.js';

export class BaseConfigBuilder {
    constructor(inputString, baseConfig, lang, userAgent) {
        this.inputString = inputString;
        this.config = DeepCopy(baseConfig);
        this.customRules = [];
        this.selectedRules = [];
        this.failedSubscriptions = [];
        setLanguage(lang);
        this.userAgent = userAgent;
    }

    async build() {
        const customItems = await this.parseCustomItems();
        
        // Check if we got any proxies
        const currentProxies = this.getProxies();
        if (customItems.length === 0 && currentProxies.length === 0) {
            // Check if we have detailed error info from a failed subscription
            const firstFailed = this.failedSubscriptions?.[0];
            if (firstFailed?.error?.steps) {
                // Propagate the structured error from the API
                const error = new Error(firstFailed.error.error || 'Failed to fetch subscription');
                error.details = firstFailed.error;
                throw error;
            }
            
            const error = new Error(
                this.failedSubscriptions?.length > 0
                    ? `Failed to fetch subscription(s). The provider may be blocking Cloudflare IPs. Try:
1. Using a different network to access the subscription
2. Pasting the proxy nodes directly instead of the subscription URL
3. Contact your subscription provider about Cloudflare bot protection`
                    : 'No valid proxy configurations found. Please check your input.'
            );
            error.failedSubscriptions = this.failedSubscriptions;
            throw error;
        }
        
        this.addCustomItems(customItems);
        this.addSelectors();
        return this.formatConfig();
    }

    async parseCustomItems() {
        const urls = this.inputString.split('\n').filter(url => url.trim() !== '');
        const parsedItems = [];
        const failedUrls = [];

        for (const url of urls) {
            // Try to decode if it might be base64
            const processedUrls = this.tryDecodeBase64(url);
            
            // Handle single URL or array of URLs
            if (Array.isArray(processedUrls)) {
                // Handle multiple URLs from a single base64 string
                for (const processedUrl of processedUrls) {
                    const result = await ProxyParser.parse(processedUrl, this.userAgent);
                    if (Array.isArray(result)) {
                        for (const subUrl of result) {
                            const subResult = await ProxyParser.parse(subUrl, this.userAgent);
                            if (subResult) {
                                parsedItems.push(subResult);
                            }
                        }
                    } else if (result) {
                        parsedItems.push(result);
                    }
                }
            } else {
                // Handle single URL (original behavior)
                try {
                    const result = await ProxyParser.parse(processedUrls, this.userAgent);
                    if (Array.isArray(result)) {
                        if (result.length === 0 && (processedUrls.startsWith('http://') || processedUrls.startsWith('https://'))) {
                            console.warn(`[BaseConfigBuilder] Empty result from subscription URL: ${processedUrls}`);
                            failedUrls.push({ url: processedUrls, error: 'Empty response' });
                        }
                        for (const subUrl of result) {
                            const subResult = await ProxyParser.parse(subUrl, this.userAgent);
                            if (subResult) {
                                parsedItems.push(subResult);
                            }
                        }
                    } else if (result) {
                        parsedItems.push(result);
                    } else {
                        // If result is null/undefined and it's a URL, mark as failed
                        if (processedUrls.startsWith('http://') || processedUrls.startsWith('https://')) {
                            failedUrls.push({ url: processedUrls, error: 'No result' });
                        }
                    }
                } catch (error) {
                    console.error(`[BaseConfigBuilder] Error parsing ${processedUrls}:`, error);
                    if (processedUrls.startsWith('http://') || processedUrls.startsWith('https://')) {
                        failedUrls.push({ url: processedUrls, error: error.details || error.message });
                    }
                }
            }
        }

        // If we have failed URLs, log them but don't throw - 
        // let the caller decide if this is fatal (based on whether we got any proxies)
        if (failedUrls.length > 0) {
            console.warn(`[BaseConfigBuilder] Failed to fetch from ${failedUrls.length} subscription(s):`, failedUrls);
            this.failedSubscriptions = failedUrls;
        }

        return parsedItems;
    }

    tryDecodeBase64(str) {
        // If the string already has a protocol prefix, return as is
        if (str.includes('://')) {
            return str;
        }

        try {
            // Try to decode as base64
            const decoded = decodeBase64(str);
            
            // Check if decoded content contains multiple links
            if (decoded.includes('\n')) {
                // Split by newline and filter out empty lines
                const multipleUrls = decoded.split('\n').filter(url => url.trim() !== '');
                
                // Check if at least one URL is valid
                if (multipleUrls.some(url => url.includes('://'))) {
                    return multipleUrls;
                }
            }
            
            // Check if the decoded string looks like a valid URL
            if (decoded.includes('://')) {
                return decoded;
            }
        } catch (e) {
            // If decoding fails, return original string
        }
        return str;
    }

    getOutboundsList() {
        let outbounds;
        if (typeof this.selectedRules === 'string' && PREDEFINED_RULE_SETS[this.selectedRules]) {
            outbounds = getOutbounds(PREDEFINED_RULE_SETS[this.selectedRules]);
        } else if (this.selectedRules && Object.keys(this.selectedRules).length > 0) {
            outbounds = getOutbounds(this.selectedRules);
        } else {
            outbounds = getOutbounds(PREDEFINED_RULE_SETS.minimal);
        }
        return outbounds;
    }

    getProxyList() {
        return this.getProxies().map(proxy => this.getProxyName(proxy));
    }

    getProxies() {
        throw new Error('getProxies must be implemented in child class');
    }

    getProxyName(proxy) {
        throw new Error('getProxyName must be implemented in child class');
    }

    convertProxy(proxy) {
        throw new Error('convertProxy must be implemented in child class');
    }

    addProxyToConfig(proxy) {
        throw new Error('addProxyToConfig must be implemented in child class');
    }

    addAutoSelectGroup(proxyList) {
        throw new Error('addAutoSelectGroup must be implemented in child class');
    }

    addNodeSelectGroup(proxyList) {
        throw new Error('addNodeSelectGroup must be implemented in child class');
    }

    addOutboundGroups(outbounds, proxyList) {
        throw new Error('addOutboundGroups must be implemented in child class');
    }

    addCustomRuleGroups(proxyList) {
        throw new Error('addCustomRuleGroups must be implemented in child class');
    }

    addFallBackGroup(proxyList) {
        throw new Error('addFallBackGroup must be implemented in child class');
    }

    addCustomItems(customItems) {
        const validItems = customItems.filter(item => item != null);
        validItems.forEach(item => {
            if (item?.tag) {
                const convertedProxy = this.convertProxy(item);
                if (convertedProxy) {
                    this.addProxyToConfig(convertedProxy);
                }
            }
        });
    }

    addSelectors() {
        const outbounds = this.getOutboundsList();
        const proxyList = this.getProxyList();

        this.addAutoSelectGroup(proxyList);
        this.addNodeSelectGroup(proxyList);
        this.addOutboundGroups(outbounds, proxyList);
        this.addCustomRuleGroups(proxyList);
        this.addFallBackGroup(proxyList);
    }

    generateRules() {
        return generateRules(this.selectedRules, this.customRules);
    }

    formatConfig() {
        throw new Error('formatConfig must be implemented in child class');
    }
}