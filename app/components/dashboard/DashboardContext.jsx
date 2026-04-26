'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { setLanguage, getCurrentLang } from '../../lib/i18n';

const DashboardContext = createContext();

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

  // --- Active View State ---
  const [activeView, setActiveView] = useState('overview'); // overview, subscriptions, proxies, rules, convert

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
    activeView, setActiveView,

    // Actions
    handleLanguageChange,
    startNewConfig,
    refreshProviderRuleSets,
    refreshProxyNodes
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
