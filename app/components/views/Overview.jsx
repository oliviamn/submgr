'use client';

import { useDashboard } from '../dashboard/DashboardContext';
import { t } from '../../lib/i18n';

export default function Overview() {
    const {
        shortCodeInput, setShortCodeInput,
        isLoading, setIsLoading, error, setError,
        subscriptions, standaloneProxies,
        customRules, setActiveView,
        setStandaloneProxies, setSubscriptions,
        setRemarks, setConfigCreatedTime,
        setAdvancedOptions, setSelectedRules,
        setSelectedRulePreset, setCustomRules,
        setProxyEnabled, setProxyUrl,
        setShortLinks, setConvertedConfigs,
        startNewConfig
    } = useDashboard();

    const handleLoadConfig = async () => {
        console.log('Loading config for shortcode:', shortCodeInput);
        if (!shortCodeInput) {
            setError('Please enter a short code');
            return;
        }

        try {
            setIsLoading(true);
            const response = await fetch(`/api/raw/${shortCodeInput}`);
            if (!response.ok) {
                throw new Error('Failed to load configuration');
            }

            const config = await response.json();
            console.log('Loaded config:', config);

            const configData = config.config || config;

            // Handle v2 format
            if (config.version === '2.0' || configData.version === '2.0') {
                if (config.subscriptionIds || configData.subscriptionIds) {
                    const subIds = config.subscriptionIds || configData.subscriptionIds || [];

                    const subResponse = await fetch(`/api/subscription?shortCode=${shortCodeInput}`);
                    const subData = await subResponse.json();

                    if (subData.success) {
                        const loadedSubs = await Promise.all(
                            (subData.subscriptions || []).map(async (s) => {
                                // In a real implementation we would fetch details here if needed
                                return { ...s, enabled: subIds.includes(s.subId) };
                            })
                        );
                        setSubscriptions(loadedSubs);
                    }
                }
                setStandaloneProxies(config.standaloneProxies || configData.standaloneProxies || '');
            } else {
                setStandaloneProxies(configData.inputValue || '');
                setSubscriptions([]);
            }

            setRemarks(configData.remarks || '');
            setConfigCreatedTime(configData.configCreatedTime || '');

            // Rules
            if (configData.rules) {
                setAdvancedOptions(configData.rules.advancedOptions || false);
                setSelectedRules(configData.rules.selectedRules || []);
                setSelectedRulePreset(configData.rules.selectedRulePreset || 'custom');
                setCustomRules(configData.rules.customRules || []);
                setProxyEnabled(configData.rules.proxyEnabled || false);
                setProxyUrl(configData.rules.proxyUrl || '');
            }

            setConvertedConfigs({
                xray: { type: 'xray' },
                singbox: { type: 'singbox' },
                clash: { type: 'clash' },
                surge: { type: 'surge' }
            });

            const newShortLinks = {};
            ['xray', 'singbox', 'clash', 'surge'].forEach(type => {
                newShortLinks[type] = `${window.location.origin}/api/${type}/${shortCodeInput}`;
            });
            setShortLinks(newShortLinks);

            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div
                    onClick={() => setActiveView('subscriptions')}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all group"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-purple-50 rounded-xl group-hover:bg-purple-100 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                        </div>
                        <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">Active</span>
                    </div>
                    <h3 className="text-4xl font-bold text-gray-800 mb-1">{subscriptions.length}</h3>
                    <p className="text-gray-500 font-medium">Subscriptions</p>
                </div>

                <div
                    onClick={() => setActiveView('proxies')}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all group"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M12 8v8" /><path d="M8 12h8" /></svg>
                        </div>
                        <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">Edit</span>
                    </div>
                    <h3 className="text-4xl font-bold text-gray-800 mb-1">{standaloneProxies ? 'Yes' : 'No'}</h3>
                    <p className="text-gray-500 font-medium">Standalone Proxies</p>
                </div>

                <div
                    onClick={() => setActiveView('rules')}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all group"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-pink-50 rounded-xl group-hover:bg-pink-100 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-600"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
                        </div>
                        <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">Config</span>
                    </div>
                    <h3 className="text-4xl font-bold text-gray-800 mb-1">{customRules.length}</h3>
                    <p className="text-gray-500 font-medium">Custom Rules</p>
                </div>
            </div>

            {/* Quick Actions (Start New / Load) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Start New */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                    <div className="p-8 flex-1">
                        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">New Configuration</h2>
                        <p className="text-gray-500 mb-6">Start fresh with a new configuration session. We'll generate a temporary ID for you.</p>
                        <button
                            onClick={startNewConfig}
                            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-purple-200 flex items-center justify-center gap-2"
                        >
                            Start New Session
                        </button>
                    </div>
                </div>

                {/* Load Existing */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                    <div className="p-8 flex-1">
                        <div className="w-12 h-12 bg-gray-100 text-gray-600 rounded-xl flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Load Existing</h2>
                        <p className="text-gray-500 mb-4">Retrieve a previously saved configuration using its shortcode.</p>

                        <div className="flex gap-3 mt-auto">
                            <input
                                type="text"
                                placeholder="Shortcode (e.g. abc12)"
                                value={shortCodeInput}
                                onChange={(e) => setShortCodeInput(e.target.value)}
                                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all font-mono text-lg"
                            />
                            <button
                                onClick={handleLoadConfig}
                                disabled={isLoading}
                                className="px-6 py-3 bg-gray-900 hover:bg-black text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                            >
                                {isLoading ? '...' : 'Load'}
                            </button>
                        </div>
                        {error && (
                            <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                                {error}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-8 text-white shadow-xl shadow-purple-200">
                    <h3 className="text-2xl font-bold mb-2">Convert & Export</h3>
                    <p className="text-indigo-100 mb-6 opacity-90">Generate compatible subscription links for all major clients including Clash, Surge, and Sing-box.</p>
                    <button
                        onClick={() => setActiveView('convert')}
                        className="bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 text-white px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2"
                    >
                        Go to Converter
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                    </button>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-2 h-8 bg-green-500 rounded-full" />
                        <h3 className="text-xl font-bold text-gray-800">System Status</h3>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-gray-600 font-medium">API Service</span>
                            <span className="text-green-600 text-sm font-bold bg-green-100 px-2 py-1 rounded">Operational</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-gray-600 font-medium">Conversion Engine</span>
                            <span className="text-green-600 text-sm font-bold bg-green-100 px-2 py-1 rounded">Operational</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
