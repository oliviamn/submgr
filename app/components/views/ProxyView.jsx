'use client';

import { useState } from 'react';
import { useDashboard } from '../dashboard/DashboardContext';
import ProxyNodeEditor from '../ProxyNodeEditor';

export default function ProxyView() {
    const {
        proxyNodes, setProxyNodes,
        selectedProxyNodeIds, setSelectedProxyNodeIds,
        refreshProxyNodes
    } = useDashboard();

    const [proxyInput, setProxyInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [editorState, setEditorState] = useState(null); // null | { proxyNode }

    // Auto-decode base64 if the input looks like base64
    const handleStandaloneProxiesChange = (value) => {
        // Check if input looks like base64 (long string with only base64 chars, no newlines, no ://)
        const isBase64Like = value.length > 50 &&
            /^[A-Za-z0-9+/=_-]+$/.test(value.trim()) &&
            !value.includes('://') &&
            !value.includes('\n');

        if (error) {
            setError(null);
        }

        if (isBase64Like) {
            try {
                // Try to decode
                const decoded = atob(value.trim());
                // If decoded content looks like proxy URLs, use it
                    if (decoded.includes('://') || decoded.includes('vmess://') || decoded.includes('ss://')) {
                        console.log('[ProxyView] Auto-decoded base64 input');
                        setProxyInput(decoded);
                        return;
                    }
                } catch (e) {
                // Not valid base64, use as-is
            }
        }
        setProxyInput(value);
    };

    const toggleProxyNode = (proxyNodeId) => {
        setSelectedProxyNodeIds((currentIds) => (
            currentIds.includes(proxyNodeId)
                ? currentIds.filter(id => id !== proxyNodeId)
                : [...currentIds, proxyNodeId]
        ));
    };

    const handleSaveProxyNodes = async () => {
        if (!proxyInput.trim()) {
            setError('Paste at least one proxy node first.');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const response = await fetch('/api/proxies', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: proxyInput,
                }),
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save proxy nodes');
            }

            const savedIds = (data.proxyNodes || []).map(proxyNode => proxyNode.id);
            await refreshProxyNodes();
            setSelectedProxyNodeIds((currentIds) => Array.from(new Set([...currentIds, ...savedIds])));
            setProxyInput('');
        } catch (saveError) {
            setError(saveError.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteProxyNode = async (proxyNodeId) => {
        if (typeof window !== 'undefined' && !window.confirm('Delete this proxy node?')) {
            return;
        }

        try {
            setError(null);
            const response = await fetch(`/api/proxies/${encodeURIComponent(proxyNodeId)}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete proxy node');
            }

            setSelectedProxyNodeIds((currentIds) => currentIds.filter(id => id !== proxyNodeId));
            await refreshProxyNodes();
        } catch (deleteError) {
            setError(deleteError.message);
        }
    };

    const handleCloneProxyNode = async (proxyNodeId) => {
        try {
            setError(null);
            const response = await fetch(`/api/proxies/${encodeURIComponent(proxyNodeId)}/clone`, {
                method: 'POST',
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || 'Failed to clone proxy node');
            }

            await refreshProxyNodes();
        } catch (cloneError) {
            setError(cloneError.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Standalone Proxy Library</h2>
                        <p className="text-gray-500">Paste standalone proxy links here, save them into the shared library, then select them into any session.</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleSaveProxyNodes}
                            disabled={isSaving || !proxyInput.trim()}
                            className="px-4 py-2 bg-blue-50 text-blue-700 font-medium rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="16" /><line x1="8" x2="16" y1="12" y2="12" /></svg>
                            {isSaving ? 'Saving...' : 'Save Standalone Proxies'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 px-4 py-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm">
                        {error}
                    </div>
                )}

                <div className="flex-1 flex flex-col gap-4">
                    <textarea
                        className="flex-1 w-full min-h-[400px] p-4 bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm leading-relaxed transition-all"
                        placeholder="Paste standalone proxies here...&#10;vmess://...&#10;vless://...&#10;ss://..."
                        value={proxyInput}
                        onChange={(e) => handleStandaloneProxiesChange(e.target.value)}
                    />

                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="16" y2="12" /><line x1="12" x2="12.01" y1="8" y2="8" /></svg>
                        </div>
                        <div>
                            <h4 className="font-semibold text-blue-900 mb-1">Paste, Save, Then Select</h4>
                            <p className="text-sm text-blue-800 opacity-90">
                                You can paste individual proxy URLs or a Base64-encoded proxy blob here. After saving, the parsed proxy nodes appear below and can be toggled into the current session.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Saved Proxy Nodes</h3>
                        <p className="text-sm text-gray-500 mt-1">Select the nodes this session should use.</p>
                    </div>
                    <button
                        type="button"
                        onClick={refreshProxyNodes}
                        className="px-4 py-2 bg-gray-50 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        Refresh
                    </button>
                    <button
                        type="button"
                        onClick={() => setEditorState({ proxyNode: null })}
                        className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Add Proxy
                    </button>
                </div>

                {proxyNodes.length === 0 ? (
                    <div className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-xl p-6">
                        No saved proxy nodes yet.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {proxyNodes.map((proxyNode) => (
                            <div key={proxyNode.id} className="flex items-center justify-between p-4 border rounded-xl">
                                <label className="flex items-center gap-3 flex-1 min-w-0">
                                    <input
                                        type="checkbox"
                                        checked={selectedProxyNodeIds.includes(proxyNode.id)}
                                        onChange={() => toggleProxyNode(proxyNode.id)}
                                        className="h-4 w-4 rounded border-gray-300"
                                    />
                                    <div className="min-w-0">
                                        <div className="font-semibold text-gray-800 truncate">{proxyNode.tag || proxyNode.id}</div>
                                        <div className="text-xs text-gray-500 truncate">
                                            {proxyNode.type} · {proxyNode.server}:{proxyNode.server_port}
                                        </div>
                                    </div>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setEditorState({ proxyNode })}
                                    className="ml-4 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleCloneProxyNode(proxyNode.id)}
                                    className="ml-4 px-3 py-2 text-sm text-teal-600 hover:bg-teal-50 rounded-lg"
                                >
                                    Clone
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteProxyNode(proxyNode.id)}
                                    className="ml-4 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                                >
                                    Delete
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {editorState && (
                <ProxyNodeEditor
                    proxyNode={editorState.proxyNode}
                    onClose={() => setEditorState(null)}
                    onSaved={async () => {
                        setEditorState(null);
                        await refreshProxyNodes();
                    }}
                />
            )}
        </div>
    );
}
