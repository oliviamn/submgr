import { serializeProxy } from './ProxySerializers.js';

// Form model for the proxy node editor. The form works on a flat model
// (form <-> unified proxy object) so users never have to remember URL
// conventions. Field lists only expose options that ProxyParser preserves;
// anything else would be silently dropped on save.

export const SUPPORTED_PROXY_TYPES = [
    'shadowsocks',
    'vmess',
    'vless',
    'trojan',
    'hysteria2',
    'tuic',
    'tuic-v5',
    'naive',
];

export const PROXY_TYPE_LABELS = {
    shadowsocks: 'Shadowsocks (SS)',
    vmess: 'VMess',
    vless: 'VLESS',
    trojan: 'Trojan',
    hysteria2: 'Hysteria2',
    tuic: 'TUIC',
    'tuic-v5': 'TUIC v5',
    naive: 'NaiveProxy',
};

const COMMON_FIELDS = ['tag', 'server', 'server_port'];

export const PROXY_TYPE_FIELDS = {
    shadowsocks: [...COMMON_FIELDS, 'method', 'password'],
    vmess: [...COMMON_FIELDS, 'uuid', 'alter_id', 'security', 'tls_enabled', 'tls_sni', 'ws_enabled', 'ws_path', 'ws_host'],
    vless: [...COMMON_FIELDS, 'uuid', 'flow', 'tls_enabled', 'tls_sni', 'tls_insecure', 'reality_enabled', 'reality_pbk', 'reality_sid', 'ws_enabled', 'ws_path', 'ws_host'],
    trojan: [...COMMON_FIELDS, 'password', 'tls_sni', 'tls_insecure', 'ws_enabled', 'ws_path', 'ws_host'],
    hysteria2: [...COMMON_FIELDS, 'password', 'tls_sni', 'tls_insecure', 'obfs_enabled', 'obfs_password'],
    tuic: [...COMMON_FIELDS, 'uuid', 'password', 'tls_sni', 'alpn', 'congestion_control'],
    'tuic-v5': [...COMMON_FIELDS, 'uuid', 'password', 'tls_sni', 'alpn', 'congestion_control'],
    naive: [...COMMON_FIELDS, 'username', 'password', 'tls_sni', 'udp_over_tcp'],
};

export const FIELD_META = {
    tag: { label: 'Name', placeholder: 'e.g. HK-01', required: true },
    server: { label: 'Server address', placeholder: 'example.com or 1.2.3.4', required: true },
    server_port: { label: 'Port', type: 'number', required: true, min: 1, max: 65535 },
    method: { label: 'Encryption method', placeholder: 'e.g. aes-256-gcm', required: true },
    password: { label: 'Password', type: 'password', required: true },
    username: { label: 'Username', required: true },
    uuid: { label: 'UUID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true },
    alter_id: { label: 'Alter ID', type: 'number', defaultValue: 0 },
    security: { label: 'Security / encryption', options: ['auto', 'aes-128-gcm', 'chacha20-poly1305', 'none', 'zero'], defaultValue: 'auto' },
    flow: { label: 'Flow control', options: ['', 'xtls-rprx-vision', 'xtls-rprx-vision-udp443', 'xtls-rprx-origin', 'xtls-rprx-splice'], defaultValue: '' },
    tls_enabled: { label: 'Enable TLS', type: 'checkbox' },
    tls_sni: { label: 'TLS SNI / server name', placeholder: 'tls.example.com' },
    tls_insecure: { label: 'Allow insecure TLS (skip cert verify)', type: 'checkbox' },
    reality_enabled: { label: 'Enable Reality', type: 'checkbox' },
    reality_pbk: { label: 'Reality public key', placeholder: 'public key' },
    reality_sid: { label: 'Reality short ID', placeholder: 'e.g. abcd' },
    ws_enabled: { label: 'Enable WebSocket transport', type: 'checkbox' },
    ws_path: { label: 'WS path', placeholder: '/path' },
    ws_host: { label: 'WS host / Host header', placeholder: 'cdn.example.com' },
    obfs_enabled: { label: 'Enable obfs (salamander)', type: 'checkbox' },
    obfs_password: { label: 'Obfuscation password', type: 'password', required: true },
    alpn: { label: 'ALPN', placeholder: 'e.g. h3, h2' },
    congestion_control: { label: 'Congestion control', options: ['', 'bbr', 'cubic', 'new_reno', 'none'], defaultValue: '' },
    udp_over_tcp: { label: 'UDP over TCP', type: 'checkbox' },
};

export const EMPTY_FORM = {
    tag: '',
    type: 'shadowsocks',
    server: '',
    server_port: '',
    method: '',
    password: '',
    username: '',
    uuid: '',
    alter_id: 0,
    security: 'auto',
    flow: '',
    tls_enabled: false,
    tls_sni: '',
    tls_insecure: false,
    reality_enabled: false,
    reality_pbk: '',
    reality_sid: '',
    ws_enabled: false,
    ws_path: '',
    ws_host: '',
    obfs_enabled: false,
    obfs_password: '',
    alpn: '',
    congestion_control: '',
    udp_over_tcp: false,
};

export function fromProxyObject(proxy) {
    const tls = proxy?.tls || {};
    const transport = proxy?.transport || {};
    const headers = transport.headers || {};
    const base = {
        tag: proxy?.tag || '',
        type: proxy?.type,
        server: proxy?.server || '',
        server_port: proxy?.server_port ?? '',
    };

    switch (proxy?.type) {
        case 'shadowsocks':
            return { ...base, method: proxy.method || '', password: proxy.password || '' };
        case 'vmess':
            return {
                ...base,
                uuid: proxy.uuid || '',
                alter_id: proxy.alter_id ?? 0,
                security: proxy.security || 'auto',
                tls_enabled: !!tls.enabled,
                tls_sni: tls.server_name || '',
                ws_enabled: transport.type === 'ws',
                ws_path: transport.path || '',
                ws_host: headers.Host || headers.host || '',
            };
        case 'vless':
            return {
                ...base,
                uuid: proxy.uuid || '',
                flow: proxy.flow || '',
                tls_enabled: !!tls.enabled,
                tls_sni: tls.server_name || '',
                tls_insecure: !!tls.insecure,
                reality_enabled: !!tls.reality?.enabled,
                reality_pbk: tls.reality?.public_key || '',
                reality_sid: tls.reality?.short_id || '',
                ws_enabled: transport.type === 'ws',
                ws_path: transport.path || '',
                ws_host: headers.host || headers.Host || '',
            };
        case 'trojan':
            return {
                ...base,
                password: proxy.password || '',
                tls_sni: tls.server_name || '',
                tls_insecure: !!tls.insecure,
                ws_enabled: transport.type === 'ws',
                ws_path: transport.path || '',
                ws_host: headers.host || headers.Host || '',
            };
        case 'hysteria2':
            return {
                ...base,
                password: proxy.password || '',
                tls_sni: tls.server_name || '',
                tls_insecure: !!tls.insecure,
                obfs_enabled: !!proxy.obfs?.password,
                obfs_password: proxy.obfs?.password || '',
            };
        case 'tuic':
        case 'tuic-v5':
            return {
                ...base,
                uuid: proxy.uuid || '',
                password: proxy.password || '',
                tls_sni: tls.server_name || '',
                alpn: tls.alpn?.[0] || '',
                congestion_control: proxy.congestion_control || '',
            };
        case 'naive':
            return {
                ...base,
                username: proxy.username || '',
                password: proxy.password || '',
                tls_sni: tls.server_name || '',
                udp_over_tcp: !!proxy.udp_over_tcp,
            };
        default:
            return base;
    }
}

export function toProxyObject(form) {
    const port = parseInt(form.server_port, 10);
    const base = {
        tag: form.tag?.trim() || '',
        type: form.type,
        server: form.server?.trim() || '',
        server_port: Number.isFinite(port) ? port : 0,
        network: 'tcp',
        tcp_fast_open: false,
    };
    const wsTransport = form.ws_enabled
        ? {
            type: 'ws',
            path: form.ws_path?.trim() || '/',
            headers: form.ws_host?.trim() ? { Host: form.ws_host.trim() } : undefined,
        }
        : undefined;

    switch (form.type) {
        case 'shadowsocks':
            return { ...base, method: form.method?.trim() || '', password: form.password || '' };
        case 'vmess':
            return {
                ...base,
                uuid: form.uuid?.trim() || '',
                alter_id: parseInt(form.alter_id, 10) || 0,
                security: form.security || 'auto',
                tls: form.tls_enabled
                    ? { enabled: true, server_name: form.tls_sni?.trim() || undefined, insecure: false }
                    : undefined,
                transport: wsTransport,
            };
        case 'vless': {
            const reality = form.reality_enabled
                ? {
                    enabled: true,
                    public_key: form.reality_pbk?.trim() || '',
                    short_id: form.reality_sid?.trim() || '',
                }
                : undefined;
            return {
                ...base,
                uuid: form.uuid?.trim() || '',
                flow: form.flow || undefined,
                tls: {
                    enabled: !!form.tls_enabled,
                    server_name: form.tls_sni?.trim() || undefined,
                    insecure: !!form.tls_insecure,
                    reality,
                    utls: reality ? { enabled: true, fingerprint: 'chrome' } : undefined,
                },
                transport: wsTransport,
            };
        }
        case 'trojan':
            return {
                ...base,
                password: form.password || '',
                tls: {
                    enabled: true,
                    server_name: form.tls_sni?.trim() || undefined,
                    insecure: !!form.tls_insecure,
                },
                transport: wsTransport,
            };
        case 'hysteria2':
            return {
                ...base,
                password: form.password || '',
                tls: {
                    enabled: true,
                    server_name: form.tls_sni?.trim() || undefined,
                    insecure: !!form.tls_insecure,
                },
                obfs: form.obfs_enabled
                    ? { type: 'salamander', password: form.obfs_password || '' }
                    : {},
            };
        case 'tuic':
        case 'tuic-v5':
            return {
                ...base,
                uuid: form.uuid?.trim() || '',
                password: form.password || '',
                congestion_control: form.congestion_control || undefined,
                tls: {
                    enabled: true,
                    server_name: form.tls_sni?.trim() || undefined,
                    alpn: form.alpn?.trim() ? [form.alpn.trim()] : undefined,
                    // TUIC URLs cannot carry the insecure flag; match the
                    // parser defaults (tuic always insecure, tuic-v5 not).
                    insecure: form.type === 'tuic-v5' ? false : true,
                },
            };
        case 'naive':
            return {
                ...base,
                username: form.username?.trim() || '',
                password: form.password || '',
                tls: { enabled: true, server_name: form.tls_sni?.trim() || undefined },
                udp_over_tcp: form.udp_over_tcp ? true : undefined,
            };
        default:
            return base;
    }
}

export function validateForm(form) {
    const errors = {};

    if (!form.tag?.trim()) {
        errors.tag = 'Name is required';
    }
    if (!form.server?.trim()) {
        errors.server = 'Server address is required';
    }
    const port = parseInt(form.server_port, 10);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
        errors.server_port = 'Port must be between 1 and 65535';
    }

    switch (form.type) {
        case 'shadowsocks':
            if (!form.method?.trim()) {
                errors.method = 'Encryption method is required';
            }
            if (!form.password) {
                errors.password = 'Password is required';
            }
            break;
        case 'vmess':
        case 'vless':
        case 'tuic':
        case 'tuic-v5':
            if (!form.uuid?.trim()) {
                errors.uuid = 'UUID is required';
            } else if (!/^[0-9a-fA-F-]{32,36}$/.test(form.uuid.trim())) {
                errors.uuid = 'Invalid UUID format';
            }
            if (form.type === 'tuic' || form.type === 'tuic-v5') {
                if (!form.password) {
                    errors.password = 'Password is required';
                }
            }
            break;
        case 'trojan':
        case 'hysteria2':
        case 'naive':
            if (!form.password) {
                errors.password = 'Password is required';
            }
            break;
        default:
            break;
    }

    if (form.type === 'naive' && !form.username?.trim()) {
        errors.username = 'Username is required';
    }
    if (form.ws_enabled && !form.ws_path?.trim()) {
        errors.ws_path = 'WS path is required';
    }
    if (form.reality_enabled) {
        if (!form.reality_pbk?.trim()) {
            errors.reality_pbk = 'Public key is required';
        }
        if (!form.reality_sid?.trim()) {
            errors.reality_sid = 'Short ID is required';
        }
    }
    if (form.obfs_enabled && !form.obfs_password) {
        errors.obfs_password = 'Obfuscation password is required';
    }

    return errors;
}

export function buildProxyNode(form) {
    const proxyNode = toProxyObject(form);
    return {
        proxyNode,
        rawValue: serializeProxy(proxyNode),
    };
}
