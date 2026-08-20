export const SESSIONS_INDEX_KEY = 'sessions_index';
export const MANAGED_SESSION_TYPES = ['raw', 'xray', 'singbox', 'clash', 'surge', 'shadowrocket'];

async function readSessionsIndex(env) {
  const rawIndex = await env.SUBMGR_KV.get(SESSIONS_INDEX_KEY);
  if (!rawIndex) {
    return { sessions: [] };
  }

  try {
    const parsed = JSON.parse(rawIndex);
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch (error) {
    return { sessions: [] };
  }
}

async function writeSessionsIndex(env, index) {
  await env.SUBMGR_KV.put(SESSIONS_INDEX_KEY, JSON.stringify(index));
}

function generateShortCode() {
  return Math.random().toString(36).substring(2, 7);
}

async function generateUniqueShortCode(env) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const shortCode = generateShortCode();
    const existing = await env.SUBMGR_KV.get(`raw_${shortCode}`);
    if (existing === null) {
      return shortCode;
    }
  }
  throw new Error('Failed to generate a unique short code');
}

export function buildManagedSessionSummary({ shortCode, rawConfig, existingSession }) {
  const normalizedConfig = rawConfig?.config || rawConfig || {};
  const rules = normalizedConfig.rules || {};
  const now = new Date().toISOString();
  const subscriptionIds = Array.isArray(rawConfig?.subscriptionIds || normalizedConfig.subscriptionIds)
    ? (rawConfig?.subscriptionIds || normalizedConfig.subscriptionIds)
    : [];
  const proxyNodeIds = Array.isArray(rawConfig?.proxyNodeIds || normalizedConfig.proxyNodeIds)
    ? (rawConfig?.proxyNodeIds || normalizedConfig.proxyNodeIds)
    : [];
  const selectedProviderRuleSetIds = Array.isArray(rules.selectedProviderRuleSetIds)
    ? rules.selectedProviderRuleSetIds
    : [];
  const remarks = normalizedConfig.remarks ?? existingSession?.remarks ?? '';
  const title = remarks || existingSession?.title || `Session ${shortCode}`;
  const createdAt = existingSession?.createdAt || normalizedConfig.configCreatedTime || rawConfig?.configCreatedTime || now;

  return {
    shortCode,
    title,
    remarks,
    createdAt,
    updatedAt: now,
    subscriptionIds,
    proxyNodeIds,
    selectedProviderRuleSetIds,
    subscriptionCount: subscriptionIds.length,
    proxyNodeCount: proxyNodeIds.length,
    ruleSetCount: selectedProviderRuleSetIds.length,
  };
}

export async function getManagedSessionSummary(env, shortCode) {
  const index = await readSessionsIndex(env);
  return index.sessions.find((session) => session.shortCode === shortCode) || null;
}

export async function listManagedSessions(env) {
  const index = await readSessionsIndex(env);
  return [...index.sessions].sort(
    (left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0)
  );
}

export async function upsertManagedSession(env, sessionSummary) {
  const existingSession = await getManagedSessionSummary(env, sessionSummary.shortCode);
  const savedSession = {
    ...existingSession,
    ...sessionSummary,
    shortCode: sessionSummary.shortCode,
    title: sessionSummary.title || existingSession?.title || `Session ${sessionSummary.shortCode}`,
    createdAt: existingSession?.createdAt || sessionSummary.createdAt || new Date().toISOString(),
    updatedAt: sessionSummary.updatedAt || new Date().toISOString(),
  };

  const index = await readSessionsIndex(env);
  const existingIndex = index.sessions.findIndex((session) => session.shortCode === savedSession.shortCode);
  if (existingIndex >= 0) {
    index.sessions[existingIndex] = savedSession;
  } else {
    index.sessions.push(savedSession);
  }

  await writeSessionsIndex(env, index);
  return savedSession;
}

export async function importManagedSessionFromShortCode(env, shortCode) {
  const rawConfig = await env.SUBMGR_KV.get(`raw_${shortCode}`);
  if (!rawConfig) {
    return null;
  }

  const parsedConfig = JSON.parse(rawConfig);
  const existingSession = await getManagedSessionSummary(env, shortCode);
  const sessionSummary = buildManagedSessionSummary({
    shortCode,
    rawConfig: parsedConfig,
    existingSession,
  });

  return upsertManagedSession(env, sessionSummary);
}

export async function deleteManagedSession(env, shortCode) {
  await Promise.all(
    MANAGED_SESSION_TYPES.map((type) => env.SUBMGR_KV.delete(`${type}_${shortCode}`))
  );

  const index = await readSessionsIndex(env);
  index.sessions = index.sessions.filter((session) => session.shortCode !== shortCode);
  await writeSessionsIndex(env, index);
}

export async function cloneManagedSession(env, sourceShortCode) {
  const rawConfig = await env.SUBMGR_KV.get(`raw_${sourceShortCode}`);
  if (rawConfig === null) {
    return null;
  }

  const parsedConfig = JSON.parse(rawConfig);
  const targetShortCode = await generateUniqueShortCode(env);
  const now = new Date().toISOString();

  // Deep-copy the recipe and refresh its creation timestamp while keeping the
  // original KV shape (nested `config` object vs flat legacy layout).
  const copiedRawConfig = JSON.parse(JSON.stringify(parsedConfig));
  if (copiedRawConfig.config) {
    copiedRawConfig.config = {
      ...copiedRawConfig.config,
      configCreatedTime: now,
    };
  } else {
    copiedRawConfig.configCreatedTime = now;
  }

  await env.SUBMGR_KV.put(`raw_${targetShortCode}`, JSON.stringify(copiedRawConfig, null, 2));

  // Copy all derived client configs (raw is handled above).
  await Promise.all(
    MANAGED_SESSION_TYPES
      .filter((type) => type !== 'raw')
      .map(async (type) => {
        const sourceValue = await env.SUBMGR_KV.get(`${type}_${sourceShortCode}`);
        if (sourceValue !== null) {
          await env.SUBMGR_KV.put(`${type}_${targetShortCode}`, sourceValue);
        }
      })
  );

  const session = await upsertManagedSession(env, buildManagedSessionSummary({
    shortCode: targetShortCode,
    rawConfig: copiedRawConfig,
    existingSession: null,
  }));

  return {
    shortCode: targetShortCode,
    session,
  };
}
