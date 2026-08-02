'use client';

import { useMemo, useState } from 'react';
import { useDashboard } from '../dashboard/DashboardContext';

export default function SessionsView() {
    const {
        sessionAdminKey, setSessionAdminKey,
        managedSessions,
        sessionListError, setSessionListError,
        isLoadingSessions,
        isLoading,
        shortCodeInput,
        loadManagedSessions,
        loadConfigByShortCode,
        renameManagedSession,
        deleteManagedSessionByShortCode,
        setActiveView,
    } = useDashboard();

    const [searchQuery, setSearchQuery] = useState('');
    const [editingShortCode, setEditingShortCode] = useState(null);
    const [editingRemarks, setEditingRemarks] = useState('');

    const filteredSessions = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) {
            return managedSessions;
        }

        return managedSessions.filter((session) => (
            session.shortCode?.toLowerCase().includes(query)
            || session.title?.toLowerCase().includes(query)
            || session.remarks?.toLowerCase().includes(query)
        ));
    }, [managedSessions, searchQuery]);

    const handleLoadSession = async (shortCode) => {
        const loaded = await loadConfigByShortCode(shortCode);
        if (loaded) {
            setActiveView('overview');
        }
    };

    const handleStartRename = (session) => {
        setEditingShortCode(session.shortCode);
        setEditingRemarks(session.remarks || session.title || '');
        setSessionListError(null);
    };

    const handleSaveRename = async (shortCode) => {
        try {
            await renameManagedSession(shortCode, editingRemarks);
            setEditingShortCode(null);
            setEditingRemarks('');
        } catch (error) {
            setSessionListError(error.message);
        }
    };

    const handleDeleteSession = async (shortCode) => {
        if (typeof window !== 'undefined' && !window.confirm(`Delete saved session ${shortCode}?`)) {
            return;
        }

        try {
            await deleteManagedSessionByShortCode(shortCode);
        } catch (error) {
            setSessionListError(error.message);
        }
    };

    const formatSessionTimestamp = (value) => {
        if (!value) {
            return 'Unknown';
        }

        try {
            return new Date(value).toLocaleString();
        } catch (error) {
            return value;
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <h2 className="text-2xl font-bold text-gray-800">Saved Sessions</h2>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Protected</span>
                        </div>
                        <p className="text-gray-500 max-w-2xl">
                            Unlock the protected session library to browse, rename, search, load, and delete saved sessions.
                        </p>
                    </div>

                    <div className="w-full lg:max-w-xl space-y-3">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="password"
                                placeholder="Admin key"
                                value={sessionAdminKey}
                                onChange={(e) => {
                                    setSessionAdminKey(e.target.value);
                                    setSessionListError(null);
                                }}
                                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                            />
                            <button
                                onClick={() => loadManagedSessions()}
                                disabled={isLoadingSessions}
                                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
                            >
                                {isLoadingSessions ? 'Unlocking...' : 'Unlock Sessions'}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                            {shortCodeInput && (
                                <span className="px-2 py-1 rounded-full bg-gray-100 border border-gray-200">
                                    Current short code: <span className="font-mono">{shortCodeInput}</span>
                                </span>
                            )}
                            <span className="px-2 py-1 rounded-full bg-gray-100 border border-gray-200">
                                {managedSessions.length} indexed sessions
                            </span>
                        </div>
                    </div>
                </div>

                {sessionListError && (
                    <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                        {sessionListError}
                    </div>
                )}
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Session Library</h3>
                        <p className="text-sm text-gray-500 mt-1">Search by session name, description, or short code.</p>
                    </div>
                    <input
                        type="text"
                        placeholder="Search sessions"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full md:w-72 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    />
                </div>

                {managedSessions.length === 0 ? (
                    <div className="p-6 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500">
                        Unlock the session library to see saved sessions. Older shortcode-only sessions are added here automatically after you load them once.
                    </div>
                ) : filteredSessions.length === 0 ? (
                    <div className="p-6 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500">
                        No sessions match your search.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredSessions.map((session) => {
                            const isEditing = editingShortCode === session.shortCode;

                            return (
                                <div key={session.shortCode} className="border border-gray-100 rounded-2xl p-5 bg-gray-50/70">
                                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            {isEditing ? (
                                                <div className="space-y-3">
                                                    <label className="block text-sm font-semibold text-gray-700">
                                                        Session Name / Description
                                                    </label>
                                                    <textarea
                                                        value={editingRemarks}
                                                        onChange={(e) => setEditingRemarks(e.target.value)}
                                                        placeholder="Describe this session"
                                                        className="w-full min-h-24 px-4 py-3 bg-white border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleSaveRename(session.shortCode)}
                                                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg"
                                                        >
                                                            Save Name
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setEditingShortCode(null);
                                                                setEditingRemarks('');
                                                            }}
                                                            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="font-semibold text-gray-800 text-xl truncate">
                                                        {session.title || session.shortCode}
                                                    </div>
                                                    <div className="text-xs text-gray-500 font-mono mt-1">{session.shortCode}</div>
                                                    {session.remarks && session.remarks !== session.title && (
                                                        <div className="text-sm text-gray-600 mt-2 line-clamp-2">{session.remarks}</div>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {!isEditing && (
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={() => handleLoadSession(session.shortCode)}
                                                    disabled={isLoading}
                                                    className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-lg disabled:opacity-50"
                                                >
                                                    Load
                                                </button>
                                                <button
                                                    onClick={() => handleStartRename(session)}
                                                    className="px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
                                                >
                                                    Rename
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteSession(session.shortCode)}
                                                    className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {!isEditing && (
                                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-600">
                                            <span className="px-2 py-1 bg-white rounded-full border border-gray-200">{session.subscriptionCount || 0} subscriptions</span>
                                            <span className="px-2 py-1 bg-white rounded-full border border-gray-200">{session.proxyNodeCount || 0} proxies</span>
                                            <span className="px-2 py-1 bg-white rounded-full border border-gray-200">{session.ruleSetCount || 0} rules</span>
                                            <span className="px-2 py-1 bg-white rounded-full border border-gray-200">Updated {formatSessionTimestamp(session.updatedAt || session.createdAt)}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
