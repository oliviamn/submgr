'use client';

import { useDashboard } from '../dashboard/DashboardContext';
import SubscriptionManager from '../SubscriptionManager';

export default function SubscriptionView() {
    const {
        shortCodeInput, setShortCodeInput,
        subscriptions, setSubscriptions,
        refreshProviderRuleSets
    } = useDashboard();

    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Subscription Management</h2>

                {/* Shortcode Warning */}
                {!shortCodeInput && (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-3 text-amber-800">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                        <span>Please generate or enter a shortcode in the Overview tab to save your subscriptions.</span>
                    </div>
                )}

                {/* Existing Component Integration */}
                {/* We pass the context values as props to reuse the existing logic */}
                <SubscriptionManager
                    shortCode={shortCodeInput}
                    subscriptions={subscriptions}
                    onSubscriptionsChange={setSubscriptions}
                    onProviderRuleSetsChange={refreshProviderRuleSets}
                />
            </div>

            {/* Help Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-sm text-gray-500">
                <h3 className="font-semibold text-gray-700 mb-2">How it works</h3>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Add subscription URLs from your service providers.</li>
                    <li>Toggle subscriptions on/off to include or exclude them from the final config.</li>
                    <li>The system automatically fetches and parses nodes from these links.</li>
                    <li>Proxies from enabled subscriptions will be available for rule-based routing.</li>
                </ul>
            </div>
        </div>
    );
}
