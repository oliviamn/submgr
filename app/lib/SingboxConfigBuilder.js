import { SING_BOX_CONFIG, generateRuleSets, generateRules, getOutbounds, PREDEFINED_RULE_SETS} from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

export class SingboxConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent, proxyEnabled = false, proxyUrl = '', cachedSubscriptionProxies = [], providerRuleSets = []) {
        if (baseConfig === undefined) {
            baseConfig = SING_BOX_CONFIG;
            if (baseConfig.dns && baseConfig.dns.servers) {
                baseConfig.dns.servers[0].detour = t('outboundNames.Node Select');
            }
        }
        super(inputString, baseConfig, lang, userAgent, cachedSubscriptionProxies, providerRuleSets);
        this.selectedRules = selectedRules;
        this.customRules = customRules;
        this.proxyEnabled = proxyEnabled;
        this.proxyUrl = proxyUrl;
    }

    getProxies() {
        return this.config.outbounds.filter(outbound => outbound?.server != undefined);
    }

    getProxyName(proxy) {
        return proxy.tag;
    }

    convertProxy(proxy) {
        let singboxProxy = proxy;
        switch (proxy.type) {
            case "tuic-v5":
                singboxProxy = DeepCopy(proxy);
                singboxProxy.type = "tuic";
                singboxProxy.congestion_control = "bbr";
                if (singboxProxy.tls && "insecure" in singboxProxy.tls) {
                    delete singboxProxy.tls.insecure;
                }
                break;
            case "naive":
                singboxProxy = DeepCopy(proxy);
                delete singboxProxy.local_port;
                delete singboxProxy.local_exec_path;
                if (!singboxProxy.tls) {
                    singboxProxy.tls = {
                        enabled: true,
                        server_name: singboxProxy.server
                    };
                } else {
                    singboxProxy.tls = DeepCopy(singboxProxy.tls);
                    singboxProxy.tls.enabled = true;
                    if (!singboxProxy.tls.server_name) {
                        singboxProxy.tls.server_name = singboxProxy.server;
                    }
                }
                break;
        
            default:
                break;
        }

        // Clean up database/internal metadata fields for all proxy types to avoid strict parsing errors in sing-box
        if (singboxProxy && typeof singboxProxy === 'object') {
            if (singboxProxy === proxy) {
                singboxProxy = DeepCopy(proxy);
            }
            delete singboxProxy.id;
            delete singboxProxy.rawValue;
            delete singboxProxy.updatedAt;
            delete singboxProxy.enabled;
        }

        return singboxProxy;
    }

    addProxyToConfig(proxy) {
        this.config.outbounds.push(proxy);
    }

    addAutoSelectGroup(proxyList) {
        this.config.outbounds.unshift({
            type: "urltest",
            tag: t('outboundNames.Auto Select'),
            outbounds: DeepCopy(proxyList),
        });
    }

    addNodeSelectGroup(proxyList) {
        // Note: sing-box 1.12 removed the `block` outbound, so REJECT is no longer
        // offered as a selector option (rejection is a route action in 1.12+).
        proxyList.unshift('DIRECT', t('outboundNames.Auto Select'));
        this.config.outbounds.unshift({
            type: "selector",
            tag: t('outboundNames.Node Select'),
            outbounds: proxyList
        });
    }

    addOutboundGroups(outbounds, proxyList) {
        outbounds.forEach(outbound => {
            if (outbound !== t('outboundNames.Node Select')) {
                this.config.outbounds.push({
                    type: "selector",
                    tag: t(`outboundNames.${outbound}`),
                    outbounds: [t('outboundNames.Node Select'), ...proxyList]
                });
            }
        });
    }

    addCustomRuleGroups(proxyList) {
        if (Array.isArray(this.customRules)) {
            this.customRules.forEach(rule => {
                this.config.outbounds.push({
                    type: "selector",
                    tag: rule.name,
                    outbounds: [t('outboundNames.Node Select'), ...proxyList]
                });
            });
        }
    }

    addFallBackGroup(proxyList) {
        this.config.outbounds.push({
            type: "selector",
            tag: t('outboundNames.Fall Back'),
            outbounds: [t('outboundNames.Node Select'), ...proxyList]
        });
    }

    formatConfig() {
        const rules = generateRules(this.selectedRules, this.customRules);
        const providerRules = this.getInlineProviderRules();
        const { site_rule_sets, ip_rule_sets } = generateRuleSets(this.selectedRules, this.customRules, this.proxyEnabled, this.proxyUrl);

        this.config.route.rule_set = [...site_rule_sets, ...ip_rule_sets];

        [...rules, ...providerRules].forEach(rule => {
            const domainSuffix = (rule.domain_suffix || []).filter(value => value && value.trim() !== '');
            const domainKeyword = (rule.domain_keyword || []).filter(value => value && value.trim() !== '');
            // Skip rules with no conditions — they would match ALL traffic.
            if (domainSuffix.length === 0 && domainKeyword.length === 0) {
                return;
            }

            const routeRule = { outbound: t(`outboundNames.${rule.outbound}`) };
            if (domainSuffix.length > 0) {
                routeRule.domain_suffix = domainSuffix;
            }
            if (domainKeyword.length > 0) {
                routeRule.domain_keyword = domainKeyword;
            }
            if (Array.isArray(rule.protocol) && rule.protocol.length > 0) {
                routeRule.protocol = rule.protocol;
            }
            this.config.route.rules.push(routeRule);
        });

        rules.filter(rule => !!rule.site_rules[0]).map(rule => {
            this.config.route.rules.push({
                rule_set: [
                ...(rule.site_rules.length > 0 && rule.site_rules[0] !== '' ? rule.site_rules : []),
                ],
                protocol: rule.protocol,
                outbound: t(`outboundNames.${rule.outbound}`)
            });
        });

        rules.filter(rule => !!rule.ip_rules[0]).map(rule => {
            this.config.route.rules.push({
                rule_set: [
                ...(rule.ip_rules.filter(ip => ip.trim() !== '').map(ip => `${ip}-ip`))
                ],
                protocol: rule.protocol,
                outbound: t(`outboundNames.${rule.outbound}`)
          });
        });

        [...rules, ...providerRules].forEach(rule => {
            const ipCidr = (rule.ip_cidr || []).filter(value => value && value.trim() !== '');
            // Skip rules with no conditions — they would match ALL traffic.
            if (ipCidr.length === 0) {
                return;
            }

            const routeRule = {
                ip_cidr: ipCidr,
                outbound: t(`outboundNames.${rule.outbound}`),
            };
            if (Array.isArray(rule.protocol) && rule.protocol.length > 0) {
                routeRule.protocol = rule.protocol;
            }
            this.config.route.rules.push(routeRule);
        });

        this.config.route.rules.unshift(
            { action: 'sniff' },
            { protocol: 'dns', action: 'hijack-dns' },
            { clash_mode: 'direct', outbound: 'DIRECT' },
            { clash_mode: 'global', outbound: t('outboundNames.Node Select') }
        );

        this.config.route.auto_detect_interface = true;
        this.config.route.final = t('outboundNames.Fall Back');

        return this.config;
    }
}
