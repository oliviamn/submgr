'use client';

import { useDashboard } from '../dashboard/DashboardContext';
import { t } from '../../lib/i18n';

// Constants from original file
const PREDEFINED_RULE_SETS = {
    minimal: ['Ad Block', 'Google'],
    balanced: ['AI Services', 'Youtube', 'Google', 'Private', 'Location:CN', 'Telegram', 'Github', 'Streaming', 'Non-China'],
    comprehensive: ['Ad Block', 'Google', 'Streaming', 'Social Media', 'Gaming', 'Cloud Services', 'Education', 'Financial', 'Non-China']
};

const AVAILABLE_RULES = [
    'Ad Block', 'AI Services', 'Bilibili', 'Youtube', 'Google', 'Private', 'Location:CN',
    'Telegram', 'Github', 'Microsoft', 'Apple', 'AWS Services', 'Social Media', 'Streaming',
    'Gaming', 'Education', 'Financial', 'Cloud Services', 'Non-China'
];

export default function RulesView() {
    const {
        advancedOptions, setAdvancedOptions,
        selectedRulePreset, setSelectedRulePreset,
        selectedRules, setSelectedRules,
        customRules, setCustomRules,
        proxyEnabled, setProxyEnabled,
        proxyUrl, setProxyUrl
    } = useDashboard();

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

    const addCustomRule = () => {
        setCustomRules([...customRules, {
            name: '', site: '', ip: '', domain_suffix: '',
            domain_keyword: '', ip_cidr: '', protocol: ''
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
        <div className="space-y-6">

            {/* Preset Selection */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Routing Rules</h2>

                <div className="mb-8">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rule Preset</label>
                    <div className="relative">
                        <select
                            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium text-gray-700"
                            value={selectedRulePreset}
                            onChange={(e) => handleRulePresetChange(e.target.value)}
                        >
                            <option value="custom">Custom Configuration</option>
                            <option value="minimal">Minimal (AdBlock + Google)</option>
                            <option value="balanced">Balanced (Recommended)</option>
                            <option value="comprehensive">Comprehensive (All Categories)</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                        </div>
                    </div>
                </div>

                {/* Rule Checkboxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {AVAILABLE_RULES.map((rule) => {
                        const checked = selectedRules.includes(rule);
                        return (
                            <label
                                key={rule}
                                className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all select-none ${checked
                                    ? 'bg-purple-50 border-purple-200 shadow-sm'
                                    : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200'
                                    }`}
                            >
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => handleRuleCheckboxChange(rule)}
                                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 transition-all checked:border-purple-600 checked:bg-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-1"
                                    />
                                    <svg className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform text-white opacity-0 transition-opacity peer-checked:opacity-100 w-3.5 h-3.5" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M1 5L4.5 8.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                                <span className={`ml-3 text-sm font-medium ${checked ? 'text-purple-900' : 'text-gray-600'}`}>
                                    {t(`outboundNames.${rule}`) || rule}
                                </span>
                            </label>
                        );
                    })}
                </div>
            </div>

            {/* Advanced Proxy Settings */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-800">Advanced Proxy Settings</h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={proxyEnabled}
                            onChange={(e) => setProxyEnabled(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        <span className="ml-3 text-sm font-medium text-gray-700">Enable Proxy for Updates</span>
                    </label>
                </div>

                <div className={`transition-all duration-300 ${proxyEnabled ? 'opacity-100 max-h-40' : 'opacity-50 max-h-40 pointer-events-none grayscale'}`}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Proxy URL</label>
                    <input
                        type="text"
                        value={proxyUrl}
                        onChange={(e) => setProxyUrl(e.target.value)}
                        placeholder="https://your-proxy-url.com/"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    />
                    <p className="mt-2 text-sm text-gray-500">
                        Used when fetching rule sets (GeoIP, GeoSite) during conversion.
                    </p>
                </div>
            </div>

            {/* Custom Rules */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-800">Custom Rules</h3>
                    <button
                        type="button"
                        onClick={addCustomRule}
                        className="px-4 py-2 bg-purple-50 text-purple-700 font-medium rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="16" /><line x1="8" x2="16" y1="12" y2="12" /></svg>
                        Add Rule
                    </button>
                </div>

                <div className="space-y-4">
                    {customRules.map((rule, idx) => (
                        <div key={idx} className="p-6 border border-gray-200 rounded-xl bg-gray-50/50 hover:bg-white hover:shadow-md transition-all relative group">
                            <button
                                type="button"
                                onClick={() => removeCustomRule(idx)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors bg-white rounded-full p-1 shadow-sm border border-gray-100 opacity-0 group-hover:opacity-100"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="col-span-1 md:col-span-2 lg:col-span-3 mb-2">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Outbound Name (Tag) *</label>
                                    <input
                                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-lg font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        placeholder="e.g. My Custom Proxy"
                                        value={rule.name}
                                        onChange={e => updateCustomRule(idx, 'name', e.target.value)}
                                    />
                                </div>

                                {['site', 'ip', 'domain_suffix', 'domain_keyword', 'ip_cidr', 'protocol'].map((field) => (
                                    <div key={field}>
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                                            {t(`customRule${field.replace('ip', 'IP').replace('cidr', 'CIDR').replace(/_([a-z])/g, (g) => g[1].toUpperCase()).replace(/^([a-z])/, (g) => g.toUpperCase())}`) || field.replace('_', ' ')}
                                        </label>
                                        <input
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            value={rule[field]}
                                            onChange={e => updateCustomRule(idx, field, e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {customRules.length === 0 && (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                            <p className="text-gray-500">No custom rules defined yet.</p>
                            <button onClick={addCustomRule} className="mt-2 text-purple-600 hover:text-purple-700 font-medium">Add your first rule</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
