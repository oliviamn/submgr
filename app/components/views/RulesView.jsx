'use client';

import { useState } from 'react';
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

const RULE_SET_FIELDS = ['site', 'ip', 'domain_suffix', 'domain_keyword', 'ip_cidr', 'protocol'];

const EMPTY_RULE_SET_DRAFT = {
    name: '',
    site: '',
    ip: '',
    domain_suffix: '',
    domain_keyword: '',
    ip_cidr: '',
    protocol: '',
};

const splitRuleValues = (value) => (
    value ? value.split(',').map(item => item.trim()).filter(Boolean) : []
);

const draftToRuleSetPayload = (draft) => ({
    name: draft.name.trim(),
    displayName: draft.name.trim(),
    rules: {
        site_rules: splitRuleValues(draft.site),
        ip_rules: splitRuleValues(draft.ip),
        domain_suffix: splitRuleValues(draft.domain_suffix),
        domain_keyword: splitRuleValues(draft.domain_keyword),
        ip_cidr: splitRuleValues(draft.ip_cidr),
        protocol: splitRuleValues(draft.protocol),
    },
});

const ruleSetToDraft = (ruleSet) => ({
    name: ruleSet.name || '',
    site: (ruleSet.rules?.site_rules || []).join(', '),
    ip: (ruleSet.rules?.ip_rules || []).join(', '),
    domain_suffix: (ruleSet.rules?.domain_suffix || []).join(', '),
    domain_keyword: (ruleSet.rules?.domain_keyword || []).join(', '),
    ip_cidr: (ruleSet.rules?.ip_cidr || []).join(', '),
    protocol: (ruleSet.rules?.protocol || []).join(', '),
});

const ruleFieldLabel = (field) => (
    t(`customRule${field.replace('ip', 'IP').replace('cidr', 'CIDR').replace(/_([a-z])/g, (g) => g[1].toUpperCase()).replace(/^([a-z])/, (g) => g.toUpperCase())}`) || field.replace('_', ' ')
);

export default function RulesView() {
    const {
        advancedOptions, setAdvancedOptions,
        selectedRulePreset, setSelectedRulePreset,
        selectedRules, setSelectedRules,
        customRules, setCustomRules,
        proxyEnabled, setProxyEnabled,
        proxyUrl, setProxyUrl,
        providerRuleSets,
        selectedProviderRuleSetIds,
        setSelectedProviderRuleSetIds,
        refreshProviderRuleSets
    } = useDashboard();
    const [draftRuleSet, setDraftRuleSet] = useState(EMPTY_RULE_SET_DRAFT);
    const [isSavingRuleSet, setIsSavingRuleSet] = useState(false);
    const [ruleSetError, setRuleSetError] = useState(null);
    const [editingRuleSetId, setEditingRuleSetId] = useState(null);
    const [editDraftRuleSet, setEditDraftRuleSet] = useState(null);
    const [isSavingEdit, setIsSavingEdit] = useState(false);

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

    const updateDraftRuleSet = (field, value) => {
        setDraftRuleSet((currentRuleSet) => ({
            ...currentRuleSet,
            [field]: value,
        }));
    };

    const toggleProviderRuleSet = (ruleSetId) => {
        setSelectedProviderRuleSetIds((currentIds) => (
            currentIds.includes(ruleSetId)
                ? currentIds.filter(id => id !== ruleSetId)
                : [...currentIds, ruleSetId]
        ));
    };

    const formatUpdatedAt = (updatedAt) => {
        if (!updatedAt) {
            return 'Unknown update time';
        }

        return new Date(updatedAt).toLocaleString();
    };

    const saveDraftRuleSet = async () => {
        if (!draftRuleSet.name.trim()) {
            return;
        }

        setIsSavingRuleSet(true);
        try {
            const response = await fetch('/api/rulesets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ruleSet: {
                        ...draftToRuleSetPayload(draftRuleSet),
                        outbound: draftRuleSet.name.trim(),
                        source: {
                            kind: 'manual',
                            providerName: 'Custom',
                        },
                    },
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to save rule set');
            }

            await refreshProviderRuleSets();
            setSelectedProviderRuleSetIds((currentIds) => Array.from(new Set([...currentIds, data.ruleSet.id])));
            setDraftRuleSet(EMPTY_RULE_SET_DRAFT);
        } finally {
            setIsSavingRuleSet(false);
        }
    };

    const startEditingRuleSet = (ruleSet) => {
        setRuleSetError(null);
        setEditingRuleSetId(ruleSet.id);
        setEditDraftRuleSet(ruleSetToDraft(ruleSet));
    };

    const cancelEditingRuleSet = () => {
        setEditingRuleSetId(null);
        setEditDraftRuleSet(null);
    };

    const updateEditDraftRuleSet = (field, value) => {
        setEditDraftRuleSet((currentRuleSet) => ({
            ...currentRuleSet,
            [field]: value,
        }));
    };

    const saveEditedRuleSet = async () => {
        if (!editingRuleSetId || !editDraftRuleSet?.name.trim()) {
            return;
        }

        setIsSavingEdit(true);
        setRuleSetError(null);
        try {
            const response = await fetch(`/api/rulesets/${encodeURIComponent(editingRuleSetId)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ruleSet: draftToRuleSetPayload(editDraftRuleSet),
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to update rule set');
            }

            await refreshProviderRuleSets();
            cancelEditingRuleSet();
        } catch (saveError) {
            setRuleSetError(saveError.message);
        } finally {
            setIsSavingEdit(false);
        }
    };

    const deleteRuleSet = async (ruleSet) => {
        if (typeof window !== 'undefined' && !window.confirm(`Delete rule set "${ruleSet.name || ruleSet.id}"?`)) {
            return;
        }

        try {
            setRuleSetError(null);
            const response = await fetch(`/api/rulesets/${encodeURIComponent(ruleSet.id)}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete rule set');
            }

            setSelectedProviderRuleSetIds((currentIds) => currentIds.filter(id => id !== ruleSet.id));
            if (editingRuleSetId === ruleSet.id) {
                cancelEditingRuleSet();
            }
            await refreshProviderRuleSets();
        } catch (deleteError) {
            setRuleSetError(deleteError.message);
        }
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

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Provider Rule Sets</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Persisted rule sets extracted from your subscriptions and reusable across sessions.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={refreshProviderRuleSets}
                        className="px-4 py-2 bg-gray-50 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        Refresh
                    </button>
                </div>

                {ruleSetError && (
                    <div className="mb-4 px-4 py-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm">
                        {ruleSetError}
                    </div>
                )}

                {providerRuleSets.length === 0 ? (
                    <div className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-xl p-6">
                        No saved provider rule sets yet. Add or refresh a subscription to extract them.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {providerRuleSets.map((ruleSet) => {
                            const checked = selectedProviderRuleSetIds.includes(ruleSet.id);
                            const isEditing = editingRuleSetId === ruleSet.id;

                            if (isEditing && editDraftRuleSet) {
                                return (
                                    <div
                                        key={ruleSet.id}
                                        className="p-4 rounded-xl border border-indigo-200 bg-indigo-50 shadow-sm"
                                    >
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Name *</label>
                                                <input
                                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    value={editDraftRuleSet.name}
                                                    onChange={e => updateEditDraftRuleSet('name', e.target.value)}
                                                />
                                            </div>
                                            {RULE_SET_FIELDS.map((field) => (
                                                <div key={field}>
                                                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                                                        {ruleFieldLabel(field)}
                                                    </label>
                                                    <input
                                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                        value={editDraftRuleSet[field]}
                                                        onChange={e => updateEditDraftRuleSet(field, e.target.value)}
                                                    />
                                                </div>
                                            ))}
                                            <div className="flex justify-end gap-2 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={cancelEditingRuleSet}
                                                    className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={saveEditedRuleSet}
                                                    disabled={isSavingEdit || !editDraftRuleSet.name.trim()}
                                                    className="px-3 py-2 text-sm bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                                                >
                                                    {isSavingEdit ? 'Saving...' : 'Save'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <label
                                    key={ruleSet.id}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all ${checked
                                        ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                        : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleProviderRuleSet(ruleSet.id)}
                                            className="mt-1 h-5 w-5 cursor-pointer rounded-md border border-gray-300"
                                        />
                                        <div className="min-w-0">
                                            <div className="font-semibold text-gray-800">{ruleSet.name}</div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                Source: {ruleSet.source?.providerName || 'Provider'} {ruleSet.source?.kind === 'manual' ? '· Manual' : ''}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                Updated: {formatUpdatedAt(ruleSet.updatedAt)}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-2">
                                                Domains {ruleSet.rules?.domain_suffix?.length || 0} · Keywords {ruleSet.rules?.domain_keyword?.length || 0} · CIDRs {ruleSet.rules?.ip_cidr?.length || 0}
                                            </div>
                                        </div>
                                        <div className="ml-4 flex items-center">
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    startEditingRuleSet(ruleSet);
                                                }}
                                                className="text-sm text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    deleteRuleSet(ruleSet);
                                                }}
                                                className="text-sm text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                )}
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

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-800">Manual Rule Set Library</h3>
                    <button
                        type="button"
                        onClick={saveDraftRuleSet}
                        disabled={isSavingRuleSet || !draftRuleSet.name.trim()}
                        className="px-4 py-2 bg-purple-50 text-purple-700 font-medium rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="16" /><line x1="8" x2="16" y1="12" y2="12" /></svg>
                        {isSavingRuleSet ? 'Saving...' : 'Save Rule Set'}
                    </button>
                </div>

                <div className="p-6 border border-gray-200 rounded-xl bg-gray-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="col-span-1 md:col-span-2 lg:col-span-3 mb-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Outbound Name (Tag) *</label>
                            <input
                                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-lg font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="e.g. My Custom Proxy"
                                value={draftRuleSet.name}
                                onChange={e => updateDraftRuleSet('name', e.target.value)}
                            />
                        </div>

                        {RULE_SET_FIELDS.map((field) => (
                            <div key={field}>
                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                                    {ruleFieldLabel(field)}
                                </label>
                                <input
                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    value={draftRuleSet[field]}
                                    onChange={e => updateDraftRuleSet(field, e.target.value)}
                                />
                            </div>
                        ))}
                    </div>

                    {customRules.length > 0 && (
                        <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
                            This session contains legacy embedded custom rules. They still work, but newly created rules should be saved into the shared library above.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
