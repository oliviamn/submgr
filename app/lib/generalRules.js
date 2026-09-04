import { DEFAULT_GENERAL_RULES } from './config.js';

export const GENERAL_RULE_KIND = 'general';

export const isGeneralRuleSet = (ruleSet) => ruleSet?.kind === GENERAL_RULE_KIND;

// Defaults first, then each selected general rule set; dedup, order preserved,
// values verbatim (Surge Host List `-` exclusions and wildcards pass through).
export function resolveGeneralRules(providerRuleSets = [], { includeDefaults = true } = {}) {
    const skipProxy = [];
    const tunExcludedRoutes = [];

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
    }

    (providerRuleSets || []).filter(isGeneralRuleSet).forEach(ruleSet => {
        appendAll(skipProxy, ruleSet.rules?.general?.skip_proxy);
        appendAll(tunExcludedRoutes, ruleSet.rules?.general?.tun_excluded_routes);
    });

    return { skip_proxy: skipProxy, tun_excluded_routes: tunExcludedRoutes };
}

// Surge: emit both keys into [General]. An explicit skip-proxy line replaces
// Surge's built-in defaults, so always emit the full merged list.
export function applySurgeGeneralRules(general = {}, resolved = {}) {
    if (!general || typeof general !== 'object') {
        return general;
    }

    general['skip-proxy'] = (resolved.skip_proxy || []).join(',');
    if ((resolved.tun_excluded_routes || []).length > 0) {
        general['tun-excluded-routes'] = resolved.tun_excluded_routes.join(',');
    }

    return general;
}

// sing-box: only tun_excluded_routes maps to a core option (tun inbound
// route_exclude_address). skip_proxy domains have no core equivalent
// (platform.http_proxy.bypass_domain is Apple-GUI-only), so they are dropped.
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

// Clash: no system-proxy bypass concept; only set route-exclude-address when a
// custom base config already has a tun block (adding one would change runtime
// behavior), otherwise a no-op.
export function applyClashGeneralRules(config = {}, resolved = {}) {
    if (config?.tun && typeof config.tun === 'object' && (resolved.tun_excluded_routes || []).length > 0) {
        config.tun['route-exclude-address'] = Array.from(new Set([
            ...(config.tun['route-exclude-address'] || []),
            ...resolved.tun_excluded_routes,
        ]));
    }

    return config;
}
