import { DEFAULT_GENERAL_RULES } from './config.js';

export const GENERAL_RULE_KIND = 'general';

export const isGeneralRuleSet = (ruleSet) => ruleSet?.kind === GENERAL_RULE_KIND;

// Defaults first, then each selected general rule set; dedup, order preserved,
// values verbatim (Surge Host List `-` exclusions and wildcards pass through).
export function resolveGeneralRules(providerRuleSets = [], { includeDefaults = true } = {}) {
    const skipProxy = [];
    const tunExcludedRoutes = [];
    const alwaysRealIp = [];

    const appendAll = (target, values = []) => {
        values.forEach(value => {
            if (typeof value !== 'string') {
                return;
            }
            const trimmed = value.trim();
            if (trimmed && !target.includes(trimmed)) {
                target.push(trimmed);
            }
        });
    };

    if (includeDefaults) {
        appendAll(skipProxy, DEFAULT_GENERAL_RULES.skip_proxy);
        appendAll(tunExcludedRoutes, DEFAULT_GENERAL_RULES.tun_excluded_routes);
        appendAll(alwaysRealIp, DEFAULT_GENERAL_RULES.always_real_ip);
    }

    (providerRuleSets || []).filter(isGeneralRuleSet).forEach(ruleSet => {
        appendAll(skipProxy, ruleSet.rules?.general?.skip_proxy);
        appendAll(tunExcludedRoutes, ruleSet.rules?.general?.tun_excluded_routes);
        appendAll(alwaysRealIp, ruleSet.rules?.general?.always_real_ip);
    });

    return { skip_proxy: skipProxy, tun_excluded_routes: tunExcludedRoutes, always_real_ip: alwaysRealIp };
}

// Surge: emit all keys into [General]. An explicit skip-proxy line replaces
// Surge's built-in defaults, so always emit the full merged list.
export function applySurgeGeneralRules(general = {}, resolved = {}) {
    if (!general || typeof general !== 'object') {
        return general;
    }

    general['skip-proxy'] = (resolved.skip_proxy || []).join(',');
    if ((resolved.tun_excluded_routes || []).length > 0) {
        general['tun-excluded-routes'] = resolved.tun_excluded_routes.join(',');
    }
    if ((resolved.always_real_ip || []).length > 0) {
        general['always-real-ip'] = resolved.always_real_ip.join(',');
    }

    return general;
}

// sing-box: only tun_excluded_routes maps to a core option (tun inbound
// route_exclude_address). skip_proxy domains have no core equivalent
// (platform.http_proxy.bypass_domain is Apple-GUI-only), so they are dropped.
// always_real_ip is also dropped: fake-ip in sing-box is opt-in per DNS rule,
// not a global filter list.
export function applySingboxGeneralRules(config = {}, resolved = {}) {
    const tunInbound = (config.inbounds || []).find(inbound => inbound?.type === 'tun');
    if (!tunInbound) {
        return config;
    }

    const merged = Array.from(new Set([
        ...(tunInbound.route_exclude_address || []),
        ...(resolved.tun_excluded_routes || []),
    ]));

    if (merged.length > 0) {
        tunInbound.route_exclude_address = merged;
    }

    return config;
}

// Pure IP or CIDR (v4/v6) — fake-ip-filter only accepts domain patterns.
const isIpOrCidr = (value = '') => (
    /^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(value) || value.includes(':')
);

// Clash: no system-proxy bypass concept; only set route-exclude-address when a
// custom base config already has a tun block (adding one would change runtime
// behavior), otherwise a no-op. always_real_ip maps to dns.fake-ip-filter
// (domains that must not resolve to fake IPs) — IP/CIDR entries are dropped.
export function applyClashGeneralRules(config = {}, resolved = {}) {
    if (config?.tun && typeof config.tun === 'object' && (resolved.tun_excluded_routes || []).length > 0) {
        config.tun['route-exclude-address'] = Array.from(new Set([
            ...(config.tun['route-exclude-address'] || []),
            ...resolved.tun_excluded_routes,
        ]));
    }

    if (config?.dns && typeof config.dns === 'object') {
        const domainEntries = (resolved.always_real_ip || []).filter(value => !isIpOrCidr(value));
        if (domainEntries.length > 0) {
            config.dns['fake-ip-filter'] = Array.from(new Set([
                ...(config.dns['fake-ip-filter'] || []),
                ...domainEntries,
            ]));
        }
    }

    return config;
}
