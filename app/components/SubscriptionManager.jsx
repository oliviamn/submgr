'use client';

import { useState, useEffect } from 'react';
import { t, getCurrentLang } from '../lib/i18n';

export default function SubscriptionManager({ 
  shortCode, 
  subscriptions, 
  onSubscriptionsChange,
  userAgent = 'curl/7.74.0'
}) {
  const [newSubUrl, setNewSubUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);
  const [loadingSubs, setLoadingSubs] = useState(false);

  // Load cached subscriptions on mount or when shortCode changes
  useEffect(() => {
    if (shortCode) {
      loadCachedSubscriptions();
    }
  }, [shortCode]);

  const loadCachedSubscriptions = async () => {
    if (!shortCode) return;
    
    setLoadingSubs(true);
    try {
      const response = await fetch(`/api/subscription?shortCode=${encodeURIComponent(shortCode)}`);
      const data = await response.json();
      
      if (data.success) {
        // Fetch full subscription data (with proxies) for each subscription
        const fullSubscriptions = await Promise.all(
          (data.subscriptions || []).map(async (sub) => {
            try {
              const fullSubResponse = await fetch(`/api/subscription/${encodeURIComponent(sub.subId)}`);
              if (fullSubResponse.ok) {
                const fullSubData = await fullSubResponse.json();
                return { ...sub, proxies: fullSubData.proxies || [], enabled: true };
              }
            } catch (e) {
              console.warn('Failed to load full subscription:', sub.subId);
            }
            return { ...sub, proxies: [], enabled: true };
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

    if (!shortCode) {
      setError('Please generate or enter a short code first');
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
          shortCode,
          userAgent
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
        proxies: proxies
      };

      onSubscriptionsChange([...subscriptions, newSub]);
      setNewSubUrl('');
    } catch (err) {
      setError(err.message);
      console.error('Fetch subscription error:', err);
    } finally {
      setIsFetching(false);
    }
  };

  const handleRefreshSubscription = async (sub) => {
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
          ? { ...s, proxyCount: data.proxyCount, fetchedAt: data.fetchedAt, name: data.name, proxies }
          : s
      );
      onSubscriptionsChange(updatedSubs);
    } catch (err) {
      setError(err.message);
      console.error('Refresh subscription error:', err);
    }
  };

  const handleDeleteSubscription = async (sub) => {
    try {
      const response = await fetch(`/api/subscription?subId=${encodeURIComponent(sub.subId)}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete subscription');
      }

      // Remove from the list
      onSubscriptionsChange(subscriptions.filter(s => s.subId !== sub.subId));
    } catch (err) {
      setError(err.message);
      console.error('Delete subscription error:', err);
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
        <div className="flex gap-2">
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
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          {t('subscriptionTip')}
        </p>
      </div>

      {/* Cached Subscriptions List */}
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
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => handleRefreshSubscription(sub)}
                  title="Refresh subscription"
                  className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteSubscription(sub)}
                  title="Delete cached subscription"
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
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
