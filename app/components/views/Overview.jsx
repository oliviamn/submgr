'use client';

import { useEffect, useState } from 'react';
import { useDashboard } from '../dashboard/DashboardContext';

export default function Overview() {
    const {
        shortCodeInput, setShortCodeInput,
        isLoading, setIsLoading, error, setError,
        subscriptions, setActiveView,
        setStandaloneProxies, setSubscriptions,
        setRemarks, setConfigCreatedTime,
        setAdvancedOptions, setSelectedRules,
        setSelectedRulePreset, setCustomRules,
        selectedProviderRuleSetIds, setSelectedProviderRuleSetIds,
        setProxyNodes,
        selectedProxyNodeIds, setSelectedProxyNodeIds,
        setProxyEnabled, setProxyUrl,
        setShortLinks, setConvertedConfigs,
        startNewConfig,
        refreshProxyNodes,
        refreshProviderRuleSets
    } = useDashboard();

    const [sessionAdminKey, setSessionAdminKey] = useState('');
    const [managedSessions, setManagedSessions] = useState([]);
    const [sessionListError, setSessionListError] = useState(null);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);

    const loadManagedSessions = async (providedKey = sessionAdminKey) => {
        const normalizedAdminKey = providedKey.trim();
        if (!normalizedAdminKey) {
            setSessionListError('Enter the admin key to browse saved sessions.');
            setManagedSessions([]);
            return;
        }

        try {
            setIsLoadingSessions(true);
            const response = await fetch('/api/sessions', {
                headers: {
                    'x-submgr-admin-key': normalizedAdminKey,
                },
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to load saved sessions');
            }

            setManagedSessions(data.sessions || []);
            setSessionListError(null);
            setSessionAdminKey(normalizedAdminKey);
            if (typeof window !== 'undefined') {
                window.sessionStorage.setItem('submgrSessionAdminKey', normalizedAdminKey);
            }
        } catch (loadError) {
            setManagedSessions([]);
            setSessionListError(loadError.message);
            if (typeof window !== 'undefined') {
                window.sessionStorage.removeItem('submgrSessionAdminKey');
            }
        } finally {
            setIsLoadingSessions(false);
        }
    };

    const syncSessionIndex = async (shortCode) => {
        const normalizedAdminKey = sessionAdminKey.trim();
        if (!normalizedAdminKey || !shortCode) {
            return;
        }

        try {
            const response = await fetch('/api/sessions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-submgr-admin-key': normalizedAdminKey,
                },
                body: JSON.stringify({ shortCode }),
            });

            if (!response.ok) {
                return;
            }

            await loadManagedSessions(normalizedAdminKey);
        } catch (syncError) {
            console.warn('Failed to sync session index:', syncError);
        }
    };

    const handleDeleteManagedSession = async (shortCode) => {
        const normalizedAdminKey = sessionAdminKey.trim();
        if (!normalizedAdminKey || !shortCode) {
            return;
        }

        if (typeof window !== 'undefined' && !window.confirm(`Delete saved session ${shortCode}?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/sessions/${encodeURIComponent(shortCode)}`, {
                method: 'DELETE',
                headers: {
                    'x-submgr-admin-key': normalizedAdminKey,
                },
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete saved session');
            }

            await loadManagedSessions(normalizedAdminKey);
        } catch (deleteError) {
            setSessionListError(deleteError.message);
        }
    };

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const savedAdminKey = window.sessionStorage.getItem('submgrSessionAdminKey');
        if (savedAdminKey) {
            setSessionAdminKey(savedAdminKey);
            loadManagedSessions(savedAdminKey);
        }
    }, []);

    const handleLoadConfig = async (requestedShortCode = shortCodeInput) => {
        const resolvedShortCode = typeof requestedShortCode === 'string'
            ? requestedShortCode
            : shortCodeInput;
        const normalizedShortCode = resolvedShortCode.trim();
        console.log('Loading config for shortcode:', normalizedShortCode);
        if (!normalizedShortCode) {
            setError('Please enter a short code');
            return;
        }

        try {
            setIsLoading(true);
            setShortCodeInput(normalizedShortCode);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem('lastShortCode', normalizedShortCode);
            }

            const response = await fetch(`/api/raw/${normalizedShortCode}`);
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
                    const subResponse = await fetch(`/api/subscription?ids=${encodeURIComponent(subIds.join(','))}`);
                    const subData = await subResponse.json();

                    if (subData.success) {
                        const loadedSubs = await Promise.all(
                            (subData.subscriptions || []).map(async (s) => {
                                try {
                                    const fullSubResponse = await fetch(`/api/subscription/${encodeURIComponent(s.subId)}`);
                                    if (fullSubResponse.ok) {
                                        const fullSubData = await fullSubResponse.json();
                                        return {
                                            ...s,
                                            proxies: fullSubData.proxies || [],
                                            enabled: subIds.includes(s.subId),
                                            providerRuleSetIds: fullSubData.providerRuleSetIds || [],
                                            providerRuleSetNames: fullSubData.providerRuleSetNames || [],
                                            providerRuleSetCount: fullSubData.providerRuleSetCount || 0,
                                            providerName: fullSubData.providerName,
                                        };
                                    }
                                } catch (error) {
                                    console.warn('Failed to load full subscription:', s.subId);
                                }

                                return { ...s, proxies: [], enabled: subIds.includes(s.subId) };
                            })
                        );
                        setSubscriptions(loadedSubs);
                    }
                }
                const proxyNodeIds = config.proxyNodeIds || configData.proxyNodeIds || [];
                if (proxyNodeIds.length > 0) {
                    const proxyResponse = await fetch(`/api/proxies?ids=${encodeURIComponent(proxyNodeIds.join(','))}`);
                    const proxyData = await proxyResponse.json();
                    if (proxyData.success) {
                        setProxyNodes((currentProxyNodes) => {
                            const selectedIds = new Set(proxyNodeIds);
                            const existingMap = new Map(currentProxyNodes.map(proxyNode => [proxyNode.id, proxyNode]));
                            return (proxyData.proxyNodes || []).map(proxyNode => ({
                                ...proxyNode,
                                enabled: selectedIds.has(proxyNode.id),
                                rawValue: existingMap.get(proxyNode.id)?.rawValue || proxyNode.rawValue,
                            }));
                        });
                        setSelectedProxyNodeIds(proxyNodeIds);
                    }
                } else {
                    setSelectedProxyNodeIds([]);
                }

                const legacyStandaloneProxies = config.standaloneProxies || configData.standaloneProxies || '';
                if (legacyStandaloneProxies.trim()) {
                    const proxyImportResponse = await fetch('/api/proxies', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            content: legacyStandaloneProxies,
                        }),
                    });

                    const proxyImportData = await proxyImportResponse.json();
                    if (proxyImportData.success) {
                        const importedIds = (proxyImportData.proxyNodes || []).map(proxyNode => proxyNode.id);
                        setSelectedProxyNodeIds(importedIds);
                        await refreshProxyNodes();
                        setStandaloneProxies('');
                    } else {
                        setStandaloneProxies(legacyStandaloneProxies);
                    }
                } else {
                    setStandaloneProxies('');
                }
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
                let selectedRuleSetIds = configData.rules.selectedProviderRuleSetIds || [];
                const legacyCustomRules = configData.rules.customRules || [];
                if (legacyCustomRules.length > 0) {
                    const savedRuleSets = await Promise.all(
                        legacyCustomRules.map(async (rule) => {
                            const response = await fetch('/api/rulesets', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    ruleSet: {
                                        name: rule.name,
                                        outbound: rule.name,
                                        displayName: rule.name,
                                        source: {
                                            kind: 'manual',
                                            providerName: 'Custom',
                                        },
                                        rules: {
                                            site_rules: rule.site ? rule.site.split(',').map(value => value.trim()).filter(Boolean) : [],
                                            ip_rules: rule.ip ? rule.ip.split(',').map(value => value.trim()).filter(Boolean) : [],
                                            domain_suffix: rule.domain_suffix ? rule.domain_suffix.split(',').map(value => value.trim()).filter(Boolean) : [],
                                            domain_keyword: rule.domain_keyword ? rule.domain_keyword.split(',').map(value => value.trim()).filter(Boolean) : [],
                                            ip_cidr: rule.ip_cidr ? rule.ip_cidr.split(',').map(value => value.trim()).filter(Boolean) : [],
                                            protocol: rule.protocol ? rule.protocol.split(',').map(value => value.trim()).filter(Boolean) : [],
                                        },
                                    },
                                }),
                            });

                            if (!response.ok) {
                                return null;
                            }

                            const data = await response.json();
                            return data.ruleSet;
                        })
                    );

                    selectedRuleSetIds = [
                        ...selectedRuleSetIds,
                        ...savedRuleSets.filter(Boolean).map(ruleSet => ruleSet.id),
                    ];
                    await refreshProviderRuleSets();
                }
                setSelectedProviderRuleSetIds(Array.from(new Set(selectedRuleSetIds)));
                setCustomRules([]);
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
                newShortLinks[type] = `${window.location.origin}/api/${type}/${normalizedShortCode}`;
            });
            setShortLinks(newShortLinks);

            await syncSessionIndex(normalizedShortCode);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const formatSessionTimestamp = (value) => {
        if (!value) {
            return 'Unknown';
        }

        try {
            return new Date(value).toLocaleString();
        } catch (error) {
            return value;
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
                    <h3 className="text-4xl font-bold text-gray-800 mb-1">{subscriptions.filter(sub => sub.enabled).length}</h3>
                    <p className="text-gray-500 font-medium">Selected Subscriptions</p>
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
                    <h3 className="text-4xl font-bold text-gray-800 mb-1">{selectedProxyNodeIds.length}</h3>
                    <p className="text-gray-500 font-medium">Selected Proxy Nodes</p>
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
                    <h3 className="text-4xl font-bold text-gray-800 mb-1">{new Set(selectedProviderRuleSetIds).size}</h3>
                    <p className="text-gray-500 font-medium">Rule Libraries</p>
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
                         <p className="text-gray-500 mb-4">Retrieve a previously saved configuration using its shortcode, or unlock the saved session library below.</p>

                         <div className="flex gap-3 mt-auto">
                             <input
                                 type="text"
                                 placeholder="Shortcode (e.g. abc12)"
                                 value={shortCodeInput}
                                 onChange={(e) => {
                                     setShortCodeInput(e.target.value);
                                     setError(null);
                                 }}
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

                         <div className="mt-6 pt-6 border-t border-gray-100">
                             <div className="flex items-center justify-between gap-3 mb-3">
                                 <div>
                                     <h3 className="text-lg font-semibold text-gray-800">Saved Session Library</h3>
                                     <p className="text-sm text-gray-500">Unlock with the admin key to browse saved shortcodes. Manual shortcode loads are auto-indexed after unlock.</p>
                                 </div>
                                 <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Protected</span>
                             </div>

                             <div className="flex gap-3">
                                 <input
                                     type="password"
                                     placeholder="Admin key"
                                     value={sessionAdminKey}
                                     onChange={(e) => {
                                         setSessionAdminKey(e.target.value);
                                         setSessionListError(null);
                                     }}
                                     className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                                 />
                                 <button
                                     onClick={() => loadManagedSessions()}
                                     disabled={isLoadingSessions}
                                     className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                                 >
                                     {isLoadingSessions ? '...' : 'Unlock Sessions'}
                                 </button>
                             </div>

                             {sessionListError && (
                                 <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                                     {sessionListError}
                                 </div>
                             )}

                             {managedSessions.length > 0 && (
                                 <div className="mt-4 space-y-3 max-h-80 overflow-y-auto pr-1">
                                     {managedSessions.map((session) => (
                                         <div key={session.shortCode} className="border border-gray-100 rounded-xl p-4 bg-gray-50/70">
                                             <div className="flex items-start justify-between gap-4">
                                                 <div className="min-w-0">
                                                     <div className="font-semibold text-gray-800 truncate">{session.title || `Session ${session.shortCode}`}</div>
                                                     <div className="text-xs text-gray-500 font-mono mt-1">{session.shortCode}</div>
                                                     {session.remarks && (
                                                         <div className="text-sm text-gray-600 mt-2 line-clamp-2">{session.remarks}</div>
                                                     )}
                                                 </div>
                                                 <div className="flex items-center gap-2 shrink-0">
                                                     <button
                                                         onClick={() => handleLoadConfig(session.shortCode)}
                                                         disabled={isLoading}
                                                         className="px-3 py-2 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-lg disabled:opacity-50"
                                                     >
                                                         Load
                                                     </button>
                                                     <button
                                                         onClick={() => handleDeleteManagedSession(session.shortCode)}
                                                         className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                                                     >
                                                         Delete
                                                     </button>
                                                 </div>
                                             </div>
                                             <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                                                 <span className="px-2 py-1 bg-white rounded-full border border-gray-200">{session.subscriptionCount || 0} subscriptions</span>
                                                 <span className="px-2 py-1 bg-white rounded-full border border-gray-200">{session.proxyNodeCount || 0} proxies</span>
                                                 <span className="px-2 py-1 bg-white rounded-full border border-gray-200">{session.ruleSetCount || 0} rules</span>
                                                 <span className="px-2 py-1 bg-white rounded-full border border-gray-200">Updated {formatSessionTimestamp(session.updatedAt || session.createdAt)}</span>
                                             </div>
                                         </div>
                                     ))}
                                 </div>
                             )}

                             {sessionAdminKey.trim() && !sessionListError && !isLoadingSessions && managedSessions.length === 0 && (
                                 <div className="mt-4 p-3 bg-gray-50 text-gray-600 rounded-lg text-sm">
                                     No indexed sessions yet. Load a session by shortcode after unlocking to add it to this library.
                                 </div>
                             )}
                         </div>
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
