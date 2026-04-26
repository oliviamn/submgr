export const SUBSCRIPTIONS_INDEX_KEY = 'subscriptions_index';

function hashString(input = '') {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function createSubscriptionId(url, userAgent = 'curl/7.74.0', proxyUrl = '') {
  return `subsrc_${hashString(`${url}|${userAgent}|${proxyUrl}`)}`;
}

async function readSubscriptionsIndex(env) {
  const rawIndex = await env.SUBMGR_KV.get(SUBSCRIPTIONS_INDEX_KEY);
  if (!rawIndex) {
    return { subscriptions: [] };
  }

  try {
    const parsed = JSON.parse(rawIndex);
    return {
      subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
    };
  } catch (error) {
    return { subscriptions: [] };
  }
}

async function writeSubscriptionsIndex(env, index) {
  await env.SUBMGR_KV.put(SUBSCRIPTIONS_INDEX_KEY, JSON.stringify(index));
}

export function createManagedSubscriptionId({ url, userAgent, proxyUrl }) {
  return createSubscriptionId(url, userAgent, proxyUrl);
}

export async function getManagedSubscription(env, subId) {
  const rawData = await env.SUBMGR_KV.get(subId);
  if (!rawData) {
    return null;
  }

  return JSON.parse(rawData);
}

export async function listManagedSubscriptions(env, ids = []) {
  if (ids.length > 0) {
    const subscriptions = await Promise.all(ids.map(id => getManagedSubscription(env, id)));
    return subscriptions.filter(Boolean);
  }

  const index = await readSubscriptionsIndex(env);
  const subscriptions = await Promise.all(
    index.subscriptions.map(item => getManagedSubscription(env, item.subId))
  );

  return subscriptions
    .filter(Boolean)
    .sort((left, right) => new Date(right.fetchedAt || 0) - new Date(left.fetchedAt || 0));
}

export async function saveManagedSubscription(env, subscription) {
  const subId = subscription.subId || createSubscriptionId(subscription.url, subscription.userAgent, subscription.proxyUrl);
  const existingSubscription = await getManagedSubscription(env, subId);
  const savedSubscription = {
    ...existingSubscription,
    ...subscription,
    subId,
  };

  await env.SUBMGR_KV.put(subId, JSON.stringify(savedSubscription));

  const index = await readSubscriptionsIndex(env);
  const summary = {
    subId,
    url: savedSubscription.url,
    providerName: savedSubscription.providerName,
    proxyCount: savedSubscription.proxyCount,
    fetchedAt: savedSubscription.fetchedAt,
    providerRuleSetCount: savedSubscription.providerRuleSetCount || 0,
  };

  const existingIndex = index.subscriptions.findIndex(item => item.subId === subId);
  if (existingIndex >= 0) {
    index.subscriptions[existingIndex] = summary;
  } else {
    index.subscriptions.push(summary);
  }

  await writeSubscriptionsIndex(env, index);
  return savedSubscription;
}

export async function deleteManagedSubscription(env, subId) {
  await env.SUBMGR_KV.delete(subId);

  const index = await readSubscriptionsIndex(env);
  index.subscriptions = index.subscriptions.filter(item => item.subId !== subId);
  await writeSubscriptionsIndex(env, index);
}
