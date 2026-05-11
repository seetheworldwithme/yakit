function asNum(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function buildOutgoing(links) {
  const m = new Map();
  for (const l of links) {
    const source = String(l?.source || "");
    if (!source) continue;
    if (!m.has(source)) m.set(source, []);
    m.get(source).push(l);
  }
  return m;
}

function pickRootIDs(nodes) {
  const depth0 = nodes.filter((n) => (n.depth ?? -1) === 0).map((n) => String(n.id));
  if (depth0.length) return depth0;
  let minDepth = Infinity;
  for (const n of nodes) {
    const d = n.depth ?? Infinity;
    if (d < minDepth) minDepth = d;
  }
  return nodes.filter((n) => (n.depth ?? Infinity) === minDepth).map((n) => String(n.id));
}

function aggregateTailEdge(sourceID, sourceDepth, droppedLinks, nodeByID) {
  const aggID = `__others__${sourceID}__${sourceDepth + 1}`;
  const companyCount = droppedLinks.length;
  const amount = droppedLinks.reduce((s, l) => s + asNum(l.value), 0);
  const count = droppedLinks.reduce((s, l) => s + asNum(l.count), 0);
  const goodsSet = new Set();

  for (const l of droppedLinks) {
    for (const g of l.goodsNames || []) {
      const t = String(g || "").trim();
      if (t) goodsSet.add(t);
    }
  }

  const aggNode = {
    id: aggID,
    label: `其他下游公司 (${companyCount}家)`,
    depth: sourceDepth + 1,
    totalIn: amount,
    totalOut: 0,
    degree: companyCount,
    category: "aggregate",
  };
  nodeByID.set(aggID, aggNode);

  const goodsNames = Array.from(goodsSet).slice(0, 3);
  return {
    source: sourceID,
    target: aggID,
    value: amount,
    count,
    goodsNames,
    isBackflow: false,
    label: `金额 ${amount.toFixed(2)} / 笔数 ${count}`,
    _aggregated: true,
    _aggregatedChildren: companyCount,
  };
}

export function simplifyHierarchyGraph(graph, options = {}) {
  const maxChildrenRoot = options.maxChildrenRoot ?? 8;
  const maxChildrenPerNode = options.maxChildrenPerNode ?? 4;
  const maxTotalNodes = options.maxTotalNodes ?? 55;

  const rawNodes = (graph?.nodes || []).map((n) => ({ ...n, id: String(n.id) }));
  const rawLinks = (graph?.links || []).map((l) => ({
    ...l,
    source: String(l.source),
    target: String(l.target),
    goodsNames: l.goodsNames || [],
  }));
  if (rawNodes.length === 0 || rawLinks.length === 0) {
    return { nodes: rawNodes, links: rawLinks };
  }

  const nodeByID = new Map(rawNodes.map((n) => [String(n.id), n]));
  const outgoing = buildOutgoing(rawLinks);
  const rootIDs = pickRootIDs(rawNodes);

  const keptNodeIDs = new Set(rootIDs);
  const selectedLinks = [];
  const queue = [...rootIDs];
  const expanded = new Set();

  while (queue.length > 0 && keptNodeIDs.size < maxTotalNodes) {
    const sourceID = queue.shift();
    if (expanded.has(sourceID)) continue;
    expanded.add(sourceID);

    const sourceNode = nodeByID.get(sourceID);
    if (!sourceNode) continue;
    const sourceDepth = sourceNode.depth ?? 0;

    const downstream = (outgoing.get(sourceID) || [])
      .filter((l) => {
        const tgt = nodeByID.get(l.target);
        if (!tgt) return false;
        if (l.isBackflow) return false;
        const targetDepth = tgt.depth ?? sourceDepth + 1;
        return targetDepth > sourceDepth;
      })
      .sort((a, b) => asNum(b.value) - asNum(a.value));

    if (downstream.length === 0) continue;

    const limit = sourceDepth <= 0 ? maxChildrenRoot : maxChildrenPerNode;
    const keep = downstream.slice(0, limit);
    const drop = downstream.slice(limit);

    for (const edge of keep) {
      const targetID = edge.target;
      if (!keptNodeIDs.has(targetID) && keptNodeIDs.size >= maxTotalNodes) {
        break;
      }
      keptNodeIDs.add(targetID);
      selectedLinks.push(edge);
      queue.push(targetID);
    }

    if (drop.length > 0 && keptNodeIDs.size < maxTotalNodes) {
      const aggEdge = aggregateTailEdge(sourceID, sourceDepth, drop, nodeByID);
      keptNodeIDs.add(aggEdge.target);
      selectedLinks.push(aggEdge);
    }
  }

  const keptBackflows = rawLinks
    .filter((l) => l.isBackflow && keptNodeIDs.has(l.source) && keptNodeIDs.has(l.target))
    .sort((a, b) => asNum(b.value) - asNum(a.value))
    .slice(0, 20);
  selectedLinks.push(...keptBackflows);

  const finalNodes = Array.from(keptNodeIDs)
    .map((id) => nodeByID.get(id))
    .filter(Boolean)
    .sort((a, b) => {
      const da = a.depth ?? 999;
      const db = b.depth ?? 999;
      if (da !== db) return da - db;
      return asNum(b.totalOut) - asNum(a.totalOut);
    });

  const finalNodeSet = new Set(finalNodes.map((n) => n.id));
  const finalLinks = selectedLinks.filter((l) => finalNodeSet.has(l.source) && finalNodeSet.has(l.target));

  return { nodes: finalNodes, links: finalLinks };
}

