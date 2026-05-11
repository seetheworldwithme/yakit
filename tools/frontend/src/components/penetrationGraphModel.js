export function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0";
  const abs = Math.abs(num);
  if (abs >= 100000000) return `${(num / 100000000).toFixed(2)}亿`;
  if (abs >= 10000) return `${(num / 10000).toFixed(2)}万`;
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function edgeSort(a, b) {
  const av = Math.abs(toNumber(a.value));
  const bv = Math.abs(toNumber(b.value));
  if (av !== bv) return bv - av;
  return toNumber(b.count) - toNumber(a.count);
}

function selectFocusID(nodes, preferredID) {
  const normalized = String(preferredID || "");
  if (normalized && nodes.some((n) => String(n.id) === normalized)) {
    return normalized;
  }
  const roots = nodes.filter((n) => toNumber(n.depth, -1) === 0);
  const pool = roots.length > 0 ? roots : nodes;
  const sorted = pool.slice().sort((a, b) => {
    const af = toNumber(a.totalIn) + toNumber(a.totalOut);
    const bf = toNumber(b.totalIn) + toNumber(b.totalOut);
    if (af !== bf) return bf - af;
    return toNumber(b.degree) - toNumber(a.degree);
  });
  return String(sorted[0]?.id || "");
}

function buildFocusLinks(rawLinks, focusID, neighborLimit, edgeCap) {
  if (!focusID) return [];
  const inbound = rawLinks
    .filter((edge) => !edge.isBackflow && String(edge.target) === focusID)
    .sort(edgeSort)
    .slice(0, neighborLimit);
  const outbound = rawLinks
    .filter((edge) => !edge.isBackflow && String(edge.source) === focusID)
    .sort(edgeSort)
    .slice(0, neighborLimit);
  const backflow = rawLinks
    .filter(
      (edge) =>
        !!edge.isBackflow &&
        (String(edge.source) === focusID || String(edge.target) === focusID)
    )
    .sort(edgeSort)
    .slice(0, Math.max(2, Math.floor(neighborLimit / 2)));

  const nodeIDs = new Set([focusID]);
  const primary = [...inbound, ...outbound, ...backflow];
  for (const edge of primary) {
    nodeIDs.add(String(edge.source));
    nodeIDs.add(String(edge.target));
  }

  const secondary = rawLinks
    .filter((edge) => nodeIDs.has(String(edge.source)) && nodeIDs.has(String(edge.target)))
    .sort(edgeSort)
    .slice(0, Math.max(neighborLimit * 3, 36));

  const dedup = new Map();
  for (const edge of [...primary, ...secondary]) {
    const key = `${edge.source}->${edge.target}|${edge.isBackflow ? 1 : 0}`;
    if (!dedup.has(key)) dedup.set(key, edge);
  }
  const merged = Array.from(dedup.values()).sort(edgeSort);
  if (edgeCap > 0 && merged.length > edgeCap) {
    return merged.slice(0, edgeCap);
  }
  return merged;
}

function pickTopEdges(edges, maxEdgesPerNode) {
  if (!Array.isArray(edges) || edges.length === 0) return [];
  const grouped = new Map();
  for (const edge of edges) {
    const source = String(edge.source || "");
    if (!grouped.has(source)) grouped.set(source, []);
    grouped.get(source).push(edge);
  }

  const out = [];
  for (const group of grouped.values()) {
    const normal = group.filter((edge) => !edge.isBackflow).sort(edgeSort);
    const backflows = group.filter((edge) => edge.isBackflow).sort(edgeSort);
    out.push(...normal.slice(0, Math.max(1, maxEdgesPerNode)));
    out.push(...backflows);
  }

  const dedup = new Map();
  for (const edge of out) {
    const key = `${edge.source}->${edge.target}|${edge.isBackflow ? 1 : 0}`;
    if (!dedup.has(key)) dedup.set(key, edge);
  }
  return Array.from(dedup.values());
}

function appendRootBridgeEdges(baseLinks, focusedLinks, rawNodes, edgeCap) {
  const roots = new Set(
    (rawNodes || [])
      .filter((node) => toNumber(node.depth, -1) === 0)
      .map((node) => String(node.id))
  );
  if (roots.size === 0) return focusedLinks;

  const focusedNodeIDs = new Set();
  for (const edge of focusedLinks || []) {
    focusedNodeIDs.add(String(edge.source));
    focusedNodeIDs.add(String(edge.target));
  }
  if (focusedNodeIDs.size === 0) return focusedLinks;

  const dedup = new Map();
  for (const edge of focusedLinks || []) {
    dedup.set(`${edge.source}->${edge.target}|${edge.isBackflow ? 1 : 0}`, edge);
  }

  const bridgeCandidates = (baseLinks || [])
    .filter((edge) => !edge.isBackflow)
    .filter((edge) => {
      const source = String(edge.source);
      const target = String(edge.target);
      const sourceIsRoot = roots.has(source);
      const targetIsRoot = roots.has(target);
      if (!sourceIsRoot && !targetIsRoot) return false;

      // Keep root bridge edges whenever the non-root endpoint already belongs
      // to the focused neighborhood. This prevents root nodes from appearing
      // as isolated boxes in focus mode.
      if (sourceIsRoot && targetIsRoot) {
        return focusedNodeIDs.has(source) || focusedNodeIDs.has(target);
      }
      if (sourceIsRoot) return focusedNodeIDs.has(target);
      return focusedNodeIDs.has(source);
    })
    .sort(edgeSort);

  for (const edge of bridgeCandidates) {
    const key = `${edge.source}->${edge.target}|${edge.isBackflow ? 1 : 0}`;
    if (dedup.has(key)) continue;
    dedup.set(key, edge);
    if (edgeCap > 0 && dedup.size >= edgeCap) break;
  }
  return Array.from(dedup.values()).sort(edgeSort);
}

function ensureVisibleNodes(rawNodes, nodeIDs) {
  const nodeByID = new Map();
  for (const node of rawNodes || []) {
    nodeByID.set(String(node.id), node);
  }
  const nodes = [];
  for (const id of nodeIDs) {
    const node = nodeByID.get(String(id));
    if (node) nodes.push(node);
  }
  return nodes;
}

function computeDepthMap(nodes, links) {
  const depthMap = new Map();
  let maxDepth = 0;
  for (const node of nodes) {
    const depth = toNumber(node.depth, -1);
    if (depth >= 0) {
      depthMap.set(String(node.id), depth);
      if (depth > maxDepth) maxDepth = depth;
    }
  }

  const roots = nodes.filter((node) => toNumber(node.depth, -1) === 0).map((node) => String(node.id));
  if (roots.length > 0) {
    const outgoing = new Map();
    for (const link of links) {
      if (link.isBackflow) continue;
      const source = String(link.source);
      const target = String(link.target);
      if (!outgoing.has(source)) outgoing.set(source, []);
      outgoing.get(source).push(target);
    }

    const queue = roots.map((id) => ({ id, depth: 0 }));
    const seen = new Set(roots);
    while (queue.length > 0) {
      const item = queue.shift();
      const nextNodes = outgoing.get(item.id) || [];
      for (const next of nextNodes) {
        const nextDepth = item.depth + 1;
        const current = depthMap.get(next);
        if (current == null || current > nextDepth) {
          depthMap.set(next, nextDepth);
          if (nextDepth > maxDepth) maxDepth = nextDepth;
        }
        if (!seen.has(next)) {
          seen.add(next);
          queue.push({ id: next, depth: nextDepth });
        }
      }
    }
  }

  for (const node of nodes) {
    const id = String(node.id);
    if (!depthMap.has(id)) {
      maxDepth += 1;
      depthMap.set(id, maxDepth);
    }
  }
  return depthMap;
}

export function deriveDisplayGraph(rawGraph, options = {}) {
  const minEdgeAmount = toNumber(options.minEdgeAmount, 0);
  const maxEdgesPerNode = toNumber(options.maxEdgesPerNode, 6);
  const backflowOnly = !!options.backflowOnly;
  const focusNodeID = String(options.focusNodeID || "");
  const focusMode = options.focusMode !== false;
  const focusNeighborLimit = clamp(toNumber(options.focusNeighborLimit, 8), 3, 24);
  const maxNodes = clamp(toNumber(options.maxNodes, 900), 80, 5000);
  const maxEdges = clamp(toNumber(options.maxEdges, 1400), 120, 7000);

  const rawNodes = Array.isArray(rawGraph?.nodes) ? rawGraph.nodes : [];
  const rawLinks = Array.isArray(rawGraph?.links) ? rawGraph.links : [];

  let filteredLinks = rawLinks.filter((link) => toNumber(link.value, 0) >= minEdgeAmount);
  if (backflowOnly) {
    filteredLinks = filteredLinks.filter((link) => !!link.isBackflow);
  }
  const baseLinks = filteredLinks;

  const activeFocusID = selectFocusID(rawNodes, focusNodeID);
  if (focusMode) {
    filteredLinks = buildFocusLinks(baseLinks, activeFocusID, focusNeighborLimit, maxEdges);
    filteredLinks = appendRootBridgeEdges(baseLinks, filteredLinks, rawNodes, maxEdges);
  } else {
    filteredLinks = pickTopEdges(baseLinks, maxEdgesPerNode);
  }
  if (filteredLinks.length > maxEdges) {
    filteredLinks = filteredLinks.slice().sort(edgeSort).slice(0, maxEdges);
  }

  const nodeIDs = new Set();
  for (const edge of filteredLinks) {
    nodeIDs.add(String(edge.source));
    nodeIDs.add(String(edge.target));
  }

  for (const node of rawNodes) {
    if (toNumber(node.depth, -1) === 0) {
      nodeIDs.add(String(node.id));
    }
  }
  if (activeFocusID) nodeIDs.add(activeFocusID);

  let nodes = ensureVisibleNodes(rawNodes, nodeIDs);
  if (nodes.length > maxNodes) {
    const mustKeep = new Set(
      nodes.filter((n) => toNumber(n.depth, -1) === 0).map((n) => String(n.id))
    );
    if (activeFocusID) mustKeep.add(activeFocusID);
    const ranked = nodes
      .slice()
      .sort((a, b) => {
        const am = toNumber(a.totalIn) + toNumber(a.totalOut);
        const bm = toNumber(b.totalIn) + toNumber(b.totalOut);
        if (am !== bm) return bm - am;
        return toNumber(b.degree) - toNumber(a.degree);
      });
    const keepIDs = new Set(mustKeep);
    for (const node of ranked) {
      if (keepIDs.size >= maxNodes) break;
      keepIDs.add(String(node.id));
    }
    nodes = ranked.filter((n) => keepIDs.has(String(n.id)));
  }
  const visibleNodeIDs = new Set(nodes.map((node) => String(node.id)));
  let links = filteredLinks.filter(
    (edge) => visibleNodeIDs.has(String(edge.source)) && visibleNodeIDs.has(String(edge.target))
  );
  if (links.length > maxEdges) {
    links = links.slice().sort(edgeSort).slice(0, maxEdges);
  }

  const depthMap = computeDepthMap(nodes, links);
  const columnMap = new Map();
  for (const node of nodes) {
    const id = String(node.id);
    const depth = depthMap.get(id) ?? 0;
    if (!columnMap.has(depth)) columnMap.set(depth, []);
    columnMap.get(depth).push(node);
  }

  const columns = Array.from(columnMap.keys()).sort((a, b) => a - b);
  const maxColumnSize = columns.reduce((max, depth) => Math.max(max, columnMap.get(depth).length), 0);
  const xGap = 300;
  const yGap = maxColumnSize > 10 ? 72 : 92;
  const centerY = Math.max(300, (maxColumnSize * yGap) / 2 + 60);

  const layoutNodes = [];
  for (const depth of columns) {
    const nodesInColumn = columnMap.get(depth).slice().sort((a, b) => {
      const af = toNumber(a.totalIn) + toNumber(a.totalOut);
      const bf = toNumber(b.totalIn) + toNumber(b.totalOut);
      if (af !== bf) return bf - af;
      const ad = toNumber(a.degree);
      const bd = toNumber(b.degree);
      if (ad !== bd) return bd - ad;
      return String(a.label || a.id).localeCompare(String(b.label || b.id), "zh-Hans-CN");
    });

    const total = nodesInColumn.length;
    nodesInColumn.forEach((node, idx) => {
      const id = String(node.id);
      const offset = idx - (total - 1) / 2;
      layoutNodes.push({
        ...node,
        id,
        x: 140 + depth * xGap,
        y: centerY + offset * yGap,
        depth: depthMap.get(id) ?? toNumber(node.depth, -1),
      });
    });
  }

  return { nodes: layoutNodes, links };
}

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function summarizeNodeRelations(displayGraph, nodeID) {
  const focusID = String(nodeID || "");
  if (!focusID) {
    return { inbound: [], outbound: [], backflow: [] };
  }
  const links = Array.isArray(displayGraph?.links) ? displayGraph.links : [];
  const sortByWeight = (arr) => arr.slice().sort(edgeSort);
  return {
    inbound: sortByWeight(links.filter((edge) => !edge.isBackflow && String(edge.target) === focusID)),
    outbound: sortByWeight(links.filter((edge) => !edge.isBackflow && String(edge.source) === focusID)),
    backflow: sortByWeight(
      links.filter(
        (edge) =>
          edge.isBackflow &&
          (String(edge.source) === focusID || String(edge.target) === focusID)
      )
    ),
  };
}
