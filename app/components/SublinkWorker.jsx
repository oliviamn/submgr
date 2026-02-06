'use client';

import { useState, useEffect } from 'react';
import { t, setLanguage, getCurrentLang } from '../lib/i18n';
import { SingboxConfigBuilder } from '../lib/SingboxConfigBuilder';
import { ClashConfigBuilder } from '../lib/ClashConfigBuilder';
import { SurgeConfigBuilder } from '../lib/SurgeConfigBuilder';
import SubscriptionManager from './SubscriptionManager';

// Define the rule presets
const PREDEFINED_RULE_SETS = {
  minimal: ['Ad Block', 'Google'],
  balanced: ['AI Services', 'Youtube', 'Google', 'Private', 'Location:CN', 'Telegram', 'Github', 'Streaming', 'Non-China'],
  comprehensive: ['Ad Block', 'Google', 'Streaming', 'Social Media', 'Gaming', 'Cloud Services', 'Education', 'Financial', 'Non-China']
};

// Define available rules
const AVAILABLE_RULES = [
  'Ad Block',
  'AI Services',
  'Bilibili',
  'Youtube',
  'Google',
  'Private',
  'Location:CN',
  'Telegram',
  'Github',
  'Microsoft',
  'Apple',
  'Social Media',
  'Streaming',
  'Gaming',
  'Education',
  'Financial',
  'Cloud Services',
  'Non-China'
];

export default function SublinkWorker() {
  // State for standalone proxies (formerly inputValue)
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
  
  // New: Subscription management state
  const [subscriptions, setSubscriptions] = useState([]);

  // Auto-decode base64 if the input looks like base64
  const handleStandaloneProxiesChange = (value) => {
    // Check if input looks like base64 (long string with only base64 chars, no newlines, no ://)
    const isBase64Like = value.length > 50 && 
                         /^[A-Za-z0-9+/=_-]+$/.test(value.trim()) &&
                         !value.includes('://') &&
                         !value.includes('\n');
    
    if (isBase64Like) {
      try {
        // Try to decode
        const decoded = atob(value.trim());
        // If decoded content looks like proxy URLs, use it
        if (decoded.includes('://') || decoded.includes('vmess://') || decoded.includes('ss://')) {
          console.log('[SublinkWorker] Auto-decoded base64 input');
          setStandaloneProxies(decoded);
          return;
        }
      } catch (e) {
        // Not valid base64, use as-is
      }
    }
    setStandaloneProxies(value);
  };

  useEffect(() => {
    // Initialize with Chinese by default
    setLanguage('zh-CN');
    setCurrentLang('zh-CN');
    
    // Load last used shortcode from local storage
    const savedShortCode = localStorage.getItem('lastShortCode');
    if (savedShortCode) {
      setShortCodeInput(savedShortCode);
    }
  }, []);

  // Handle language change
  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    setCurrentLang(lang);
  };

  // Handle rule preset change
  const handleRulePresetChange = (preset) => {
    setSelectedRulePreset(preset);
    if (preset !== 'custom') {
      setSelectedRules(PREDEFINED_RULE_SETS[preset]);
    }
  };

  // Handle individual rule checkbox change
  const handleRuleCheckboxChange = (rule) => {
    setSelectedRulePreset('custom'); // Switch to custom when manually selecting rules
    setSelectedRules(prev => {
      if (prev.includes(rule)) {
        return prev.filter(r => r !== rule);
      } else {
        return [...prev, rule];
      }
    });
  };

  // Helper to get enabled subscription proxies
  const getEnabledSubscriptionProxies = () => {
    const enabledProxies = [];
    for (const sub of subscriptions) {
      if (sub.enabled && sub.proxies) {
        enabledProxies.push(...sub.proxies);
      }
    }
    return enabledProxies;
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

      const builders = {
        xray: new SingboxConfigBuilder(standaloneProxies, selectedRules, customRules, undefined, currentLang, userAgent, proxyEnabled, proxyUrl, enabledSubProxies),
        singbox: new SingboxConfigBuilder(standaloneProxies, selectedRules, customRules, undefined, currentLang, userAgent, proxyEnabled, proxyUrl, enabledSubProxies),
        clash: new ClashConfigBuilder(standaloneProxies, selectedRules, customRules, baseConfig, currentLang, userAgent, proxyEnabled, proxyUrl, enabledSubProxies),
        surge: new SurgeConfigBuilder(standaloneProxies, selectedRules, customRules, baseConfig, currentLang, userAgent, proxyEnabled, proxyUrl, enabledSubProxies)
      };

      // Generate a single shortcode for all types
      let shortCode = Math.random().toString(36).substring(2, 7);

      if (shortCodeInput && shortCodeInput.length > 0) {
        shortCode = shortCodeInput;
      }

      // Save shortcode to local storage
      localStorage.setItem('lastShortCode', shortCode);

      builders.surge.setSubscriptionUrl(`${window.location.origin}/api/surge/${shortCode}`)

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
              customRules,
              proxyEnabled,
              proxyUrl
            },
            remarks,
            configCreatedTime: new Date().toISOString(),
            version: '2.0'
          },
          subscriptionIds,
          standaloneProxies,
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
              standaloneProxies
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
      if (shortCode){
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

  const handleClear = () => {
    setStandaloneProxies('');
    setSelectedRules([]);
    setSelectedRulePreset('custom');
    setConvertedConfigs(null);
    setShortLinks({});
    setError(null);
    setShortCodeInput('');
    setRemarks('');
    setConfigCreatedTime('');
    setSubscriptions([]);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Add new function to load config
  const handleLoadConfig = async () => {
    console.log('Loading config for shortcode:', shortCodeInput);
    if (!shortCodeInput) {
      setError('Please enter a short code');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Save shortcode to local storage when loading config
      localStorage.setItem('lastShortCode', shortCodeInput);

      // Fetch the raw config using the short code
      const response = await fetch(`/api/raw/${shortCodeInput}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        let errorMsg = `Failed to load configuration (HTTP ${response.status})`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorData.details || errorMsg;
        } catch (e) {
          // Ignore JSON parse error
        }
        throw new Error(errorMsg);
      }

      const config = await response.json();
      console.log('Loaded config:', config);
      
      if (!config || typeof config !== 'object') {
        throw new Error('Invalid configuration format');
      }
      
      // Support both old format (direct) and new format (nested in config property)
      const configData = config.config || config;
      
      // Handle v2 format with subscriptionIds
      if (config.version === '2.0' || configData.version === '2.0') {
        // Load subscriptions
        if (config.subscriptionIds || configData.subscriptionIds) {
          const subIds = config.subscriptionIds || configData.subscriptionIds || [];
          // Load subscription details
          const subResponse = await fetch(`/api/subscription?shortCode=${shortCodeInput}`);
          const subData = await subResponse.json();
          if (subData.success) {
            // Mark enabled subscriptions based on stored IDs
            const loadedSubs = subData.subscriptions.map(s => ({
              ...s,
              enabled: subIds.includes(s.subId)
            }));
            setSubscriptions(loadedSubs);
          }
        }
        
        // Load standalone proxies
        setStandaloneProxies(config.standaloneProxies || configData.standaloneProxies || '');
      } else {
        // Legacy format: inputValue contains everything
        setStandaloneProxies(configData.inputValue || '');
        setSubscriptions([]);
      }
      
      setRemarks(configData.remarks || '');
      setConfigCreatedTime(configData.configCreatedTime || '');
      
      if (configData.rules && configData.rules.advancedOptions) {
        setAdvancedOptions(configData.rules.advancedOptions);
        setSelectedRules(configData.rules.selectedRules);
        setSelectedRulePreset(configData.rules.selectedRulePreset);
        if (configData.rules.customRules) {
          setCustomRules(configData.rules.customRules);
        } else {
          setCustomRules([]);
        }
        // Load proxy settings
        if (configData.rules.proxyEnabled !== undefined) {
          setProxyEnabled(configData.rules.proxyEnabled);
        }
        if (configData.rules.proxyUrl) {
          setProxyUrl(configData.rules.proxyUrl);
        }
      } else {
        setSelectedRules([]);
        setSelectedRulePreset('custom');
        setAdvancedOptions(false);
        setCustomRules([]);
        setProxyEnabled(false);
        setProxyUrl('');
      }

      // Set the short links for the loaded config
      const newShortLinks = {};
      const types = ['xray', 'singbox', 'clash', 'surge'];
      for (const type of types) {
        newShortLinks[type] = `${window.location.origin}/api/${type}/${shortCodeInput}`;
      }
      setShortLinks(newShortLinks);

      // Set a dummy convertedConfigs to trigger the display of links
      setConvertedConfigs({
        xray: { type: 'xray' },
        singbox: { type: 'singbox' },
        clash: { type: 'clash' },
        surge: { type: 'surge' }
      });

    } catch (err) {
      setError(err.message);
      console.error('Load config error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const addCustomRule = () => {
    setCustomRules([...customRules, {
      name: '',
      site: '',
      ip: '',
      domain_suffix: '',
      domain_keyword: '',
      ip_cidr: '',
      protocol: ''
    }]);
  };

  const removeCustomRule = (idx) => {
    setCustomRules(customRules.filter((_, i) => i !== idx));
  };

  const updateCustomRule = (idx, field, value) => {
    setCustomRules(customRules.map((rule, i) =>
      i === idx ? { ...rule, [field]: value } : rule
    ));
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-semibold text-center flex-grow bg-gradient-to-r from-purple-600 to-blue-500 text-white py-6 rounded-lg">
          {t('pageTitle')}
        </h1>
        <select
          className="ml-4 p-2 border rounded-lg"
          value={currentLang}
          onChange={(e) => handleLanguageChange(e.target.value)}
        >
          <option value="en-US">English</option>
          <option value="zh-CN">中文</option>
        </select>
      </div>

      {/* Load Config Section */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={t('loadConfigPlaceholder')}
            value={shortCodeInput}
            onChange={(e) => setShortCodeInput(e.target.value)}
            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={() => handleLoadConfig()}
            disabled={isLoading}
            className="px-4 py-2 bg-[#8B5CF6] text-white rounded-lg hover:bg-[#7C3AED] focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 min-w-[120px]"
          >
            {isLoading ? t('loading') : t('loadConfig')}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg p-6 shadow-lg space-y-6">
        
        {/* Subscription Management Section */}
        <SubscriptionManager
          shortCode={shortCodeInput}
          subscriptions={subscriptions}
          onSubscriptionsChange={setSubscriptions}
          userAgent="curl/7.74.0"
        />

        {/* Standalone Proxies Section */}
        <div className="border-t pt-6">
          <h2 className="text-lg mb-2 font-semibold">{t('standaloneProxies')}</h2>
          <textarea
            className="w-full h-32 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder={t('standaloneProxiesPlaceholder')}
            value={standaloneProxies}
            onChange={(e) => handleStandaloneProxiesChange(e.target.value)}
          />
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 {t('standaloneProxiesTip')}</strong>
            </p>
          </div>
        </div>

        {/* Remarks Input */}
        <div>
          <h2 className="text-lg mb-2">{t('remarks')}</h2>
          <textarea
            className="w-full h-20 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder={t('remarksPlaceholder')}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>

        {/* Created Time Display */}
        {configCreatedTime && (
          <div className="text-sm text-gray-600">
            {t('createdTime')}: {new Date(configCreatedTime).toLocaleString(currentLang)}
          </div>
        )}

        {/* Advanced Options Toggle */}
        <div className="flex items-center">
          <div className="flex items-center">
            <div
              className={`w-12 h-6 rounded-full p-1 cursor-pointer ${advancedOptions ? 'bg-purple-600' : 'bg-gray-300'
                }`}
              onClick={() => setAdvancedOptions(!advancedOptions)}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${advancedOptions ? 'translate-x-6' : ''
                  }`}
              />
            </div>
            <span className="ml-3 text-gray-700">{t('advancedOptions')}</span>
          </div>
        </div>

        {/* Advanced Options Content */}
        {advancedOptions && (
          <div className="space-y-6">
            <div className="form-section">
              <div className="form-section-title d-flex align-items-center">
                {t('ruleSelection')}
                <span className="tooltip-icon ms-2">
                  <i className="fas fa-question-circle"></i>
                  <span className="tooltip-content">
                    {t('ruleSelectionTooltip')}
                  </span>
                </span>
              </div>
              <div className="content-container mb-3">
                <select
                  className="form-select w-full p-2 border rounded-lg mb-4"
                  id="predefinedRules"
                  value={selectedRulePreset}
                  onChange={(e) => handleRulePresetChange(e.target.value)}
                >
                  <option value="custom">{t('custom')}</option>
                  <option value="minimal">{t('minimal')}</option>
                  <option value="balanced">{t('balanced')}</option>
                  <option value="comprehensive">{t('comprehensive')}</option>
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="ruleCheckboxes">
                {AVAILABLE_RULES.map((rule) => (
                  <div key={rule} className="flex items-center">
                    <input
                      type="checkbox"
                      id={rule}
                      checked={selectedRules.includes(rule)}
                      onChange={() => handleRuleCheckboxChange(rule)}
                      className="form-checkbox h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                    />
                    <label htmlFor={rule} className="ml-2 text-sm text-gray-700">
                      {t(`outboundNames.${rule}`)}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Proxy Settings */}
            <div className="form-section">
              <div className="form-section-title">
                <h3 className="text-md font-semibold mb-2">Proxy Settings</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="proxyEnabled"
                    checked={proxyEnabled}
                    onChange={(e) => setProxyEnabled(e.target.checked)}
                    className="h-4 w-4 text-purple-600 rounded"
                  />
                  <label htmlFor="proxyEnabled" className="text-sm font-medium">
                    Enable Proxy
                  </label>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="proxyUrl" className="block text-sm font-medium">
                    Proxy URL
                  </label>
                  <input
                    type="text"
                    id="proxyUrl"
                    value={proxyUrl}
                    onChange={(e) => setProxyUrl(e.target.value)}
                    placeholder="https://your-proxy-url.com/"
                    disabled={!proxyEnabled}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <p className="text-sm text-gray-500">
                    {proxyEnabled
                      ? 'Enter the proxy URL to use for rule set downloads'
                      : 'Enable proxy to configure the URL'}
                  </p>
                </div>
              </div>
            </div>

            {/* Custom Rules */}
            <div>
              <h3 className="text-md font-semibold mb-2">{t('addCustomRule')}</h3>
              {customRules.map((rule, idx) => (
                <div key={idx} className="mb-6 p-6 border rounded-xl bg-gray-50 relative">
                  <div className="mb-4">
                    <label className="block font-bold text-lg mb-1">{t('customRuleOutboundName')}*</label>
                    <input
                      className="w-full px-4 py-2 border rounded-lg text-lg font-semibold focus:ring-2 focus:ring-purple-400"
                      placeholder={t('customRuleOutboundName')}
                      value={rule.name}
                      onChange={e => updateCustomRule(idx, 'name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-gray-700 font-medium mb-1">{t('customRuleGeoSite')}</label>
                      <input
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder={t('customRuleGeoSitePlaceholder')}
                        value={rule.site}
                        onChange={e => updateCustomRule(idx, 'site', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-medium mb-1">{t('customRuleGeoIP')}</label>
                      <input
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder={t('customRuleGeoIPPlaceholder')}
                        value={rule.ip}
                        onChange={e => updateCustomRule(idx, 'ip', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-medium mb-1">{t('customRuleDomainSuffix')}</label>
                      <input
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder={t('customRuleDomainSuffixPlaceholder')}
                        value={rule.domain_suffix}
                        onChange={e => updateCustomRule(idx, 'domain_suffix', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-medium mb-1">{t('customRuleDomainKeyword')}</label>
                      <input
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder={t('customRuleDomainKeywordPlaceholder')}
                        value={rule.domain_keyword}
                        onChange={e => updateCustomRule(idx, 'domain_keyword', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-medium mb-1">{t('customRuleIPCIDR')}</label>
                      <input
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder={t('customRuleIPCIDRPlaceholder')}
                        value={rule.ip_cidr}
                        onChange={e => updateCustomRule(idx, 'ip_cidr', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-medium mb-1">{t('customRuleProtocol')}</label>
                      <input
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder={t('customRuleProtocolPlaceholder')}
                        value={rule.protocol}
                        onChange={e => updateCustomRule(idx, 'protocol', e.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="absolute top-4 right-4 text-red-500 font-semibold"
                    onClick={() => removeCustomRule(idx)}
                  >
                    {t('removeCustomRule')}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="mt-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-400 text-white rounded-lg shadow hover:opacity-90 transition"
                onClick={addCustomRule}
              >
                {t('addCustomRule')}
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4 border-t">
          <button
            onClick={handleConvert}
            disabled={isConverting || (subscriptions.filter(s => s.enabled).length === 0 && !standaloneProxies.trim())}
            className={`flex-1 bg-gradient-to-r from-purple-600 to-blue-500 text-white py-3 px-6 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 ${
              (isConverting || (subscriptions.filter(s => s.enabled).length === 0 && !standaloneProxies.trim())) 
                ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isConverting ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {t('convert')}
          </button>
          <button
            onClick={handleClear}
            className="px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="ml-2">{t('clear')}</span>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium">{typeof error === 'string' ? error : error.message || 'An error occurred'}</p>
            {error.steps && (
              <div className="mt-3">
                <p className="text-red-700 font-medium">{error.solution}:</p>
                <ol className="mt-2 text-red-600 list-decimal list-inside space-y-1">
                  {error.steps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Converted Results */}
        {convertedConfigs && (
          <div className="mt-8 space-y-6">
            {Object.entries(convertedConfigs).map(([type, config]) => (
              <div key={type} className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold capitalize">{type} Link:</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(shortLinks[type])}
                      className="p-2 text-purple-600 hover:text-purple-800"
                      title="Copy Link"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    </button>
                    <button
                      onClick={() => window.open(shortLinks[type], '_blank')}
                      className="p-2 text-purple-600 hover:text-purple-800"
                      title="Open Link"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  readOnly
                  value={shortLinks[type] || ''}
                  className="w-full p-2 bg-gray-50 rounded border focus:outline-none"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
