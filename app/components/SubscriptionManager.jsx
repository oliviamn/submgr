'use client';

import { useState, useEffect } from 'react';
import { t, getCurrentLang } from '../lib/i18n';

export default function SubscriptionManager({
  subscriptions,
  onSubscriptionsChange,
  onProviderRuleSetsChange,
  userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
}) {
  const [newSubUrl, setNewSubUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);
  const [loadingSubs, setLoadingSubs] = useState(false);

  const [fetchProxyUrl, setFetchProxyUrl] = useState('');
  const [fetchUserAgent, setFetchUserAgent] = useState(userAgent);
  const [showFetchSettings, setShowFetchSettings] = useState(false);
  const [refreshingSubId, setRefreshingSubId] = useState(null);
  const [deletingSubId, setDeletingSubId] = useState(null);

  // Load globally managed subscriptions on mount
  useEffect(() => {
    loadManagedSubscriptions();
  }, []);

  const loadManagedSubscriptions = async () => {
    setLoadingSubs(true);
    try {
      const response = await fetch('/api/subscription');
      const data = await response.json();

      if (data.success) {
        const fullSubscriptions = await Promise.all(
          (data.subscriptions || []).map(async (sub) => {
            const existingSub = subscriptions.find(item => item.subId === sub.subId);
            try {
              const fullSubResponse = await fetch(`/api/subscription/${encodeURIComponent(sub.subId)}`);
              if (fullSubResponse.ok) {
                const fullSubData = await fullSubResponse.json();
                return {
                  ...sub,
                  proxies: fullSubData.proxies || [],
                  enabled: existingSub?.enabled || false,
                  providerRuleSetIds: fullSubData.providerRuleSetIds || [],
                  providerRuleSetNames: fullSubData.providerRuleSetNames || [],
                  providerRuleSetCount: fullSubData.providerRuleSetCount || 0,
                  providerName: fullSubData.providerName,
                };
              }
            } catch (e) {
              console.warn('Failed to load full subscription:', sub.subId);
            }
            return { ...sub, proxies: [], enabled: existingSub?.enabled || false };
          })
        );
        onSubscriptionsChange(fullSubscriptions);
      }
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
    } finally {
      setLoadingSubs(false);
    }
  };

  const handleFetchSubscription = async () => {
    if (!newSubUrl.trim()) {
      setError('Please enter a subscription URL');
      return;
    }

    setIsFetching(true);
    setError(null);

    try {
      const response = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newSubUrl.trim(),
          userAgent: fetchUserAgent,
          proxyUrl: fetchProxyUrl || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to fetch subscription');
      }

      // Fetch the full subscription data including proxies
      const fullSubResponse = await fetch(`/api/subscription/${encodeURIComponent(data.subId)}`);
      let proxies = [];
      if (fullSubResponse.ok) {
        const fullSubData = await fullSubResponse.json();
        proxies = fullSubData.proxies || [];
      }

      // Add new subscription to the list with proxies
      const newSub = {
        subId: data.subId,
        url: data.url,
        proxyCount: data.proxyCount,
        fetchedAt: data.fetchedAt,
        name: data.name,
        enabled: true,
        proxies: proxies,
        providerRuleSetCount: data.providerRuleSetCount || 0,
        providerRuleSetNames: data.providerRuleSetNames || [],
      };

      onSubscriptionsChange([
        ...subscriptions.filter(sub => sub.subId !== newSub.subId),
        newSub,
      ]);
      await onProviderRuleSetsChange?.();
      setNewSubUrl('');
    } catch (err) {
      setError(err.message);
      console.error('Fetch subscription error:', err);
    } finally {
      setIsFetching(false);
    }
  };

  const handleRefreshSubscription = async (sub) => {
    setRefreshingSubId(sub.subId);
    try {
      const response = await fetch(`/api/subscription/${encodeURIComponent(sub.subId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAgent })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh subscription');
      }

      // Fetch the updated full subscription data
      const fullSubResponse = await fetch(`/api/subscription/${encodeURIComponent(data.subId)}`);
      let proxies = [];
      if (fullSubResponse.ok) {
        const fullSubData = await fullSubResponse.json();
        proxies = fullSubData.proxies || [];
      }

      // Update the subscription in the list
      const updatedSubs = subscriptions.map(s =>
        s.subId === data.subId
          ? {
              ...s,
              proxyCount: data.proxyCount,
              fetchedAt: data.fetchedAt,
              name: data.name,
              proxies,
              providerRuleSetCount: data.providerRuleSetCount || 0,
              providerRuleSetNames: data.providerRuleSetNames || [],
            }
          : s
      );
      onSubscriptionsChange(updatedSubs);
      await onProviderRuleSetsChange?.();
    } catch (err) {
      setError(err.message);
      console.error('Refresh subscription error:', err);
    } finally {
      setRefreshingSubId(null);
    }
  };

  const handleDeleteSubscription = async (sub) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete subscription "${sub.name || sub.subId}"?`)) {
      return;
    }

    setDeletingSubId(sub.subId);
    try {
      const response = await fetch(`/api/subscription?subId=${encodeURIComponent(sub.subId)}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete subscription');
      }

      onSubscriptionsChange(subscriptions.filter(s => s.subId !== sub.subId));
    } catch (err) {
      setError(err.message);
      console.error('Delete subscription error:', err);
    } finally {
      setDeletingSubId(null);
    }
  };

  const toggleSubscription = (subId) => {
    const updatedSubs = subscriptions.map(s =>
      s.subId === subId ? { ...s, enabled: !s.enabled } : s
    );
    onSubscriptionsChange(updatedSubs);
  };

  const formatTimeAgo = (dateString) => {
    const lang = getCurrentLang();
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (lang === 'zh-CN') {
      if (diffMins < 1) return '刚刚';
      if (diffMins < 60) return `${diffMins} 分钟前`;
      if (diffHours < 24) return `${diffHours} 小时前`;
      return `${diffDays} 天前`;
    } else {
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      if (diffHours < 24) return `${diffHours} hour ago`;
      return `${diffDays} day ago`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Add New Subscription */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-md font-semibold mb-3">{t('subscriptionManagement')}</h3>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder={t('subscriptionUrl') + ' (https://...)'}
            value={newSubUrl}
            onChange={(e) => setNewSubUrl(e.target.value)}
            disabled={isFetching}
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
          />
          <button
            onClick={handleFetchSubscription}
            disabled={isFetching || !newSubUrl.trim()}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isFetching ? t('fetching') : t('fetchAndCache')}
          </button>
        </div>

        {/* Advanced Fetch Settings Toggle */}
        <div className="mb-2">
          <button
            onClick={() => setShowFetchSettings(!showFetchSettings)}
            className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1 font-medium"
          >
            {showFetchSettings ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showFetchSettings ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6" /></svg>
          </button>
        </div>

        {showFetchSettings && (
          <div className="space-y-3 p-3 bg-white rounded-lg border border-purple-100 mb-3 animate-fadeIn">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">User-Agent</label>
              <input
                type="text"
                value={fetchUserAgent}
                onChange={(e) => setFetchUserAgent(e.target.value)}
                className="w-full text-xs p-2 border border-gray-200 rounded focus:border-purple-300 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Proxy URL (Optional)</label>
              <input
                type="text"
                placeholder="https://your-worker-proxy.workers.dev/"
                value={fetchProxyUrl}
                onChange={(e) => setFetchProxyUrl(e.target.value)}
                className="w-full text-xs p-2 border border-gray-200 rounded focus:border-purple-300 focus:outline-none"
              />
              <p className="text-[10px] text-gray-400 mt-1">Leave empty to use default proxy. Set to "Direct" to force direct connection.</p>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          {t('subscriptionTip')}
        </p>
      </div>

      {/* Managed Subscriptions List */}
      {subscriptions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">{t('cachedSubscriptions')}:</h4>
          {subscriptions.map((sub) => (
            <div
              key={sub.subId}
              className={`flex items-center justify-between p-3 border rounded-lg ${sub.enabled ? 'bg-white' : 'bg-gray-50 opacity-60'}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={sub.enabled}
                  onChange={() => toggleSubscription(sub.subId)}
                  className="h-4 w-4 text-purple-600 rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={sub.url}>
                    {sub.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {sub.proxyCount} {t('nodesCount')} · {formatTimeAgo(sub.fetchedAt)}
                  </p>
                  {sub.providerRuleSetCount > 0 && (
                    <p className="text-xs text-purple-600">
                      {sub.providerRuleSetCount} provider rule set{sub.providerRuleSetCount > 1 ? 's' : ''}: {(sub.providerRuleSetNames || []).join(', ')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => handleRefreshSubscription(sub)}
                  disabled={refreshingSubId === sub.subId || deletingSubId === sub.subId}
                  title="Refresh subscription"
                  className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className={`w-4 h-4 ${refreshingSubId === sub.subId ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteSubscription(sub)}
                  disabled={refreshingSubId === sub.subId || deletingSubId === sub.subId}
                  title="Delete cached subscription"
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingSubId === sub.subId ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {loadingSubs && subscriptions.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          <svg className="animate-spin h-5 w-5 mx-auto mb-2" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm">{t('loading')}...</span>
        </div>
      )}
    </div>
  );
}
