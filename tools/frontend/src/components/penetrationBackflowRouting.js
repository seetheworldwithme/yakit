const ROUTING_CONSTANTS = {
  SAME_TARGET_LANE_STEP: 26,
  RIGHT_ESCAPE_BASE: 34,
  LEFT_ESCAPE_BASE: 44,
  PREV_DEPTH_CLEARANCE: 22,
  NEXT_GREEN_GUARD: 12,
  RED_TO_GREEN_MIN_GAP: 8,
  LEFT_GUARD_LANE_STEP: 24,
  LEFT_OF_NODE_CENTER_GAP: 18,
  CROSS_DEPTH_LEFT_ESCAPE: 36,
  CROSS_DEPTH_TARGET_RIGHT_GAP: 42,
};

export const BACKFLOW_ROUTING_CONSTANTS = ROUTING_CONSTANTS;

function safeDepth(node) {
  const depth = Number(node?.depth ?? -1);
  return Number.isFinite(depth) ? depth : -1;
}

function slotForRank(rank) {
  return -rank;
}

function anchorY(node, anchorIdx, h) {
  const y = Number(node?.y || 0);
  if (anchorIdx === 4 || anchorIdx === 6) return y - h * 0.3;
  if (anchorIdx === 5 || anchorIdx === 7) return y + h * 0.3;
  return y;
}

export function buildBackflowRoutingMeta(nodes, links, nodeSize) {
  const nodeByID = new Map((nodes || []).map((node) => [String(node.id), node]));
  const depthLeftX = new Map();
  const depthRightX = new Map();

  for (const node of nodes || []) {
    const depth = safeDepth(node);
    if (depth < 0) continue;
    const x = Number(node.x || 0);
    const leftX = depthLeftX.get(depth);
    const rightX = depthRightX.get(depth);
    if (leftX == null || x < leftX) depthLeftX.set(depth, x);
    if (rightX == null || x > rightX) depthRightX.set(depth, x);
  }

  const downstreamBoundaryByDepth = new Map();
  for (const [depth] of depthLeftX.entries()) {
    const nextDepthLeftCenter = depthLeftX.get(depth + 1);
    if (!Number.isFinite(nextDepthLeftCenter)) continue;
    const nextDepthLeftEdge = nextDepthLeftCenter - nodeSize.w / 2;
    downstreamBoundaryByDepth.set(
      depth,
      nextDepthLeftEdge - ROUTING_CONSTANTS.NEXT_GREEN_GUARD,
    );
  }

  const sameDepthSlotByEdgeIndex = new Map();
  const sameDepthRankByEdgeIndex = new Map();
  const sameDepthTargetGroups = new Map();

  (links || []).forEach((edge, edgeIndex) => {
    if (!edge?.isBackflow) return;
    const src = nodeByID.get(String(edge.source));
    const tgt = nodeByID.get(String(edge.target));
    if (!src || !tgt) return;
    if (String(src.id) === String(tgt.id)) return;

    const srcDepth = safeDepth(src);
    const tgtDepth = safeDepth(tgt);
    if (srcDepth < 0 || srcDepth !== tgtDepth) return;

    const key = `${srcDepth}|${String(tgt.id)}`;
    if (!sameDepthTargetGroups.has(key)) sameDepthTargetGroups.set(key, []);
    sameDepthTargetGroups.get(key).push({
      edgeIndex,
      sourceY: Number(src.y || 0),
      sourceID: String(src.id),
    });
  });

  for (const group of sameDepthTargetGroups.values()) {
    group.sort((a, b) => {
      if (a.sourceY !== b.sourceY) return a.sourceY - b.sourceY;
      return a.sourceID.localeCompare(b.sourceID);
    });
    group.forEach((item, rank) => {
      sameDepthSlotByEdgeIndex.set(item.edgeIndex, slotForRank(rank));
      sameDepthRankByEdgeIndex.set(item.edgeIndex, rank);
    });
  }

  return {
    nodeByID,
    nodeSize,
    depthLeftX,
    depthRightX,
    downstreamBoundaryByDepth,
    sameDepthSlotByEdgeIndex,
    sameDepthRankByEdgeIndex,
  };
}

export function buildBackflowEdgeModel(edge, edgeIndex, routingMeta) {
  const src = routingMeta.nodeByID.get(String(edge.source));
  const tgt = routingMeta.nodeByID.get(String(edge.target));
  if (!src || !tgt) return null;

  const srcDepth = safeDepth(src);
  const tgtDepth = safeDepth(tgt);
  const sameNode = String(src.id) === String(tgt.id);
  const sameDepth = srcDepth >= 0 && srcDepth === tgtDepth;

  if (sameNode) {
    return {
      ...edge,
      source: String(edge.source),
      target: String(edge.target),
      type: "loop",
      sourceAnchor: 1,
      targetAnchor: 1,
      loopCfg: {
        position: "right",
        dist: Math.max(34, routingMeta.nodeSize.w * 0.28),
      },
    };
  }

  const srcRight = Number(src.x) + routingMeta.nodeSize.w / 2;
  const srcLeft = Number(src.x) - routingMeta.nodeSize.w / 2;
  const tgtRight = Number(tgt.x) + routingMeta.nodeSize.w / 2;
  const tgtIsAbove = Number(src.y) < Number(tgt.y);
  const tgtAnchor = tgtIsAbove ? 4 : 5;
  const tgtAnchorY = anchorY(tgt, tgtAnchor, routingMeta.nodeSize.h);

  if (sameDepth) {
    const laneSlot = Number(routingMeta.sameDepthSlotByEdgeIndex.get(edgeIndex) ?? 0);
    const laneOffset = laneSlot * ROUTING_CONSTANTS.SAME_TARGET_LANE_STEP;
    const defaultLaneX = srcRight + ROUTING_CONSTANTS.RIGHT_ESCAPE_BASE + laneOffset;
    const downstreamBoundaryX = routingMeta.downstreamBoundaryByDepth.get(srcDepth);
    const conflictWithDownstream = Number.isFinite(downstreamBoundaryX)
      && defaultLaneX > downstreamBoundaryX - ROUTING_CONSTANTS.RED_TO_GREEN_MIN_GAP;

    if (conflictWithDownstream) {
      const laneRank = Number(routingMeta.sameDepthRankByEdgeIndex.get(edgeIndex) ?? 0);
      const prevDepthRightCenter = routingMeta.depthRightX.get(srcDepth - 1);
      const prevDepthGuard = Number.isFinite(prevDepthRightCenter)
        ? prevDepthRightCenter + routingMeta.nodeSize.w / 2 + ROUTING_CONSTANTS.PREV_DEPTH_CLEARANCE
        : Number.NEGATIVE_INFINITY;
      const leftLaneRaw = srcLeft - ROUTING_CONSTANTS.LEFT_ESCAPE_BASE + laneOffset;
      const guardWithSlot = Number.isFinite(prevDepthGuard)
        ? prevDepthGuard + laneRank * ROUTING_CONSTANTS.LEFT_GUARD_LANE_STEP
        : Number.NEGATIVE_INFINITY;
      const leftLaneCeil = Number(src.x) - ROUTING_CONSTANTS.LEFT_OF_NODE_CENTER_GAP;
      const leftLaneX = Math.min(
        Math.max(leftLaneRaw, guardWithSlot),
        leftLaneCeil,
      );
      return {
        ...edge,
        source: String(edge.source),
        target: String(edge.target),
        type: "polyline",
        sourceAnchor: 0,
        targetAnchor: 0,
        controlPoints: [
          { x: leftLaneX, y: Number(src.y) },
          { x: leftLaneX, y: Number(tgt.y) },
        ],
      };
    }

    const laneCap = Number.isFinite(downstreamBoundaryX)
      ? downstreamBoundaryX - ROUTING_CONSTANTS.RED_TO_GREEN_MIN_GAP
      : defaultLaneX + 120;
    const laneX = Math.min(defaultLaneX, laneCap);
    return {
      ...edge,
      source: String(edge.source),
      target: String(edge.target),
      type: "polyline",
      sourceAnchor: 1,
      targetAnchor: 1,
      controlPoints: [
        { x: laneX, y: Number(src.y) },
        { x: laneX, y: Number(tgt.y) },
      ],
    };
  }

  const laneLeft = Math.min(
    srcLeft - ROUTING_CONSTANTS.CROSS_DEPTH_LEFT_ESCAPE,
    tgtRight + ROUTING_CONSTANTS.CROSS_DEPTH_TARGET_RIGHT_GAP,
  );
  return {
    ...edge,
    source: String(edge.source),
    target: String(edge.target),
    type: "polyline",
    sourceAnchor: 0,
    targetAnchor: tgtAnchor,
    controlPoints: [
      { x: laneLeft, y: Number(src.y) },
      { x: laneLeft, y: tgtAnchorY },
    ],
  };
}

export function buildPenetrationEdgeStyle({ isBackflow, denseMode, lineType }) {
  const color = isBackflow ? "#e03131" : "#2f9e44";
  return {
    stroke: color,
    lineWidth: denseMode ? (isBackflow ? 1.8 : 1.3) : (isBackflow ? 2.2 : 1.8),
    lineDash: isBackflow ? [7, 4] : undefined,
    opacity: isBackflow ? 0.9 : 0.72,
    radius: lineType === "polyline" ? 16 : 0,
    offset: 22,
  };
}
