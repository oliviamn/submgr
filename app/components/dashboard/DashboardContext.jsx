'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { setLanguage, getCurrentLang } from '../../lib/i18n';

const DashboardContext = createContext();

// Views are addressable via URLs; activeView is derived from the pathname so
// refresh, deep links, and the browser back button all work.
const VIEW_TO_PATH = {
  overview: '/',
  sessions: '/sessions',
  subscriptions: '/subscriptions',
  proxies: '/proxies',
  rules: '/rules',
  convert: '/convert',
};

const PATH_TO_VIEW = Object.fromEntries(
  Object.entries(VIEW_TO_PATH).map(([view, path]) => [path, view])
);

export function DashboardProvider({ children }) {
  // --- State from SublinkWorker ---
  const [standaloneProxies, setStandaloneProxies] = useState('');
  const [advancedOptions, setAdvancedOptions] = useState(false);
  const [selectedRulePreset, setSelectedRulePreset] = useState('custom');
  const [selectedRules, setSelectedRules] = useState([]);
  const [currentLang, setCurrentLang] = useState('zh-CN');
  const [convertedConfigs, setConvertedConfigs] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState(null);
  const [shortLinks, setShortLinks] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [shortCodeInput, setShortCodeInput] = useState('');
  const [remarks, setRemarks] = useState('');
  const [configCreatedTime, setConfigCreatedTime] = useState('');
  const [customRules, setCustomRules] = useState([]);
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyUrl, setProxyUrl] = useState('');
  const [subscriptions, setSubscriptions] = useState([]);
  const [providerRuleSets, setProviderRuleSets] = useState([]);
  const [selectedProviderRuleSetIds, setSelectedProviderRuleSetIds] = useState([]);
  const [proxyNodes, setProxyNodes] = useState([]);
  const [selectedProxyNodeIds, setSelectedProxyNodeIds] = useState([]);
  const [managedSessions, setManagedSessions] = useState([]);
  const [sessionListError, setSessionListError] = useState(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [apiStatus, setApiStatus] = useState('checking'); // checking | online | offline

  // --- Active View (derived from the URL) ---
  const pathname = usePathname();
  const router = useRouter();
  const activeView = PATH_TO_VIEW[pathname] || 'overview';
  const setActiveView = (view) => {
    const path = VIEW_TO_PATH[view];
    if (path && path !== pathname) {
      router.push(path);
    }
  };

  const refreshProviderRuleSets = async () => {
    try {
      const response = await fetch('/api/rulesets');
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (data.success) {
        setProviderRuleSets(data.ruleSets || []);
      }
    } catch (error) {
      console.warn('Failed to refresh provider rule sets:', error);
    }
  };

  const refreshProxyNodes = async () => {
    try {
      const response = await fetch('/api/proxies');
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (data.success) {
        setProxyNodes((currentProxyNodes) => {
          const selectedIds = new Set(currentProxyNodes.filter(proxyNode => proxyNode.enabled).map(proxyNode => proxyNode.id));
          return (data.proxyNodes || []).map(proxyNode => ({
            ...proxyNode,
            enabled: selectedIds.has(proxyNode.id),
          }));
        });
      }
    } catch (error) {
      console.warn('Failed to refresh proxy nodes:', error);
    }
  };

  const loadManagedSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const response = await fetch('/api/sessions');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load saved sessions');
      }

      setManagedSessions(data.sessions || []);
      setSessionListError(null);
      return true;
    } catch (loadError) {
      setManagedSessions([]);
      setSessionListError(loadError.message);
      return false;
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const syncSessionIndex = async (shortCode) => {
    if (!shortCode) {
      return false;
    }

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shortCode }),
      });

      if (!response.ok) {
        return false;
      }

      await loadManagedSessions();
      return true;
    } catch (syncError) {
      console.warn('Failed to sync session index:', syncError);
      return false;
    }
  };

  const deleteManagedSessionByShortCode = async (shortCode) => {
    if (!shortCode) {
      return false;
    }

    const response = await fetch(`/api/sessions/${encodeURIComponent(shortCode)}`, {
      method: 'DELETE',
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete saved session');
    }

    setManagedSessions((currentSessions) => currentSessions.filter((session) => session.shortCode !== shortCode));
    setSessionListError(null);
    return true;
  };

  const renameManagedSession = async (shortCode, remarksValue) => {
    const normalizedRemarks = String(remarksValue || '').trim();

    if (!shortCode) {
      return false;
    }

    const response = await fetch(`/api/sessions/${encodeURIComponent(shortCode)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        remarks: normalizedRemarks,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to rename saved session');
    }

    setManagedSessions((currentSessions) => currentSessions.map((session) => (
      session.shortCode === shortCode ? data.session : session
    )));

    if (shortCode === shortCodeInput) {
      setRemarks(normalizedRemarks);
    }

    setSessionListError(null);
    return true;
  };

  const loadConfigByShortCode = async (requestedShortCode = shortCodeInput) => {
    const resolvedShortCode = typeof requestedShortCode === 'string'
      ? requestedShortCode
      : shortCodeInput;
    const normalizedShortCode = resolvedShortCode.trim();

    if (!normalizedShortCode) {
      setError('Please enter a short code');
      return false;
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
      const configData = config.config || config;

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
              const existingMap = new Map(currentProxyNodes.map((proxyNode) => [proxyNode.id, proxyNode]));
              return (proxyData.proxyNodes || []).map((proxyNode) => ({
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
            const importedIds = (proxyImportData.proxyNodes || []).map((proxyNode) => proxyNode.id);
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
                      site_rules: rule.site ? rule.site.split(',').map((value) => value.trim()).filter(Boolean) : [],
                      ip_rules: rule.ip ? rule.ip.split(',').map((value) => value.trim()).filter(Boolean) : [],
                      domain_suffix: rule.domain_suffix ? rule.domain_suffix.split(',').map((value) => value.trim()).filter(Boolean) : [],
                      domain_keyword: rule.domain_keyword ? rule.domain_keyword.split(',').map((value) => value.trim()).filter(Boolean) : [],
                      ip_cidr: rule.ip_cidr ? rule.ip_cidr.split(',').map((value) => value.trim()).filter(Boolean) : [],
                      protocol: rule.protocol ? rule.protocol.split(',').map((value) => value.trim()).filter(Boolean) : [],
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
            ...savedRuleSets.filter(Boolean).map((ruleSet) => ruleSet.id),
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
        surge: { type: 'surge' },
        shadowrocket: { type: 'shadowrocket' },
      });

      const newShortLinks = {};
      ['xray', 'singbox', 'clash', 'surge', 'shadowrocket'].forEach((type) => {
        newShortLinks[type] = `${window.location.origin}/api/${type}/${normalizedShortCode}`;
      });
      setShortLinks(newShortLinks);

      await syncSessionIndex(normalizedShortCode);
      setError(null);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const checkApiStatus = async () => {
    try {
      const response = await fetch('/api/sessions');
      setApiStatus(response.ok ? 'online' : 'offline');
    } catch (statusError) {
      console.warn('API status check failed:', statusError);
      setApiStatus('offline');
    }
  };

  // --- Initialization ---
  useEffect(() => {
    // Initialize with Chinese by default (matching original)
    setLanguage('zh-CN');
    setCurrentLang('zh-CN');

    // Load last used shortcode
    if (typeof window !== 'undefined') {
      const savedShortCode = localStorage.getItem('lastShortCode');
      if (savedShortCode) {
        setShortCodeInput(savedShortCode);
      }
    }

    loadManagedSessions();
    checkApiStatus();
    refreshProviderRuleSets();
    refreshProxyNodes();
  }, []);

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    setCurrentLang(lang);
  };

  const startNewConfig = () => {
    // Generate a new random shortcode
    const newShortCode = Math.random().toString(36).substring(2, 7);
    setShortCodeInput(newShortCode);

    // Clear existing state
    setAdvancedOptions(false);
    setSelectedRulePreset('custom');
    setSelectedRules([]);
    setConvertedConfigs(null);
    setError(null);
    setShortLinks({});
    setRemarks('');
    setConfigCreatedTime('');
    setCustomRules([]);
    setSubscriptions((currentSubscriptions) => currentSubscriptions.map(subscription => ({
      ...subscription,
      enabled: false,
    })));
    setSelectedProviderRuleSetIds([]);
    setSelectedProxyNodeIds([]);
    setProxyNodes((currentProxyNodes) => currentProxyNodes.map(proxyNode => ({
      ...proxyNode,
      enabled: false,
    })));

    // Set view to subscriptions
    setActiveView('subscriptions');

    return newShortCode;
  };

  const value = {
    // State
    standaloneProxies, setStandaloneProxies,
    advancedOptions, setAdvancedOptions,
    selectedRulePreset, setSelectedRulePreset,
    selectedRules, setSelectedRules,
    currentLang, setCurrentLang,
    convertedConfigs, setConvertedConfigs,
    isConverting, setIsConverting,
    error, setError,
    shortLinks, setShortLinks,
    isLoading, setIsLoading,
    shortCodeInput, setShortCodeInput,
    remarks, setRemarks,
    configCreatedTime, setConfigCreatedTime,
    customRules, setCustomRules,
    proxyEnabled, setProxyEnabled,
    proxyUrl, setProxyUrl,
    subscriptions, setSubscriptions,
    providerRuleSets, setProviderRuleSets,
    selectedProviderRuleSetIds, setSelectedProviderRuleSetIds,
    proxyNodes, setProxyNodes,
    selectedProxyNodeIds, setSelectedProxyNodeIds,
    managedSessions, setManagedSessions,
    sessionListError, setSessionListError,
    isLoadingSessions, setIsLoadingSessions,
    apiStatus,
    activeView, setActiveView,

    // Actions
    handleLanguageChange,
    startNewConfig,
    checkApiStatus,
    refreshProviderRuleSets,
    refreshProxyNodes,
    loadManagedSessions,
    syncSessionIndex,
    loadConfigByShortCode,
    deleteManagedSessionByShortCode,
    renameManagedSession
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
