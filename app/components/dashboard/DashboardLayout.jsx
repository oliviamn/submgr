'use client';

import { useState } from 'react';
import { useDashboard } from './DashboardContext';
import Sidebar from './Sidebar';
import { t } from '../../lib/i18n';

export default function DashboardLayout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { currentLang, handleLanguageChange, activeView } = useDashboard();

    // Get title based on active view
    const getTitle = () => {
        switch (activeView) {
            case 'overview': return 'Overview';
            case 'sessions': return 'Sessions';
            case 'subscriptions': return 'Subscriptions';
            case 'proxies': return 'Standalone Proxies';
            case 'rules': return 'Rules & Settings';
            case 'convert': return 'Convert & Export';
            default: return 'Dashboard';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">

                {/* Top Header */}
                <header className="bg-white border-b border-gray-200 h-16 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
                    <div className="flex items-center gap-4">
                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 -ml-2 text-gray-600 rounded-lg md:hidden hover:bg-gray-100"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>

                        <h1 className="text-xl font-semibold text-gray-800">
                            {getTitle()}
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Language Selector */}
                        <select
                            className="p-2 text-sm border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 focus:ring-2 focus:ring-purple-500 transition-colors cursor-pointer"
                            value={currentLang}
                            onChange={(e) => handleLanguageChange(e.target.value)}
                        >
                            <option value="en-US">English</option>
                            <option value="zh-CN">中文</option>
                        </select>

                        {/* Connection Status/Indicator (Mock) */}
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            Online
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
                    <div className="max-w-7xl mx-auto animate-fadeIn">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
