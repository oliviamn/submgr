import { ProxyParser } from './ProxyParsers.js';
import { serializeProxy } from './ProxySerializers.js';

export const PROXY_NODES_INDEX_KEY = 'proxy_nodes_index';

function hashString(input = '') {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

export function createProxyNodeId(proxyNode = {}, rawValue = '') {
  const stableValue = rawValue || JSON.stringify({
    tag: proxyNode.tag,
    type: proxyNode.type,
    server: proxyNode.server,
    server_port: proxyNode.server_port,
    uuid: proxyNode.uuid,
    password: proxyNode.password,
  });

  return `proxy_${hashString(stableValue)}`;
}

async function readProxyNodesIndex(env) {
  const rawIndex = await env.SUBMGR_KV.get(PROXY_NODES_INDEX_KEY);
  if (!rawIndex) {
    return { proxyNodes: [] };
  }

  try {
    const parsed = JSON.parse(rawIndex);
    return {
      proxyNodes: Array.isArray(parsed.proxyNodes) ? parsed.proxyNodes : [],
    };
  } catch (error) {
    return { proxyNodes: [] };
  }
}

async function writeProxyNodesIndex(env, index) {
  await env.SUBMGR_KV.put(PROXY_NODES_INDEX_KEY, JSON.stringify(index));
}

export async function getProxyNode(env, proxyNodeId) {
  const rawValue = await env.SUBMGR_KV.get(proxyNodeId);
  if (!rawValue) {
    return null;
  }

  return JSON.parse(rawValue);
}

export async function listProxyNodes(env, ids = []) {
  if (ids.length > 0) {
    const proxyNodes = await Promise.all(ids.map(id => getProxyNode(env, id)));
    return proxyNodes.filter(Boolean);
  }

  const index = await readProxyNodesIndex(env);
  const proxyNodes = await Promise.all(
    index.proxyNodes.map(item => getProxyNode(env, item.id))
  );

  return proxyNodes.filter(Boolean);
}

export async function saveProxyNode(env, proxyNode, rawValue = '') {
  const id = proxyNode.id || createProxyNodeId(proxyNode, rawValue);
  const existingProxyNode = await getProxyNode(env, id);
  const savedProxyNode = {
    ...existingProxyNode,
    ...proxyNode,
    id,
    rawValue: rawValue || proxyNode.rawValue || existingProxyNode?.rawValue || '',
    updatedAt: new Date().toISOString(),
  };

  await env.SUBMGR_KV.put(id, JSON.stringify(savedProxyNode));

  const index = await readProxyNodesIndex(env);
  const summary = {
    id,
    tag: savedProxyNode.tag,
    type: savedProxyNode.type,
    server: savedProxyNode.server,
    updatedAt: savedProxyNode.updatedAt,
  };

  const existingIndex = index.proxyNodes.findIndex(item => item.id === id);
  if (existingIndex >= 0) {
    index.proxyNodes[existingIndex] = summary;
  } else {
    index.proxyNodes.push(summary);
  }

  await writeProxyNodesIndex(env, index);
  return savedProxyNode;
}

export async function saveProxyNodesFromContent(env, content, userAgent = 'curl/7.74.0') {
  const lines = String(content || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const savedProxyNodes = [];

  for (const line of lines) {
    const parsedProxy = await ProxyParser.parse(line, userAgent);
    if (parsedProxy && !Array.isArray(parsedProxy)) {
      savedProxyNodes.push(await saveProxyNode(env, parsedProxy, line));
    }
  }

  return savedProxyNodes;
}

export async function deleteProxyNode(env, proxyNodeId) {
  await env.SUBMGR_KV.delete(proxyNodeId);

  const index = await readProxyNodesIndex(env);
  index.proxyNodes = index.proxyNodes.filter(item => item.id !== proxyNodeId);
  await writeProxyNodesIndex(env, index);
}

export async function cloneProxyNode(env, proxyNodeId, options = {}) {
  const existingProxyNode = await getProxyNode(env, proxyNodeId);
  if (!existingProxyNode) {
    return null;
  }

  const clonedProxyNode = JSON.parse(JSON.stringify(existingProxyNode));
  delete clonedProxyNode.id;
  delete clonedProxyNode.updatedAt;

  const baseTag = String(clonedProxyNode.tag || '')
    .replace(/\s*\(copy(?:\s*\d+)?\)\s*$/i, '')
    .trim();
  const tagPrefix = baseTag ? `${baseTag} ` : '';

  // The node id is derived from rawValue, so a clone must get a distinct name
  // (and regenerated URL). If the plain "(copy)" suffix collides with an
  // existing id (e.g. cloning an existing copy), bump a counter.
  let candidate = { ...clonedProxyNode };
  let rawValue = '';
  let id = null;
  let copyIndex = 1;

  while (id === null || await env.SUBMGR_KV.get(id) !== null) {
    const explicitTag = options.tag && copyIndex === 1
      ? String(options.tag).trim()
      : '';
    candidate.tag = explicitTag || `${tagPrefix}(copy${copyIndex > 1 ? ` ${copyIndex}` : ''})`;
    rawValue = serializeProxy(candidate) || candidate.rawValue || '';
    id = createProxyNodeId(candidate, rawValue);
    copyIndex += 1;
  }

  return saveProxyNode(env, candidate, rawValue);
}
