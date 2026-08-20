import { base64FromBinary } from './utils.js';

// Reverse-direction of ProxyParsers.js: unified proxy object -> canonical URL.
// Every serializer must round-trip through ProxyParser.parse() so saved nodes
// keep their meaning when re-imported or re-saved.

function formatHost(host) {
    if (!host) {
        return '';
    }
    return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

function buildQuery(params) {
    const searchParams = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            searchParams.set(key, String(value));
        }
    });
    const query = searchParams.toString();
    return query ? `?${query}` : '';
}

function withTag(url, tag) {
    return tag ? `${url}#${encodeURIComponent(tag)}` : url;
}

function wsParams(proxy) {
    const transport = proxy.transport;
    if (transport?.type !== 'ws') {
        return {};
    }
    const host = transport.headers?.Host || transport.headers?.host;
    return {
        type: 'ws',
        path: transport.path || '/',
        host,
    };
}

function tlsParams(proxy, { reality = false } = {}) {
    const tls = proxy.tls;
    if (!tls?.enabled) {
        return { security: 'none' };
    }
    const params = {
        security: reality && tls.reality?.enabled ? 'reality' : 'tls',
        sni: tls.server_name,
    };
    if (tls.insecure) {
        params.allowInsecure = 1;
    }
    if (reality && tls.reality?.enabled) {
        if (tls.reality.public_key) {
            params.pbk = tls.reality.public_key;
        }
        if (tls.reality.short_id) {
            params.sid = tls.reality.short_id;
        }
    }
    return params;
}

function serializeShadowsocks(proxy) {
    const credentials = base64FromBinary(`${proxy.method}:${proxy.password}`);
    return withTag(
        `ss://${encodeURIComponent(credentials)}@${formatHost(proxy.server)}:${proxy.server_port}`,
        proxy.tag
    );
}

function serializeVmess(proxy) {
    const transport = proxy.transport;
    const isWs = transport?.type === 'ws';
    const payload = {
        v: '2',
        ps: proxy.tag || '',
        add: proxy.server,
        port: String(proxy.server_port),
        id: proxy.uuid,
        aid: String(proxy.alter_id ?? 0),
        scy: proxy.security || 'auto',
        net: isWs ? 'ws' : 'tcp',
        host: isWs ? (transport.headers?.Host || transport.headers?.host || '') : '',
        path: isWs ? (transport.path || '') : '',
        tls: proxy.tls?.enabled ? 'tls' : '',
        sni: proxy.tls?.server_name || '',
    };
    return `vmess://${base64FromBinary(JSON.stringify(payload))}`;
}

function serializeVless(proxy) {
    const params = {
        ...wsParams(proxy),
        ...tlsParams(proxy, { reality: true }),
        flow: proxy.flow,
    };
    return withTag(
        `vless://${encodeURIComponent(proxy.uuid)}@${formatHost(proxy.server)}:${proxy.server_port}${buildQuery(params)}`,
        proxy.tag
    );
}

function serializeTrojan(proxy) {
    const params = {
        ...wsParams(proxy),
        ...tlsParams(proxy),
        flow: proxy.flow,
    };
    return withTag(
        `trojan://${encodeURIComponent(proxy.password)}@${formatHost(proxy.server)}:${proxy.server_port}${buildQuery(params)}`,
        proxy.tag
    );
}

function serializeHysteria2(proxy) {
    const params = {
        ...tlsParams(proxy),
        obfs: proxy.obfs?.type,
        'obfs-password': proxy.obfs?.password,
    };
    return withTag(
        `hysteria2://${encodeURIComponent(proxy.password)}@${formatHost(proxy.server)}:${proxy.server_port}${buildQuery(params)}`,
        proxy.tag
    );
}

function serializeTuic(proxy) {
    const scheme = proxy.type === 'tuic-v5' ? 'tuic-v5' : 'tuic';
    const params = {
        sni: proxy.tls?.server_name,
        alpn: proxy.tls?.alpn?.[0],
        congestion_control: proxy.congestion_control,
    };
    if (proxy.type === 'tuic-v5' && proxy.tls?.insecure) {
        params.insecure = 1;
    }
    return withTag(
        `${scheme}://${encodeURIComponent(proxy.uuid)}:${encodeURIComponent(proxy.password)}@${formatHost(proxy.server)}:${proxy.server_port}${buildQuery(params)}`,
        proxy.tag
    );
}

function serializeNaive(proxy) {
    const params = {
        sni: proxy.tls?.server_name,
        udp_over_tcp: proxy.udp_over_tcp ? 'true' : undefined,
        quic: proxy.quic ? 'true' : undefined,
        quic_congestion_control: proxy.quic_congestion_control,
        insecure_concurrency: proxy.insecure_concurrency,
        localport: proxy.local_port,
    };
    return withTag(
        `naive://${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@${formatHost(proxy.server)}:${proxy.server_port}${buildQuery(params)}`,
        proxy.tag
    );
}

export function serializeProxy(proxy) {
    if (!proxy?.type) {
        return null;
    }
    switch (proxy.type) {
        case 'shadowsocks':
            return serializeShadowsocks(proxy);
        case 'vmess':
            return serializeVmess(proxy);
        case 'vless':
            return serializeVless(proxy);
        case 'trojan':
            return serializeTrojan(proxy);
        case 'hysteria2':
            return serializeHysteria2(proxy);
        case 'tuic':
        case 'tuic-v5':
            return serializeTuic(proxy);
        case 'naive':
            return serializeNaive(proxy);
        default:
            return null;
    }
}
