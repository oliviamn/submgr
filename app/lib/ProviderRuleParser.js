import yaml from 'js-yaml';

const OUTBOUND_ALIAS_MAP = new Map([
  ['奈飞', 'Netflix'],
  ['网飞', 'Netflix'],
  ['迪士尼', 'Disney+'],
  ['油管', 'Youtube'],
  ['谷歌', 'Google'],
  ['微软', 'Microsoft'],
  ['苹果', 'Apple'],
  ['电报', 'Telegram'],
  ['流媒体', 'Streaming'],
  ['游戏', 'Gaming'],
  ['社交媒体', 'Social Media'],
  ['云服务', 'Cloud Services'],
  ['教育', 'Education'],
  ['金融', 'Financial'],
  ['广告拦截', 'Ad Block'],
]);

const SECTION_HEADER_REGEX = /^\[(.+)\]$/;

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      values
        .filter(value => typeof value === 'string')
        .map(value => value.trim())
        .filter(Boolean)
    )
  );
}

function uniqueRemoteSources(entries = []) {
  const seen = new Set();
  const results = [];

  entries.forEach(entry => {
    if (!entry?.url) {
      return;
    }

    const key = JSON.stringify({
      url: entry.url,
      behavior: entry.behavior,
      noResolve: entry.noResolve,
      providerKey: entry.providerKey,
    });

    if (!seen.has(key)) {
      seen.add(key);
      results.push(entry);
    }
  });

  return results;
}

function createEmptyRuleSet(rawName, format) {
  const normalizedName = ProviderRuleParser.normalizeRuleName(rawName);

  return {
    name: normalizedName,
    displayName: rawName?.trim() || normalizedName,
    outbound: normalizedName,
    sourceFormat: format,
    rules: {
      domain_suffix: [],
      domain_keyword: [],
      ip_cidr: [],
      protocol: [],
      remote_sources: {
        surge: [],
        clash: [],
      },
    },
  };
}

function normalizeRuleSets(ruleSets = []) {
  return ruleSets
    .map(ruleSet => ({
      ...ruleSet,
      name: ProviderRuleParser.normalizeRuleName(ruleSet.name || ruleSet.outbound || ruleSet.displayName),
      displayName: ruleSet.displayName || ruleSet.name || ruleSet.outbound,
      outbound: ProviderRuleParser.normalizeRuleName(ruleSet.outbound || ruleSet.name || ruleSet.displayName),
      rules: {
        domain_suffix: uniqueStrings(ruleSet.rules?.domain_suffix),
        domain_keyword: uniqueStrings(ruleSet.rules?.domain_keyword),
        ip_cidr: uniqueStrings(ruleSet.rules?.ip_cidr),
        protocol: uniqueStrings(ruleSet.rules?.protocol),
        remote_sources: {
          surge: uniqueRemoteSources(ruleSet.rules?.remote_sources?.surge),
          clash: uniqueRemoteSources(ruleSet.rules?.remote_sources?.clash),
        },
      },
    }))
    .filter(ruleSet => {
      const hasInlineRules =
        ruleSet.rules.domain_suffix.length > 0 ||
        ruleSet.rules.domain_keyword.length > 0 ||
        ruleSet.rules.ip_cidr.length > 0 ||
        ruleSet.rules.protocol.length > 0;

      const hasRemoteRules =
        ruleSet.rules.remote_sources.surge.length > 0 ||
        ruleSet.rules.remote_sources.clash.length > 0;

      return Boolean(ruleSet.name) && (hasInlineRules || hasRemoteRules);
    });
}

export class ProviderRuleParser {
  static detect(text = '') {
    const trimmed = text.trim();

    if (!trimmed) {
      return 'unknown';
    }

    if (trimmed.includes('[Rule]') || trimmed.startsWith('#!MANAGED-CONFIG')) {
      return 'surge';
    }

    try {
      const parsedYaml = yaml.load(trimmed);
      if (parsedYaml && typeof parsedYaml === 'object') {
        if (Array.isArray(parsedYaml.rules) || parsedYaml['rule-providers']) {
          return 'clash';
        }
      }
    } catch (error) {
      // Ignore YAML parsing failures here.
    }

    const isBase64Like =
      trimmed.length > 50 &&
      /^[A-Za-z0-9+/=_-]+$/.test(trimmed) &&
      !trimmed.includes('://') &&
      !trimmed.includes('\n');

    if (isBase64Like) {
      return 'base64';
    }

    return 'unknown';
  }

  static normalizeRuleName(rawName = '') {
    const trimmed = String(rawName).trim().replace(/^["']|["']$/g, '');
    const withoutEmoji = trimmed
      .replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Symbol}\s._\-:|]+/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!withoutEmoji) {
      return trimmed || 'Provider Rule';
    }

    for (const [alias, canonical] of OUTBOUND_ALIAS_MAP.entries()) {
      if (withoutEmoji.includes(alias)) {
        return canonical;
      }
    }

    return withoutEmoji;
  }

  static parseSurgeConfig(text = '') {
    const sections = {};
    let currentSection = null;

    text.split(/\r?\n/).forEach(rawLine => {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith(';')) {
        return;
      }

      const headerMatch = line.match(SECTION_HEADER_REGEX);
      if (headerMatch) {
        currentSection = headerMatch[1].trim();
        sections[currentSection] = [];
        return;
      }

      if (currentSection) {
        sections[currentSection].push(line);
      }
    });

    return {
      format: 'surge',
      sections,
      proxies: sections.Proxy || sections.PROXY || [],
      rules: sections.Rule || sections.RULE || [],
    };
  }

  static parseClashConfig(text = '') {
    const parsed = yaml.load(text);
    return {
      format: 'clash',
      rules: Array.isArray(parsed?.rules) ? parsed.rules : [],
      ruleProviders: parsed?.['rule-providers'] || {},
      parsed,
    };
  }

  static extractRuleSets(text = '') {
    const format = this.detect(text);

    if (format === 'surge') {
      return this.extractSurgeRuleSets(this.parseSurgeConfig(text));
    }

    if (format === 'clash') {
      return this.extractClashRuleSets(this.parseClashConfig(text));
    }

    return [];
  }

  static extractProxyObjects(text = '') {
    const format = this.detect(text);

    if (format === 'surge') {
      return this.extractSurgeProxyObjects(this.parseSurgeConfig(text));
    }

    if (format === 'clash') {
      return this.extractClashProxyObjects(this.parseClashConfig(text));
    }

    return [];
  }

  static extractSurgeRuleSets(parsedConfig) {
    const ruleSets = new Map();

    parsedConfig.rules.forEach(line => {
      const segments = line.split(',').map(segment => segment.trim());
      const ruleType = segments[0]?.toUpperCase();

      if (!ruleType || ruleType === 'FINAL') {
        return;
      }

      const outboundName = segments[2];
      if (!outboundName || ['DIRECT', 'REJECT', 'REJECT-DROP'].includes(outboundName.toUpperCase())) {
        return;
      }

      const record = ruleSets.get(outboundName) || createEmptyRuleSet(outboundName, 'surge');

      switch (ruleType) {
        case 'RULE-SET':
          if (segments[1]) {
            record.rules.remote_sources.surge.push({
              url: segments[1],
              noResolve: segments.slice(3).some(item => item.toLowerCase() === 'no-resolve'),
            });
          }
          break;
        case 'DOMAIN-SUFFIX':
          if (segments[1]) {
            record.rules.domain_suffix.push(segments[1]);
          }
          break;
        case 'DOMAIN-KEYWORD':
          if (segments[1]) {
            record.rules.domain_keyword.push(segments[1]);
          }
          break;
        case 'IP-CIDR':
        case 'IP-CIDR6':
          if (segments[1]) {
            record.rules.ip_cidr.push(segments[1]);
          }
          break;
        default:
          break;
      }

      ruleSets.set(outboundName, record);
    });

    return normalizeRuleSets(Array.from(ruleSets.values()));
  }

  static extractClashRuleSets(parsedConfig) {
    const ruleSets = new Map();
    const ruleProviders = parsedConfig.ruleProviders || {};

    parsedConfig.rules.forEach(rule => {
      const line = Array.isArray(rule) ? rule.join(',') : String(rule || '').trim();
      const segments = line.split(',').map(segment => segment.trim());
      const ruleType = segments[0]?.toUpperCase();

      if (!ruleType || ruleType === 'MATCH') {
        return;
      }

      const outboundName = segments[2];
      if (!outboundName || ['DIRECT', 'REJECT'].includes(outboundName.toUpperCase())) {
        return;
      }

      const record = ruleSets.get(outboundName) || createEmptyRuleSet(outboundName, 'clash');

      switch (ruleType) {
        case 'RULE-SET': {
          const providerKey = segments[1];
          const provider = ruleProviders[providerKey];
          if (provider?.url) {
            record.rules.remote_sources.clash.push({
              providerKey,
              url: provider.url,
              behavior: provider.behavior || 'classical',
              format: provider.format || 'yaml',
              interval: provider.interval,
              path: provider.path,
              noResolve:
                provider.behavior === 'ipcidr' ||
                segments.slice(3).some(item => item.toLowerCase() === 'no-resolve'),
            });
          }
          break;
        }
        case 'DOMAIN-SUFFIX':
          if (segments[1]) {
            record.rules.domain_suffix.push(segments[1]);
          }
          break;
        case 'DOMAIN-KEYWORD':
          if (segments[1]) {
            record.rules.domain_keyword.push(segments[1]);
          }
          break;
        case 'IP-CIDR':
        case 'IP-CIDR6':
          if (segments[1]) {
            record.rules.ip_cidr.push(segments[1]);
          }
          break;
        default:
          break;
      }

      ruleSets.set(outboundName, record);
    });

    return normalizeRuleSets(Array.from(ruleSets.values()));
  }

  static extractSurgeProxyObjects(parsedConfig) {
    return parsedConfig.proxies
      .map(line => this.parseSurgeProxyLine(line))
      .filter(Boolean);
  }

  static parseSurgeProxyLine(line = '') {
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      return null;
    }

    const rawName = line.slice(0, separatorIndex);
    const rawConfig = line.slice(separatorIndex + 1);
    if (!rawName || !rawConfig) {
      return null;
    }

    const tag = rawName.trim();
    const parts = rawConfig.split(',').map(part => part.trim()).filter(Boolean);
    const type = parts[0]?.toLowerCase();

    if (!type || ['direct', 'reject', 'reject-drop'].includes(type)) {
      return null;
    }

    const server = parts[1];
    const serverPort = Number.parseInt(parts[2], 10);
    const options = {};

    parts.slice(3).forEach(part => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) {
        return;
      }
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      options[key] = value;
    });

    const tls = this.buildSurgeTlsOptions(options, type);
    const transport = this.buildSurgeTransportOptions(options);

    switch (type) {
      case 'ss':
        if (!server || Number.isNaN(serverPort) || !options.password) {
          return null;
        }
        return {
          tag,
          type: 'shadowsocks',
          server,
          server_port: serverPort,
          method: options['encrypt-method'] || options.method || 'aes-256-gcm',
          password: options.password,
          network: 'tcp',
          tcp_fast_open: false,
        };
      case 'vmess':
        if (!server || Number.isNaN(serverPort) || !options.username) {
          return null;
        }
        return {
          tag,
          type: 'vmess',
          server,
          server_port: serverPort,
          uuid: options.username,
          alter_id: options['alter-id'] ? Number.parseInt(options['alter-id'], 10) : 0,
          security: 'auto',
          network: 'tcp',
          tcp_fast_open: false,
          tls,
          transport,
        };
      case 'trojan':
        if (!server || Number.isNaN(serverPort) || !options.password) {
          return null;
        }
        return {
          tag,
          type: 'trojan',
          server,
          server_port: serverPort,
          password: options.password,
          network: 'tcp',
          tcp_fast_open: false,
          tls: tls || { enabled: true, server_name: options.sni },
          transport,
        };
      case 'hysteria2':
        if (!server || Number.isNaN(serverPort) || !options.password) {
          return null;
        }
        return {
          tag,
          type: 'hysteria2',
          server,
          server_port: serverPort,
          password: options.password,
          tls: tls || { enabled: true, server_name: options.sni },
          obfs: options.obfs ? { type: options.obfs, password: options['obfs-password'] } : {},
        };
      case 'tuic':
      case 'tuic-v5':
        if (!server || Number.isNaN(serverPort) || !options.password || !options.uuid) {
          return null;
        }
        return {
          tag,
          type,
          server,
          server_port: serverPort,
          uuid: options.uuid,
          password: options.password,
          congestion_control: options['congestion-controller'],
          udp_relay_mode: options['udp-relay-mode'],
          tls: tls || { enabled: true, server_name: options.sni, alpn: options.alpn ? options.alpn.split(',') : undefined },
        };
      default:
        return null;
    }
  }

  static buildSurgeTlsOptions(options = {}, type = '') {
    const tlsEnabled = options.tls === 'true' || Boolean(options.sni) || ['trojan', 'hysteria2', 'tuic', 'tuic-v5'].includes(type);
    if (!tlsEnabled) {
      return undefined;
    }

    return {
      enabled: true,
      server_name: options.sni,
      insecure: options['skip-cert-verify'] === 'true',
      alpn: options.alpn ? options.alpn.split(',').map(value => value.trim()).filter(Boolean) : undefined,
    };
  }

  static buildSurgeTransportOptions(options = {}) {
    if (options.ws === 'true') {
      const headers = {};
      if (options['ws-headers']) {
        const [headerName, ...headerValueParts] = options['ws-headers'].split(':');
        if (headerName && headerValueParts.length > 0) {
          headers[headerName.trim()] = headerValueParts.join(':').trim();
        }
      }

      return {
        type: 'ws',
        path: options['ws-path'],
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      };
    }

    if (options['grpc-service-name']) {
      return {
        type: 'grpc',
        service_name: options['grpc-service-name'],
      };
    }

    return undefined;
  }

  static extractClashProxyObjects(parsedConfig) {
    const proxies = Array.isArray(parsedConfig.parsed?.proxies) ? parsedConfig.parsed.proxies : [];

    return proxies
      .map(proxy => this.parseClashProxyObject(proxy))
      .filter(Boolean);
  }

  static parseClashProxyObject(proxy = {}) {
    const type = String(proxy.type || '').toLowerCase();
    const tag = proxy.name;
    const server = proxy.server;
    const serverPort = Number.parseInt(proxy.port, 10);

    if (!tag || !type || !server || Number.isNaN(serverPort)) {
      return null;
    }

    switch (type) {
      case 'ss':
        return {
          tag,
          type: 'shadowsocks',
          server,
          server_port: serverPort,
          method: proxy.cipher,
          password: proxy.password,
          network: 'tcp',
          tcp_fast_open: false,
        };
      case 'vmess':
        return {
          tag,
          type: 'vmess',
          server,
          server_port: serverPort,
          uuid: proxy.uuid,
          alter_id: Number.parseInt(proxy.alterId || 0, 10),
          security: proxy.cipher || 'auto',
          network: proxy.network || 'tcp',
          tcp_fast_open: Boolean(proxy.tfo),
          tls: proxy.tls ? {
            enabled: true,
            server_name: proxy.servername || proxy.sni,
            insecure: Boolean(proxy['skip-cert-verify']),
          } : undefined,
          transport: proxy.network === 'ws' ? {
            type: 'ws',
            path: proxy['ws-opts']?.path,
            headers: proxy['ws-opts']?.headers,
          } : proxy.network === 'grpc' ? {
            type: 'grpc',
            service_name: proxy['grpc-opts']?.['grpc-service-name'],
          } : undefined,
        };
      case 'trojan':
        return {
          tag,
          type: 'trojan',
          server,
          server_port: serverPort,
          password: proxy.password,
          network: proxy.network || 'tcp',
          tcp_fast_open: Boolean(proxy.tfo),
          tls: proxy.tls ? {
            enabled: true,
            server_name: proxy.sni || proxy.servername,
            insecure: Boolean(proxy['skip-cert-verify']),
          } : undefined,
          transport: proxy.network === 'ws' ? {
            type: 'ws',
            path: proxy['ws-opts']?.path,
            headers: proxy['ws-opts']?.headers,
          } : proxy.network === 'grpc' ? {
            type: 'grpc',
            service_name: proxy['grpc-opts']?.['grpc-service-name'],
          } : undefined,
        };
      case 'vless':
        return {
          tag,
          type: 'vless',
          server,
          server_port: serverPort,
          uuid: proxy.uuid,
          network: proxy.network || 'tcp',
          tcp_fast_open: Boolean(proxy.tfo),
          tls: proxy.tls ? {
            enabled: true,
            server_name: proxy.servername || proxy.sni,
            insecure: Boolean(proxy['skip-cert-verify']),
          } : undefined,
          transport: proxy.network === 'ws' ? {
            type: 'ws',
            path: proxy['ws-opts']?.path,
            headers: proxy['ws-opts']?.headers,
          } : proxy.network === 'grpc' ? {
            type: 'grpc',
            service_name: proxy['grpc-opts']?.['grpc-service-name'],
          } : undefined,
          flow: proxy.flow,
        };
      case 'hysteria2':
        return {
          tag,
          type: 'hysteria2',
          server,
          server_port: serverPort,
          password: proxy.password || proxy.auth,
          tls: {
            enabled: true,
            server_name: proxy.sni,
            insecure: Boolean(proxy['skip-cert-verify']),
          },
          obfs: proxy.obfs ? { type: proxy.obfs, password: proxy['obfs-password'] } : {},
        };
      case 'tuic':
        return {
          tag,
          type: 'tuic',
          server,
          server_port: serverPort,
          uuid: proxy.uuid,
          password: proxy.password,
          congestion_control: proxy['congestion-controller'],
          udp_relay_mode: proxy['udp-relay-mode'],
          tls: {
            enabled: true,
            server_name: proxy.sni,
            insecure: Boolean(proxy['skip-cert-verify']),
            alpn: Array.isArray(proxy.alpn) ? proxy.alpn : (proxy.alpn ? [proxy.alpn] : undefined),
          },
        };
      default:
        return null;
    }
  }
}
