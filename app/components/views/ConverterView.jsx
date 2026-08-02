'use client';

import { useDashboard } from '../dashboard/DashboardContext';
import { t } from '../../lib/i18n';
import { SingboxConfigBuilder } from '../../lib/SingboxConfigBuilder';
import { ClashConfigBuilder } from '../../lib/ClashConfigBuilder';
import { SurgeConfigBuilder } from '../../lib/SurgeConfigBuilder';

export default function ConverterView() {
    const {
        standaloneProxies,
        advancedOptions,
        selectedRulePreset,
        selectedRules,
        customRules,
        currentLang,
        convertedConfigs, setConvertedConfigs,
        isConverting, setIsConverting,
        error, setError,
        shortLinks, setShortLinks,
        shortCodeInput, setShortCodeInput,
        remarks, setRemarks,
        configCreatedTime,
        proxyEnabled,
        proxyUrl,
        subscriptions,
        providerRuleSets,
        selectedProviderRuleSetIds,
        proxyNodes,
        selectedProxyNodeIds
    } = useDashboard();

    // Helper to get enabled subscription proxies
    const getEnabledSubscriptionProxies = () => {
        const enabledProxies = [];
        for (const sub of subscriptions) {
            if (sub.enabled && sub.proxies) {
                enabledProxies.push(...sub.proxies);
            }
        }

        for (const proxyNode of proxyNodes) {
            if (selectedProxyNodeIds.includes(proxyNode.id)) {
                enabledProxies.push(proxyNode);
            }
        }

        return enabledProxies;
    };

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            // Could add a toast notification here
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleConvert = async () => {
        try {
            setIsConverting(true);
            setError(null);

            // Get enabled subscription proxies
            const enabledSubProxies = getEnabledSubscriptionProxies();

            // Check if we have any proxies to work with
            const hasStandaloneProxies = standaloneProxies.trim().length > 0;
            const hasSubscriptionProxies = enabledSubProxies.length > 0;

            if (!hasStandaloneProxies && !hasSubscriptionProxies) {
                setError('Please add at least one subscription or standalone proxy');
                setIsConverting(false);
                return;
            }

            // Create config builders with cached subscription proxies
            const userAgent = 'curl/7.74.0';
            const baseConfig = {};
            const selectedProviderRuleSets = providerRuleSets.filter(ruleSet => selectedProviderRuleSetIds.includes(ruleSet.id));
            const managedCustomRules = selectedProviderRuleSets
                .filter(ruleSet => ruleSet.source?.kind === 'manual')
                .map(ruleSet => ({
                    name: ruleSet.outbound || ruleSet.name,
                    site: (ruleSet.rules?.site_rules || []).join(','),
                    ip: (ruleSet.rules?.ip_rules || []).join(','),
                    domain_suffix: (ruleSet.rules?.domain_suffix || []).join(','),
                    domain_keyword: (ruleSet.rules?.domain_keyword || []).join(','),
                    ip_cidr: (ruleSet.rules?.ip_cidr || []).join(','),
                    protocol: (ruleSet.rules?.protocol || []).join(','),
                }));
            const extractedProviderRuleSets = selectedProviderRuleSets.filter(ruleSet => ruleSet.source?.kind !== 'manual');

            const builders = {
                xray: new SingboxConfigBuilder(standaloneProxies, selectedRules, [...customRules, ...managedCustomRules], undefined, currentLang, userAgent, proxyEnabled, proxyUrl, enabledSubProxies, extractedProviderRuleSets),
                singbox: new SingboxConfigBuilder(standaloneProxies, selectedRules, [...customRules, ...managedCustomRules], undefined, currentLang, userAgent, proxyEnabled, proxyUrl, enabledSubProxies, extractedProviderRuleSets),
                clash: new ClashConfigBuilder(standaloneProxies, selectedRules, [...customRules, ...managedCustomRules], baseConfig, currentLang, userAgent, proxyEnabled, proxyUrl, enabledSubProxies, extractedProviderRuleSets),
                surge: new SurgeConfigBuilder(standaloneProxies, selectedRules, [...customRules, ...managedCustomRules], baseConfig, currentLang, userAgent, proxyEnabled, proxyUrl, enabledSubProxies, extractedProviderRuleSets)
            };

            // Generate a single shortcode for all types
            let shortCode = Math.random().toString(36).substring(2, 7);

            if (shortCodeInput && shortCodeInput.length > 0) {
                shortCode = shortCodeInput;
            }

            // Save shortcode to local storage
            localStorage.setItem('lastShortCode', shortCode);

            // Special handling for Surge subscription URL if needed
            if (builders.surge.setSubscriptionUrl) {
                builders.surge.setSubscriptionUrl(`${window.location.origin}/api/surge/${shortCode}`);
            }

            const configs = {};
            const newShortLinks = {};

            // Get subscription IDs for storage
            const subscriptionIds = subscriptions
                .filter(s => s.enabled)
                .map(s => s.subId);

            // Save raw config with references
            await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'raw',
                    config: {
                        rules: {
                            advancedOptions,
                            selectedRules,
                            selectedRulePreset,
                            selectedProviderRuleSetIds,
                            proxyEnabled,
                            proxyUrl
                        },
                        remarks,
                        configCreatedTime: new Date().toISOString(),
                        version: '2.0'
                    },
                    subscriptionIds,
                    proxyNodeIds: selectedProxyNodeIds,
                    shortCode,
                })
            });

            for (const [type, builder] of Object.entries(builders)) {
                const config = await builder.build();
                configs[type] = config;

                // Save config to KV store
                try {
                    await fetch('/api/config', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            type,
                            config,
                            shortCode,
                            subscriptionIds,
                            proxyNodeIds: selectedProxyNodeIds
                        })
                    });

                    newShortLinks[type] = `${window.location.origin}/api/${type}/${shortCode}`;

                } catch (error) {
                    console.error('Error saving config:', error);
                    continue;
                }
            }

            setConvertedConfigs(configs);
            setShortLinks(newShortLinks);
            if (shortCode) {
                setShortCodeInput(shortCode);
            }
        } catch (err) {
            // Handle structured error objects from API
            if (err.details && typeof err.details === 'object') {
                setError(err.details);
            } else {
                setError(err.message || 'Conversion failed');
            }
            console.error('Conversion error:', err);
        } finally {
            setIsConverting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Session Details</h2>
                        <p className="text-gray-500">Name this session so it is easy to find later in the Sessions library.</p>
                    </div>
                    {shortCodeInput && (
                        <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 font-mono">
                            {shortCodeInput}
                        </span>
                    )}
                </div>

                <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-700">
                        Session Name / Description
                    </label>
                    <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="e.g. 自建节点+Wget（不含公司)"
                        className="w-full min-h-24 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    />
                    <p className="text-sm text-gray-500">
                        This text is saved with the session and shown in the Sessions view for browsing and rename.
                    </p>
                    {configCreatedTime && (
                        <div className="text-xs text-gray-500">
                            Last loaded: {new Date(configCreatedTime).toLocaleString(currentLang)}
                        </div>
                    )}
                </div>
            </div>

            {/* Conversion Action */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Ready to Convert?</h2>
                <p className="text-gray-500 mb-8 max-w-lg mx-auto">
                    Generate your subscription links. This will combine your subscriptions, standalone proxies, and rules into a single configuration.
                </p>

                <button
                    onClick={handleConvert}
                    disabled={isConverting}
                    className={`px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-purple-200 hover:shadow-xl hover:scale-105 transition-all flex items-center gap-3 mx-auto ${isConverting ? 'opacity-75 cursor-wait' : ''}`}
                >
                    {isConverting ? (
                        <>
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                            <span>Generating Config...</span>
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
                            <span>Convert Now</span>
                        </>
                    )}
                </button>

                {error && (
                    <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm max-w-2xl mx-auto">
                        <span className="font-bold block mb-1">Error:</span>
                        {typeof error === 'string' ? error : JSON.stringify(error)}
                    </div>
                )}
            </div>

            {/* Results */}
            {convertedConfigs && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
                    {Object.entries(convertedConfigs).map(([type, config]) => (
                        <div key={type} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${type === 'clash' ? 'bg-blue-100 text-blue-600' :
                                        type === 'surge' ? 'bg-indigo-100 text-indigo-600' :
                                            type === 'singbox' ? 'bg-amber-100 text-amber-600' :
                                                'bg-purple-100 text-purple-600'
                                        }`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                                    </div>
                                    <h3 className="font-bold text-gray-800 capitalize">{type}</h3>
                                </div>
                                <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full border border-green-100">Ready</span>
                            </div>

                            <div className="relative mb-4 group">
                                <input
                                    readOnly
                                    value={shortLinks[type]}
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-600 text-sm rounded-lg p-3 pr-24 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                                <div className="absolute right-1 top-1 bottom-1 flex gap-1">
                                    <button
                                        onClick={() => copyToClipboard(shortLinks[type])}
                                        className="px-3 bg-white border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 hover:text-purple-600 transition-colors text-xs font-medium shadow-sm"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>

                            <div className="mt-auto flex gap-2">
                                <a
                                    href={shortLinks[type]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 text-center py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black transition-colors"
                                >
                                    Open Link
                                </a>
                                {/* QR Code button could go here */}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
