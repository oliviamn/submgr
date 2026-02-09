'use client';

import { useDashboard } from '../dashboard/DashboardContext';
import { t } from '../../lib/i18n';

export default function ProxyView() {
    const {
        standaloneProxies, setStandaloneProxies
    } = useDashboard();

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
                    console.log('[ProxyView] Auto-decoded base64 input');
                    setStandaloneProxies(decoded);
                    return;
                }
            } catch (e) {
                // Not valid base64, use as-is
            }
        }
        setStandaloneProxies(value);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Standalone Proxies</h2>
                <p className="text-gray-500 mb-6">Manually add proxy configurations (VMess, VLESS, Trojan, Shadowsocks, etc.).</p>

                <div className="flex-1 flex flex-col gap-4">
                    <textarea
                        className="flex-1 w-full min-h-[400px] p-4 bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm leading-relaxed transition-all"
                        placeholder="vmess://...&#10;vless://...&#10;ss://..."
                        value={standaloneProxies}
                        onChange={(e) => handleStandaloneProxiesChange(e.target.value)}
                    />

                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="16" y2="12" /><line x1="12" x2="12.01" y1="8" y2="8" /></svg>
                        </div>
                        <div>
                            <h4 className="font-semibold text-blue-900 mb-1">Smart Decode Enabled</h4>
                            <p className="text-sm text-blue-800 opacity-90">
                                If you paste a Base64 string here (like a raw subscription content), it will be automatically decoded into individual proxy lines.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
