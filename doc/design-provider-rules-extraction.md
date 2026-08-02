# Design: Provider Rule Sets Extraction & Persistence

## Problem Statement

The current traffic routing rules in submgr are **statically defined** in `app/lib/config.js` (`UNIFIED_RULES`). These rules depend on community-maintained geosite/geoip rule sets from third-party GitHub repositories. Over time, these external rule set URLs can become stale, outdated, or misaligned with actual network requirements.

Meanwhile, **subscription providers** actively monitor and maintain their own traffic rules. When a user enables features like "Netflix" or "Hulu" in a provider's management console, the provider embeds up-to-date routing rules into the subscription response. These provider-curated rules are higher quality because:

1. Providers have commercial incentive to keep rules current
2. Providers monitor domain/IP changes for streaming services, AI platforms, etc.
3. Rules are tested against real traffic by the provider's user base

**Currently, submgr discards all of this** — the subscription fetch pipeline only extracts proxy nodes (ss://, vmess://, vless://, etc.) and throws away any embedded rules.

## Current Architecture (What Happens Today)

### Subscription Fetch Flow

```
User adds subscription URL
        │
        ▼
POST /api/subscription  (route.js)
        │
        ▼
fetchSubscription(url)  (subscriptionFetcher.js)
        │
        ▼
Response text (base64-encoded proxy URIs)
        │
        ▼
atob() decode → split by \n → ProxyParser.parse(line)
        │
        ▼
Array of proxy objects  ──► Stored in KV as sub_{shortCode}_{hash}
        │
        ▼
Rules from provider?  ──► DISCARDED
```

### What Providers Actually Return

Providers return different formats depending on User-Agent:

**Surge UA** → Full Surge config:
```ini
[Proxy]
NodeA = ss, 1.2.3.4, 443, ...
NodeB = vmess, 5.6.7.8, 8080, ...

[Proxy Group]
Netflix = select, NodeA, NodeB
Streaming = select, NodeA, NodeB

[Rule]
RULE-SET,https://provider.com/rules/netflix.list,Netflix
RULE-SET,https://provider.com/rules/hulu.list,Streaming
DOMAIN-SUFFIX,netflix.com,Netflix
DOMAIN-SUFFIX,nflxvideo.net,Netflix
IP-CIDR,23.246.0.0/18,Netflix,no-resolve
FINAL,DIRECT
```

**Clash UA** → Full Clash YAML:
```yaml
proxies:
  - {name: NodeA, type: ss, ...}
rules:
  - RULE-SET,netflix,Netflix
  - DOMAIN-SUFFIX,netflix.com,Netflix
rule-providers:
  netflix:
    type: http
    url: https://provider.com/rules/netflix.yaml
    behavior: domain
    interval: 86400
```

**Default/curl UA** → Base64-encoded proxy URI list (current behavior):
```
c3M6Ly8uLi4Kdm1lc3M6Ly8uLi4K  (base64)
→ ss://...
   vmess://...
```

### Current Rule System

Rules are defined statically in `config.js`:
- `UNIFIED_RULES` — 18 predefined rule categories (Ad Block, AI Services, Netflix→Streaming, etc.)
- Each rule maps to geosite/geoip rule set files hosted on GitHub
- `PREDEFINED_RULE_SETS` — 3 presets (minimal, balanced, comprehensive)
- `customRules` — user-defined rules with manual domain/IP entries

Rule set URLs are hardcoded to specific GitHub repos:
- Sing-box: `raw.githubusercontent.com/lyc8503/sing-box-rules/...`
- Clash: `github.com/MetaCubeX/meta-rules-dat/...`
- Surge: `github.com/NSZA156/surge-geox-rules/...`

## Proposed Solution

### Core Idea

**Extract and persist traffic rules when fetching subscriptions.** Store them as independent, reusable "Provider Rule Sets" in KV, decoupled from any session. Any configuration session can reference these saved rule sets.

### Key Design Decisions

#### 1. Fetch Strategy: Use Client-Specific User-Agents

To get rules from providers, we need to request with a client-specific User-Agent (e.g., Surge UA) instead of `curl/7.74.0`. The provider will return a full configuration with embedded rules.

**Approach**: When a subscription is added, perform **two fetches**:
- **Primary fetch** (existing): Use default UA → get proxy nodes (base64 URI list)
- **Rules fetch** (new): Use Surge or Clash UA → get full config with rules

Why Surge UA as the default for rules extraction:
- Surge config format is the simplest to parse (INI-style, line-based)
- Most providers support Surge format
- Rules are explicit (`RULE-SET`, `DOMAIN-SUFFIX`, `IP-CIDR`, etc.)
- Easy to normalize into a cross-client format

Alternatively, if the primary fetch already returns a structured config (Surge/Clash format detected), we extract rules from that response directly — no second fetch needed.

#### 2. Storage Model: Provider Rule Sets in KV

```
KV Key Pattern: ruleset_{name}_{hash}

Example:
  ruleset_Netflix_a3f2b1    → { rules for Netflix from provider }
  ruleset_OpenAI_7c9d4e     → { rules for AI services from provider }
```

Each stored rule set:
```json
{
  "name": "Netflix",
  "version": 1,
  "source": {
    "subscriptionUrl": "https://provider.com/sub/abc123",
    "providerName": "MyProvider",
    "fetchedAt": "2026-04-21T01:00:00Z",
    "userAgent": "Surge/5.0"
  },
  "rules": {
    "domain_suffix": ["netflix.com", "nflxvideo.net", "nflxso.net"],
    "domain_keyword": ["netflix"],
    "ip_cidr": ["23.246.0.0/18", "37.77.184.0/21"],
    "rule_set_urls": {
      "surge": "https://provider.com/rules/netflix.list",
      "clash": "https://provider.com/rules/netflix.yaml"
    }
  },
  "outbound": "Netflix",
  "updatedAt": "2026-04-21T01:00:00Z"
}
```

**KV Index** — A manifest listing all saved rule sets:
```
KV Key: rulesets_index

{
  "rulesets": [
    { "id": "ruleset_Netflix_a3f2b1", "name": "Netflix", "source": "MyProvider", "updatedAt": "..." },
    { "id": "ruleset_OpenAI_7c9d4e", "name": "OpenAI", "source": "MyProvider", "updatedAt": "..." }
  ]
}
```

#### 3. Rule Extraction Pipeline

```
Subscription Response (Surge/Clash format detected)
        │
        ▼
ProviderRuleParser.detect(responseText)
        │
        ├── Surge format? → parseSurgeRules(text)
        ├── Clash format? → parseClashRules(text)
        └── Base64 URIs?  → skip (no rules to extract)
        │
        ▼
Normalized Rule Set Array:
[
  { name: "Netflix",  domain_suffix: [...], ip_cidr: [...], rule_set_urls: {...} },
  { name: "OpenAI",   domain_suffix: [...], ip_cidr: [...], rule_set_urls: {...} },
  ...
]
        │
        ▼
Deduplicate & Merge with existing saved rule sets
        │
        ▼
Store each rule set in KV (ruleset_{name}_{hash})
Update rulesets_index
```

#### 4. Integration with Config Builders

When generating a config, the user can select from:

1. **Built-in rules** (existing `UNIFIED_RULES`) — static, community-maintained
2. **Provider rule sets** (new) — extracted from subscriptions, provider-maintained
3. **Custom rules** (existing) — user-defined

Provider rule sets should be usable in two modes:

- **URL mode** (preferred): Use the provider's `rule_set_urls` directly in the generated config. This means the client (Surge/Clash/Sing-box) fetches rules directly from the provider — always up to date.
- **Inline mode** (fallback): Embed the extracted `domain_suffix`, `ip_cidr`, etc. directly into the config. Used when provider URLs are not available.

### API Design

#### New Endpoints

```
GET  /api/rulesets                  → List all saved provider rule sets
POST /api/rulesets                  → Manually create/import a rule set
GET  /api/rulesets/:id              → Get a specific rule set
PUT  /api/rulesets/:id              → Update a rule set
DELETE /api/rulesets/:id            → Delete a rule set
POST /api/rulesets/extract          → Extract rules from a subscription URL (one-off)
```

#### Modified Endpoints

```
POST /api/subscription              → Enhanced: also extract & save rules
PUT  /api/subscription/:subId       → Enhanced: also refresh rules on subscription refresh
```

### New Module: `ProviderRuleParser`

Location: `app/lib/ProviderRuleParser.js`

```
ProviderRuleParser
├── detect(text)                    → 'surge' | 'clash' | 'singbox' | 'base64' | 'unknown'
├── parseSurgeConfig(text)          → { proxies: [...], rules: [...], ruleGroups: [...] }
├── parseClashConfig(text)          → { proxies: [...], rules: [...], ruleProviders: {...} }
├── extractRuleSets(parsedConfig)   → NormalizedRuleSet[]
└── normalizeRuleName(rawName)      → string  (e.g., "🎬 Netflix" → "Netflix")
```

**Surge Rule Parsing Logic:**
```
[Rule] section lines:
  RULE-SET,<url>,<outbound>        → capture url + outbound name
  DOMAIN-SUFFIX,<domain>,<outbound> → capture domain + outbound name
  DOMAIN-KEYWORD,<kw>,<outbound>    → capture keyword + outbound name
  IP-CIDR,<cidr>,<outbound>         → capture cidr + outbound name
  FINAL,<outbound>                  → skip (not a rule set)

Group by outbound name → one NormalizedRuleSet per outbound
```

**Clash Rule Parsing Logic:**
```
rules: section:
  - RULE-SET,<provider-name>,<outbound>
  - DOMAIN-SUFFIX,<domain>,<outbound>
  - IP-CIDR,<cidr>,<outbound>

rule-providers: section:
  <provider-name>:
    url: <url>
    behavior: domain | ipcidr

Cross-reference rules ↔ rule-providers to get URLs
Group by outbound name → one NormalizedRuleSet per outbound
```

### Data Flow: End-to-End

```
┌─────────────────────────────────────────────────────────────┐
│  User adds subscription URL                                  │
│  (SubscriptionManager component)                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  POST /api/subscription                                      │
│                                                              │
│  1. Fetch with default UA → extract proxies (existing)       │
│  2. Fetch with Surge UA   → extract rules   (NEW)            │
│     └── OR detect if response already has rules              │
│  3. Store proxies in KV   (existing: sub_{shortCode}_{hash}) │
│  4. Store rules in KV     (NEW: ruleset_{name}_{hash})       │
│  5. Update rulesets_index (NEW)                               │
│  6. Return: { proxies, extractedRuleSets }                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  UI: RulesView shows provider rule sets alongside            │
│  built-in rules                                              │
│                                                              │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐      │
│  │  Built-in     │  │  Provider      │  │  Custom       │     │
│  │  ☑ Ad Block   │  │  ☑ Netflix     │  │  ☑ MyRule     │     │
│  │  ☑ AI Svcs    │  │  ☑ OpenAI      │  │               │     │
│  │  ☐ Streaming  │  │  ☑ Disney+     │  │               │     │
│  │  ...          │  │  ☑ Spotify     │  │               │     │
│  └──────────────┘  └───────────────┘  └──────────────┘      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Convert (ConverterView)                                     │
│                                                              │
│  ConfigBuilder receives:                                     │
│    - selectedRules      (built-in)                           │
│    - providerRuleSets   (NEW — from KV)                      │
│    - customRules        (existing)                           │
│                                                              │
│  For each provider rule set:                                 │
│    - Surge:   use provider's RULE-SET URL directly           │
│    - Clash:   use provider's rule-provider URL directly      │
│    - Singbox: convert to sing-box rule_set format            │
└─────────────────────────────────────────────────────────────┘
```

### UI Changes

#### RulesView Enhancement

Add a new section: **"Provider Rule Sets"** between the preset selector and custom rules.

```
┌─────────────────────────────────────────────┐
│  Routing Rules                               │
│                                              │
│  [Rule Preset ▼ Balanced (Recommended)]      │
│                                              │
│  ☑ Ad Block  ☑ Google  ☑ AI Services  ...    │  ← Built-in (existing)
│                                              │
├─────────────────────────────────────────────┤
│  Provider Rule Sets              [Refresh ↻] │  ← NEW section
│                                              │
│  From: MyProvider (fetched 2h ago)           │
│  ☑ Netflix  ☑ Disney+  ☑ OpenAI  ☑ Spotify  │
│  ☐ Hulu     ☐ HBO                            │
│                                              │
│  These rules are maintained by your          │
│  subscription provider and updated           │
│  automatically when you refresh.             │
├─────────────────────────────────────────────┤
│  Advanced Proxy Settings         [Toggle]    │  ← Existing
├─────────────────────────────────────────────┤
│  Custom Rules                    [+ Add]     │  ← Existing
└─────────────────────────────────────────────┘
```

#### SubscriptionView Enhancement

After fetching a subscription, show extracted rules count:

```
Subscription (12 nodes)
  └── 6 rule sets extracted: Netflix, Disney+, OpenAI, Spotify, Hulu, HBO
```

### Implementation Plan

#### Phase 1: Rule Extraction Core
1. Create `ProviderRuleParser.js` — format detection + Surge/Clash parsing
2. Create `app/lib/providerRuleStore.js` — KV read/write helpers for rule sets
3. Unit-test the parser against real provider responses

#### Phase 2: API Integration
4. Create `/api/rulesets` CRUD endpoints
5. Modify `POST /api/subscription` — after fetching proxies, attempt rule extraction
6. Modify `PUT /api/subscription/:subId` — refresh rules on subscription refresh

#### Phase 3: Config Builder Integration
7. Extend `BaseConfigBuilder` to accept `providerRuleSets` parameter
8. Update `SurgeConfigBuilder.formatConfig()` — inject provider RULE-SET URLs
9. Update `ClashConfigBuilder.formatConfig()` — inject provider rule-providers
10. Update `SingboxConfigBuilder.formatConfig()` — inject provider rule_sets

#### Phase 4: UI
11. Add `providerRuleSets` state to `DashboardContext`
12. Create "Provider Rule Sets" section in `RulesView`
13. Update `SubscriptionView` to show extracted rules info
14. Update `ConverterView` to pass provider rule sets to builders

#### Phase 5: Refresh & Lifecycle
15. "Refresh Rules" action — re-fetch subscription and update rule sets
16. Stale indicator — show when rules were last updated
17. Conflict resolution — when multiple providers define the same rule name (e.g., both have "Netflix"), allow user to pick which one to use or merge them

### Edge Cases & Considerations

| Concern | Decision |
|---------|----------|
| Provider returns base64 only (no rules) | Gracefully skip — rules extraction is best-effort |
| Provider uses emoji/CJK in outbound names (e.g., "🎬 奈飞") | Normalize: strip emoji, translate known CJK names |
| Two providers both define "Netflix" rules | Store both with provider prefix; let user choose in UI |
| Provider rule-set URL is behind auth/expires | Store inline rules as fallback; note URL may require specific client UA |
| KV size limits | Each rule set is small (<10KB). Index may grow but KV supports 25MB values |
| Rule set URL changes on refresh | Update URL in KV; old URL no longer referenced |
| Provider returns different rules for different UAs | Document that Surge UA is the canonical source; allow per-subscription UA override |

### Storage Budget

- Each `ruleset_{name}_{hash}` entry: ~1-5 KB
- `rulesets_index`: ~1-10 KB (depending on count)
- Typical provider with 10 rule categories: ~50 KB total
- Well within Cloudflare KV limits (25 MB per value, 1 GB per namespace)

### Migration Notes

- Fully backward compatible — no changes to existing rule system
- Provider rule sets are additive — users opt in by selecting them
- Existing `UNIFIED_RULES` continue to work as before
- No schema migration needed — new KV keys with new prefixes
