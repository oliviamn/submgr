'use client';

import { DashboardProvider, useDashboard } from './DashboardContext';
import DashboardLayout from './DashboardLayout';
import Overview from '../views/Overview';
import SubscriptionView from '../views/SubscriptionView';
import ProxyView from '../views/ProxyView';
import RulesView from '../views/RulesView';
import ConverterView from '../views/ConverterView';

function DashboardContent() {
    const { activeView } = useDashboard();

    const renderView = () => {
        switch (activeView) {
            case 'overview':
                return <Overview />;
            case 'subscriptions':
                return <SubscriptionView />;
            case 'proxies':
                return <ProxyView />;
            case 'rules':
                return <RulesView />;
            case 'convert':
                return <ConverterView />;
            default:
                return <Overview />;
        }
    };

    return (
        <>
            {renderView()}
        </>
    );
}

export default function DashboardApp() {
    return (
        <DashboardProvider>
            <DashboardLayout>
                <DashboardContent />
            </DashboardLayout>
        </DashboardProvider>
    );
}
