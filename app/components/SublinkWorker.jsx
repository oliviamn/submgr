'use client';

import { useState, useEffect } from 'react';
import { t, setLanguage, getCurrentLang } from '../lib/i18n';
import { SingboxConfigBuilder } from '../lib/SingboxConfigBuilder';
import { ClashConfigBuilder } from '../lib/ClashConfigBuilder';
import { SurgeConfigBuilder } from '../lib/SurgeConfigBuilder';

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
  const [inputValue, setInputValue] = useState('');
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

  const handleConvert = async () => {
    try {
      setIsConverting(true);
      setError(null);

      // Create config builders
      const userAgent = 'curl/7.74.0';
      const baseConfig = {};

      const builders = {
        xray: new SingboxConfigBuilder(inputValue, selectedRules, [], undefined, currentLang, userAgent),
        singbox: new SingboxConfigBuilder(inputValue, selectedRules, [], undefined, currentLang, userAgent),
        clash: new ClashConfigBuilder(inputValue, selectedRules, [], baseConfig, currentLang, userAgent),
        surge: new SurgeConfigBuilder(inputValue, selectedRules, [], baseConfig, currentLang, userAgent)
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

      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'raw',
          config: {
            inputValue,
            rules: {
              advancedOptions,
              selectedRules,
              selectedRulePreset
            },
            remarks,
            configCreatedTime: new Date().toISOString()
          },
          shortCode,
        })
      });

      for (const [type, builder] of Object.entries(builders)) {
        const config = await builder.build();
        configs[type] = config;

        // Save config to KV store
        try {
          const response = await fetch('/api/config', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type,
              config,
              shortCode
            })
          });
          const configId = `${type}_${shortCode}`;

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
      setError(err.message);
      console.error('Conversion error:', err);
    } finally {
      setIsConverting(false);
    }
  };

  const handleClear = () => {
    setInputValue('');
    setSelectedRules([]);
    setSelectedRulePreset('custom');
    setConvertedConfigs(null);
    setShortLinks({});
    setError(null);
    setShortCodeInput('');
    setRemarks('');
    setConfigCreatedTime('');
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
    console.log('Entered Loading config for shortcode:', shortCodeInput);
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
        throw new Error('Failed to load configuration');
      }

      const config = await response.json();
      if (config.type == 'raw') {
        console.log('Loaded config:', config);
      }
      setInputValue(config.inputValue);
      if (config.rules && config.rules.advancedOptions) {
        setAdvancedOptions(config.rules.advancedOptions);
        setSelectedRules(config.rules.selectedRules);
        setSelectedRulePreset(config.rules.selectedRulePreset);
      } else {
        setSelectedRules([]);
        setSelectedRulePreset('custom');
        setAdvancedOptions(false);
      }
      // Set remarks and configCreatedTime if they exist
      if (config.remarks) {
        setRemarks(config.remarks);
      }
      if (config.configCreatedTime) {
        setConfigCreatedTime(config.configCreatedTime);
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

      {/* Load Config Section - Updated styling to match */}
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
      <div className="bg-white rounded-lg p-6 shadow-lg">
        {/* Share Link Section */}
        <div className="mb-6">
          <h2 className="text-lg mb-2">{t('shareUrls')}</h2>
          <textarea
            className="w-full h-32 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder={t('urlPlaceholder')}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
        </div>

        {/* Remarks Input */}
        <div className="mb-6">
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
          <div className="mb-6 text-sm text-gray-600">
            {t('createdTime')}: {new Date(configCreatedTime).toLocaleString(currentLang)}
          </div>
        )}

        {/* Advanced Options */}
        <div className="mb-6 flex items-center">
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
          <div className="mb-6">
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
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleConvert}
            disabled={isConverting || !inputValue}
            className={`flex-1 bg-gradient-to-r from-purple-600 to-blue-500 text-white py-3 px-6 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 ${(isConverting || !inputValue) ? 'opacity-50 cursor-not-allowed' : ''
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
          <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
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