import { GenerateWebPath } from './utils.js';

export const RULESETS_INDEX_KEY = 'rulesets_index';

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

    const normalized = {
      url: entry.url,
      noResolve: Boolean(entry.noResolve),
      behavior: entry.behavior,
      providerKey: entry.providerKey,
      interval: entry.interval,
      format: entry.format,
      path: entry.path,
    };

    const key = JSON.stringify(normalized);
    if (!seen.has(key)) {
      seen.add(key);
      results.push(normalized);
    }
  });

  return results;
}

function hashString(input = '') {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function sanitizeRuleSetName(name = '') {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'provider-rule';
}

function deriveProviderName(subscriptionUrl = '') {
  try {
    const hostname = new URL(subscriptionUrl).hostname.replace(/^www\./, '');
    return hostname.split('.')[0] || hostname;
  } catch (error) {
    return 'provider';
  }
}

function buildRuleSetId(ruleSet = {}) {
  const stableSourceKey =
    ruleSet.source?.subscriptionUrl ||
    ruleSet.source?.providerName ||
    ruleSet.source?.subscriptionId ||
    GenerateWebPath(8);

  return `ruleset_${sanitizeRuleSetName(ruleSet.name || ruleSet.outbound)}_${hashString(stableSourceKey)}`;
}

function normalizeRuleSet(ruleSet = {}, existingRuleSet = {}) {
  const safeExistingRuleSet = existingRuleSet || {};
  const mergedSource = {
    ...safeExistingRuleSet.source,
    ...ruleSet.source,
  };

  return {
    ...safeExistingRuleSet,
    ...ruleSet,
    name: ruleSet.name || ruleSet.outbound || safeExistingRuleSet.name,
    displayName: ruleSet.displayName || ruleSet.name || safeExistingRuleSet.displayName || safeExistingRuleSet.name,
    outbound: ruleSet.outbound || ruleSet.name || safeExistingRuleSet.outbound || safeExistingRuleSet.name,
    source: {
      providerName: mergedSource.providerName || deriveProviderName(mergedSource.subscriptionUrl),
      ...mergedSource,
    },
    rules: {
      domain_suffix: uniqueStrings(ruleSet.rules?.domain_suffix || safeExistingRuleSet.rules?.domain_suffix),
      domain_keyword: uniqueStrings(ruleSet.rules?.domain_keyword || safeExistingRuleSet.rules?.domain_keyword),
      ip_cidr: uniqueStrings(ruleSet.rules?.ip_cidr || safeExistingRuleSet.rules?.ip_cidr),
      protocol: uniqueStrings(ruleSet.rules?.protocol || safeExistingRuleSet.rules?.protocol),
      remote_sources: {
        surge: uniqueRemoteSources(
          ruleSet.rules?.remote_sources?.surge || safeExistingRuleSet.rules?.remote_sources?.surge
        ),
        clash: uniqueRemoteSources(
          ruleSet.rules?.remote_sources?.clash || safeExistingRuleSet.rules?.remote_sources?.clash
        ),
      },
    },
  };
}

async function readRuleSetsIndex(env) {
  const rawIndex = await env.SUBMGR_KV.get(RULESETS_INDEX_KEY);
  if (!rawIndex) {
    return { ruleSets: [] };
  }

  try {
    const parsed = JSON.parse(rawIndex);
    return {
      ruleSets: Array.isArray(parsed.ruleSets) ? parsed.ruleSets : [],
    };
  } catch (error) {
    return { ruleSets: [] };
  }
}

async function writeRuleSetsIndex(env, index) {
  await env.SUBMGR_KV.put(RULESETS_INDEX_KEY, JSON.stringify(index));
}

export async function listProviderRuleSets(env) {
  const index = await readRuleSetsIndex(env);
  const ruleSets = await Promise.all(
    index.ruleSets.map(async item => {
      const stored = await env.SUBMGR_KV.get(item.id);
      if (!stored) {
        return null;
      }

      try {
        return JSON.parse(stored);
      } catch (error) {
        return null;
      }
    })
  );

  return ruleSets
    .filter(Boolean)
    .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0));
}

export async function getProviderRuleSet(env, id) {
  const stored = await env.SUBMGR_KV.get(id);
  if (!stored) {
    return null;
  }

  return JSON.parse(stored);
}

export async function saveProviderRuleSet(env, ruleSet) {
  const id = ruleSet.id || buildRuleSetId(ruleSet);
  const existingRuleSet = await getProviderRuleSet(env, id);
  const now = new Date().toISOString();
  const normalizedRuleSet = normalizeRuleSet({
    ...ruleSet,
    id,
    version: ruleSet.version || existingRuleSet?.version || 1,
    updatedAt: now,
  }, existingRuleSet);

  await env.SUBMGR_KV.put(id, JSON.stringify(normalizedRuleSet));

  const index = await readRuleSetsIndex(env);
  const summary = {
    id,
    name: normalizedRuleSet.name,
    displayName: normalizedRuleSet.displayName,
    outbound: normalizedRuleSet.outbound,
    providerName: normalizedRuleSet.source?.providerName,
    subscriptionUrl: normalizedRuleSet.source?.subscriptionUrl,
    updatedAt: normalizedRuleSet.updatedAt,
  };

  const existingIndex = index.ruleSets.findIndex(item => item.id === id);
  if (existingIndex >= 0) {
    index.ruleSets[existingIndex] = summary;
  } else {
    index.ruleSets.push(summary);
  }

  await writeRuleSetsIndex(env, index);
  return normalizedRuleSet;
}

export async function saveProviderRuleSets(env, ruleSets = []) {
  const savedRuleSets = [];

  for (const ruleSet of ruleSets) {
    savedRuleSets.push(await saveProviderRuleSet(env, ruleSet));
  }

  return savedRuleSets;
}

export async function deleteProviderRuleSet(env, id) {
  await env.SUBMGR_KV.delete(id);

  const index = await readRuleSetsIndex(env);
  index.ruleSets = index.ruleSets.filter(item => item.id !== id);
  await writeRuleSetsIndex(env, index);
}
