'use client';

import { useDashboard } from '../dashboard/DashboardContext';
import SubscriptionManager from '../SubscriptionManager';

export default function SubscriptionView() {
    const {
        subscriptions, setSubscriptions,
        refreshProviderRuleSets
    } = useDashboard();

    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Subscription Management</h2>

                {/* Existing Component Integration */}
                <SubscriptionManager
                    subscriptions={subscriptions}
                    onSubscriptionsChange={setSubscriptions}
                    onProviderRuleSetsChange={refreshProviderRuleSets}
                />
            </div>

            {/* Help Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-sm text-gray-500">
                <h3 className="font-semibold text-gray-700 mb-2">How it works</h3>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Add subscription URLs into the global subscription library.</li>
                    <li>Toggle subscriptions on/off to include or exclude them from the current session.</li>
                    <li>The system reuses saved subscriptions across sessions and shortcodes.</li>
                    <li>Proxies from enabled subscriptions will be available for rule-based routing.</li>
                </ul>
            </div>
        </div>
    );
}
