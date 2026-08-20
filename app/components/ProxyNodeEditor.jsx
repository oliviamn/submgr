'use client';

import { useMemo, useState } from 'react';
import {
    SUPPORTED_PROXY_TYPES,
    PROXY_TYPE_LABELS,
    PROXY_TYPE_FIELDS,
    FIELD_META,
    EMPTY_FORM,
    fromProxyObject,
    toProxyObject,
    validateForm,
    buildProxyNode,
} from '../lib/ProxyEditorModel';

export default function ProxyNodeEditor({ proxyNode, onClose, onSaved }) {
    const isEditing = !!proxyNode;
    const [form, setForm] = useState(() => (proxyNode ? fromProxyObject(proxyNode) : { ...EMPTY_FORM }));
    const [errors, setErrors] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);

    const setField = (key, value) => {
        setForm(current => ({ ...current, [key]: value }));
        setErrors(current => {
            if (!current[key]) {
                return current;
            }
            const next = { ...current };
            delete next[key];
            return next;
        });
    };

    const handleTypeChange = (type) => {
        setForm(current => ({
            ...EMPTY_FORM,
            type,
            tag: current.tag,
            server: current.server,
            server_port: current.server_port,
        }));
        setErrors({});
    };

    const previewUrl = useMemo(() => {
        try {
            return buildProxyNode(form).rawValue;
        } catch (error) {
            console.warn('Failed to preview proxy URL:', error);
            return null;
        }
    }, [form]);

    const handleSave = async () => {
        const validationErrors = validateForm(form);
        setErrors(validationErrors);
        if (Object.keys(validationErrors).length > 0) {
            return;
        }

        setIsSaving(true);
        setSaveError(null);

        try {
            const { proxyNode: proxyNodeObject, rawValue } = buildProxyNode(form);
            if (!rawValue) {
                throw new Error('Unable to generate a proxy URL from this configuration');
            }

            if (isEditing && proxyNode?.id) {
                proxyNodeObject.id = proxyNode.id;
            }

            const response = await fetch('/api/proxies', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    proxyNode: proxyNodeObject,
                    rawValue,
                }),
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save proxy node');
            }

            onSaved?.(data.proxyNode);
        } catch (error) {
            setSaveError(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const fields = PROXY_TYPE_FIELDS[form.type] || [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800">
                        {isEditing ? 'Edit Proxy Node' : 'Add Proxy Node'}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                        aria-label="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {!isEditing && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Protocol</label>
                            <select
                                value={form.type}
                                onChange={(e) => handleTypeChange(e.target.value)}
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {SUPPORTED_PROXY_TYPES.map(type => (
                                    <option key={type} value={type}>{PROXY_TYPE_LABELS[type]}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {fields.map(fieldKey => {
                        const meta = FIELD_META[fieldKey];
                        if (!meta) {
                            return null;
                        }
                        const value = form[fieldKey];
                        const error = errors[fieldKey];
                        const commonClass = 'w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

                        return (
                            <div key={fieldKey}>
                                {meta.type === 'checkbox' ? (
                                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={!!value}
                                            onChange={(e) => setField(fieldKey, e.target.checked)}
                                            className="h-4 w-4 rounded border-gray-300"
                                        />
                                        <span className="text-sm font-medium text-gray-700">{meta.label}</span>
                                    </label>
                                ) : (
                                    <>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {meta.label}
                                            {meta.required && <span className="text-red-500 ml-0.5">*</span>}
                                        </label>
                                        {meta.options ? (
                                            <select
                                                value={value ?? ''}
                                                onChange={(e) => setField(fieldKey, e.target.value)}
                                                className={commonClass}
                                            >
                                                {meta.options.map(option => (
                                                    <option key={option} value={option}>{option || '—'}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                type={meta.type || 'text'}
                                                min={meta.min}
                                                max={meta.max}
                                                placeholder={meta.placeholder}
                                                value={value ?? ''}
                                                onChange={(e) => setField(fieldKey, e.target.value)}
                                                className={error ? `${commonClass} border-red-300` : commonClass}
                                            />
                                        )}
                                        {error && (
                                            <p className="mt-1 text-xs text-red-600">{error}</p>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}

                    {previewUrl && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Generated URL</label>
                            <div className="p-3 bg-gray-900 text-green-300 rounded-lg font-mono text-xs break-all select-all">
                                {previewUrl}
                            </div>
                        </div>
                    )}

                    {saveError && (
                        <div className="px-4 py-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm">
                            {saveError}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Proxy'}
                    </button>
                </div>
            </div>
        </div>
    );
}
