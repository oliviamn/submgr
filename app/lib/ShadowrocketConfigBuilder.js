import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { SHADOWROCKET_CONFIG, SURGE_SITE_RULE_SET_BASEURL, SURGE_IP_RULE_SET_BASEURL, generateRules } from './config.js';
import { t } from './i18n/index.js';

/**
 * Shadowrocket config builder.
 *
 * Shadowrocket's native config format is a Surge-like .conf with
 * [General] / [Proxy] / [Proxy Group] / [Rule] sections, but its proxy line
 * syntax differs from Surge:
 *   - vmess/vless use `password=<uuid>` (NOT Surge's `username=`),
 *   - websocket is enabled with `obfs=websocket` + `ws-path=` (NOT `ws=true`),
 *   - TLS SNI is `peer=` for vless/trojan (vmess uses `sni=`),
 *   - insecure TLS is `allowInsecure=1`,
 *   - hysteria2 uses `auth=` + `obfsParam=`,
 *   - tuic uses `user=<uuid>, password=...`,
 *   - NaiveProxy is exposed as an `https` proxy with plain user/password
 *     (Shadowrocket's "HTTPS"/"HTTP2" node types ARE the Naive implementation;
 *     the macOS `external` exec hack used by the Surge builder is not usable
 *     on iOS and must not be copied here).
 *
 * RULE-SET accepts the same remote .conf/.txt lists as Surge, so the existing
 * surge-geox-rules URLs are reused unchanged.
 */
export class ShadowrocketConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent, proxyEnabled = false, proxyUrl = '', cachedSubscriptionProxies = [], providerRuleSets = []) {
        baseConfig = SHADOWROCKET_CONFIG;
        super(inputString, baseConfig, lang, userAgent, cachedSubscriptionProxies, providerRuleSets);
        this.selectedRules = selectedRules;
        this.customRules = customRules;
        this.subscriptionUrl = null;
        this.proxyEnabled = proxyEnabled;
        this.proxyUrl = proxyUrl;
    }

    setSubscriptionUrl(url) {
        this.subscriptionUrl = url;
        return this;
    }

    getProxies() {
        return this.config.proxies || [];
    }

    getProxyName(proxy) {
        return proxy.split('=')[0].trim();
    }

    convertProxy(proxy) {
        let shadowrocketProxy;
        switch (proxy.type) {
            case 'shadowsocks':
                shadowrocketProxy = `${proxy.tag} = ss, ${proxy.server}, ${proxy.server_port}, method=${proxy.method}, password=${proxy.password}`;
                break;

            case 'vmess':
                shadowrocketProxy = `${proxy.tag} = vmess, ${proxy.server}, ${proxy.server_port}, password=${proxy.uuid}`;
                if (proxy.alter_id != null) {
                    shadowrocketProxy += `, alterId=${proxy.alter_id}`;
                }
                if (proxy.security && proxy.security !== 'auto') {
                    shadowrocketProxy += `, method=${proxy.security}`;
                }
                if (proxy.transport?.type === 'ws') {
                    shadowrocketProxy += ', obfs=websocket';
                    if (proxy.transport.path) {
                        shadowrocketProxy += `, ws-path=${proxy.transport.path}`;
                    }
                    if (proxy.transport.headers?.Host || proxy.transport.headers?.host) {
                        shadowrocketProxy += `, host=${proxy.transport.headers.Host || proxy.transport.headers.host}`;
                    }
                }
                if (proxy.tls?.enabled) {
                    shadowrocketProxy += ', tls=true';
                    if (proxy.tls.server_name) {
                        shadowrocketProxy += `, sni=${proxy.tls.server_name}`;
                    }
                    if (proxy.tls.insecure) {
                        shadowrocketProxy += ', allowInsecure=1';
                    }
                }
                break;

            case 'vless':
                // Shadowrocket has no conf support for VLESS Reality; emit a
                // comment instead of a broken proxy line.
                if (proxy.tls?.reality?.enabled) {
                    return `# ${proxy.tag} - VLESS Reality is not supported by Shadowrocket`;
                }
                shadowrocketProxy = `${proxy.tag} = vless, ${proxy.server}, ${proxy.server_port}, password=${proxy.uuid}`;
                if (proxy.transport?.type === 'ws') {
                    shadowrocketProxy += ', obfs=websocket';
                    if (proxy.transport.path) {
                        shadowrocketProxy += `, ws-path=${proxy.transport.path}`;
                    }
                    if (proxy.transport.headers?.Host || proxy.transport.headers?.host) {
                        shadowrocketProxy += `, host=${proxy.transport.headers.Host || proxy.transport.headers.host}`;
                    }
                }
                if (proxy.tls?.enabled) {
                    shadowrocketProxy += ', tls=true';
                    if (proxy.tls.server_name) {
                        shadowrocketProxy += `, peer=${proxy.tls.server_name}`;
                    }
                    if (proxy.tls.insecure) {
                        shadowrocketProxy += ', allowInsecure=1';
                    }
                }
                break;

            case 'trojan':
                shadowrocketProxy = `${proxy.tag} = trojan, ${proxy.server}, ${proxy.server_port}, password=${proxy.password}`;
                if (proxy.tls?.server_name) {
                    shadowrocketProxy += `, peer=${proxy.tls.server_name}`;
                }
                if (proxy.tls?.insecure) {
                    shadowrocketProxy += ', allowInsecure=1';
                }
                if (proxy.transport?.type === 'ws') {
                    shadowrocketProxy += ', obfs=websocket';
                    if (proxy.transport.path) {
                        shadowrocketProxy += `, ws-path=${proxy.transport.path}`;
                    }
                    if (proxy.transport.headers?.Host || proxy.transport.headers?.host) {
                        shadowrocketProxy += `, host=${proxy.transport.headers.Host || proxy.transport.headers.host}`;
                    }
                }
                break;

            case 'hysteria2':
                shadowrocketProxy = `${proxy.tag} = hysteria2, ${proxy.server}, ${proxy.server_port}, auth=${proxy.password}, udp=1`;
                if (proxy.obfs?.type === 'salamander' && proxy.obfs.password) {
                    shadowrocketProxy += `, obfsParam=${proxy.obfs.password}`;
                }
                if (proxy.tls?.server_name) {
                    shadowrocketProxy += `, peer=${proxy.tls.server_name}`;
                }
                if (proxy.tls?.alpn?.length) {
                    shadowrocketProxy += `, alpn=${proxy.tls.alpn.join(',')}`;
                }
                if (proxy.tls?.insecure) {
                    shadowrocketProxy += ', allowInsecure=1';
                }
                break;

            case 'tuic':
            case 'tuic-v5':
                shadowrocketProxy = `${proxy.tag} = tuic, ${proxy.server}, ${proxy.server_port}, password=${proxy.password}, user=${proxy.uuid}, udp=1`;
                if (proxy.tls?.server_name) {
                    shadowrocketProxy += `, peer=${proxy.tls.server_name}`;
                }
                if (proxy.tls?.alpn?.length) {
                    shadowrocketProxy += `, alpn=${proxy.tls.alpn.join(',')}`;
                }
                if (proxy.tls?.insecure) {
                    shadowrocketProxy += ', allowInsecure=1';
                }
                break;

            case 'naive':
                // NaiveProxy is exposed in Shadowrocket as an HTTPS node
                // (username/password auth). No tls= params are needed: naive
                // owns its own TLS session.
                shadowrocketProxy = `${proxy.tag} = https, ${proxy.server}, ${proxy.server_port}, ${proxy.username}, ${proxy.password}`;
                break;

            default:
                shadowrocketProxy = `# ${proxy.tag} - Unsupported proxy type: ${proxy.type}`;
        }
        return shadowrocketProxy;
    }

    addProxyToConfig(proxy) {
        this.config.proxies = this.config.proxies || [];
        this.config.proxies.push(proxy);
    }

    createProxyGroup(name, type, options = [], extraConfig = '') {
        // Shadowrocket has DIRECT / REJECT as built-in policies; url-test
        // groups must not contain them or the auto test would always win.
        const baseOptions = type === 'url-test' ? [] : ['DIRECT', 'REJECT'];
        // Unsupported proxies are emitted as `# ...` comment lines; exclude
        // them from group members so they don't corrupt the member list.
        const proxyNames = this.getProxies()
            .map(proxy => this.getProxyName(proxy))
            .filter(name => name && !name.startsWith('#'));
        const allOptions = [...baseOptions, ...options, ...proxyNames];
        return `${name} = ${type}, ${allOptions.join(', ')}${extraConfig}`;
    }

    addAutoSelectGroup(proxyList) {
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        // Disabled to keep output structure identical to the Surge builder.
        // this.config['proxy-groups'].push(
        //     this.createProxyGroup(t('outboundNames.Auto Select'), 'url-test', [], ', url=http://www.gstatic.com/generate_204, interval=300')
        // );
    }

    addNodeSelectGroup(proxyList) {
        this.config['proxy-groups'].push(
            this.createProxyGroup(t('outboundNames.Node Select'), 'select')
        );
    }

    addOutboundGroups(outbounds, proxyList) {
        outbounds.forEach(outbound => {
            if (outbound !== t('outboundNames.Node Select')) {
                this.config['proxy-groups'].push(
                    this.createProxyGroup(t(`outboundNames.${outbound}`), 'select', [t('outboundNames.Node Select')])
                );
            }
        });
    }

    addCustomRuleGroups(proxyList) {
        if (Array.isArray(this.customRules)) {
            this.customRules.forEach(rule => {
                this.config['proxy-groups'].push(
                    this.createProxyGroup(rule.name, 'select', [t('outboundNames.Node Select')])
                );
            });
        }
    }

    addFallBackGroup(proxyList) {
        this.config['proxy-groups'].push(
            this.createProxyGroup(t('outboundNames.Fall Back'), 'select', [t('outboundNames.Node Select')])
        );
    }

    formatConfig() {
        const rules = generateRules(this.selectedRules, this.customRules);
        const providerRules = this.getInlineProviderRules();
        const finalConfig = [];

        if (this.subscriptionUrl) {
            // Shadowrocket updates remote configs through its own UI, but the
            // Surge managed-config marker is a harmless comment line here.
            finalConfig.push(`#!MANAGED-CONFIG ${this.subscriptionUrl} interval=43200 strict=false`);
            finalConfig.push('');
        }

        finalConfig.push('[General]');
        if (this.config.general) {
            Object.entries(this.config.general).forEach(([key, value]) => {
                finalConfig.push(`${key} = ${value}`);
            });
        }

        finalConfig.push('\n[Proxy]');
        if (this.config.proxies) {
            finalConfig.push(...this.config.proxies);
        }

        finalConfig.push('\n[Proxy Group]');
        if (this.config['proxy-groups']) {
            finalConfig.push(...this.config['proxy-groups']);
        }

        finalConfig.push('\n[Rule]');

        // Rule-Set & Domain Rules & IP Rules: to reduce DNS leaks and
        // unnecessary DNS queries, domain & non-IP rules precede IP rules.

        rules.filter(rule => !!rule.domain_suffix).map(rule => {
            rule.domain_suffix.forEach(suffix => {
                finalConfig.push(`DOMAIN-SUFFIX,${suffix},${t('outboundNames.' + rule.outbound)}`);
            });
        });

        rules.filter(rule => !!rule.domain_keyword).map(rule => {
            rule.domain_keyword.forEach(keyword => {
                finalConfig.push(`DOMAIN-KEYWORD,${keyword},${t('outboundNames.' + rule.outbound)}`);
            });
        });

        // Add proxy URL to rule set URLs if enabled
        const proxyPrefix = this.proxyEnabled && this.proxyUrl ? this.proxyUrl : '';

        rules.filter(rule => rule.site_rules[0] !== '').map(rule => {
            rule.site_rules.forEach(site => {
                finalConfig.push(`RULE-SET,${proxyPrefix}${SURGE_SITE_RULE_SET_BASEURL}${site}.conf,${t('outboundNames.' + rule.outbound)}`);
            });
        });

        rules.filter(rule => rule.ip_rules[0] !== '').map(rule => {
            rule.ip_rules.forEach(ip => {
                finalConfig.push(`RULE-SET,${proxyPrefix}${SURGE_IP_RULE_SET_BASEURL}${ip}.txt,${t('outboundNames.' + rule.outbound)},no-resolve`);
            });
        });

        rules.filter(rule => !!rule.ip_cidr).map(rule => {
            rule.ip_cidr.forEach(cidr => {
                finalConfig.push(`IP-CIDR,${cidr},${t('outboundNames.' + rule.outbound)},no-resolve`);
            });
        });

        providerRules.forEach((rule, index) => {
            const sourceRuleSet = this.providerRuleSets[index];
            // Shadowrocket RULE-SET semantics match Surge's, so reuse the
            // sources extracted for the Surge client.
            const remoteSources = this.getProviderRemoteSources(sourceRuleSet, 'surge');

            if (remoteSources.length > 0) {
                remoteSources.forEach(source => {
                    finalConfig.push(`RULE-SET,${proxyPrefix}${source.url},${t('outboundNames.' + rule.outbound)}${source.noResolve ? ',no-resolve' : ''}`);
                });
                return;
            }

            rule.domain_suffix?.forEach(suffix => {
                finalConfig.push(`DOMAIN-SUFFIX,${suffix},${t('outboundNames.' + rule.outbound)}`);
            });
            rule.domain_keyword?.forEach(keyword => {
                finalConfig.push(`DOMAIN-KEYWORD,${keyword},${t('outboundNames.' + rule.outbound)}`);
            });
            rule.ip_cidr?.forEach(cidr => {
                finalConfig.push(`IP-CIDR,${cidr},${t('outboundNames.' + rule.outbound)},no-resolve`);
            });
        });

        finalConfig.push('FINAL,' + t('outboundNames.Fall Back'));

        return finalConfig.join('\n');
    }
}
