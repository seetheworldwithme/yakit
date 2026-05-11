import React, { useEffect, useRef } from "react";
import G6 from "@antv/g6";
import { Button, Empty } from "antd";

const GANG_COLORS = ["#2b7cff", "#f5222d", "#fa8c16", "#52c41a", "#722ed1", "#13c2c2", "#eb2f96", "#faad14"];
const OUTSIDE_GANG_COLOR = "#8c8c8c";

const ROLE_LABEL = {
  leader: "主犯",
  core: "骨干",
  periphery: "外围",
};

function formatAmount(value) {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 10000) {
    return `${(amount / 10000).toFixed(2)}万`;
  }
  return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function nodeColorByGang(gangId) {
  if (Number(gangId) === 0) return OUTSIDE_GANG_COLOR;
  const idx = (Number(gangId) - 1 + GANG_COLORS.length) % GANG_COLORS.length;
  return GANG_COLORS[idx];
}

function nodeSizeByDegree(node) {
  const degree = Number(node?.degree || 1);
  const base = Math.max(16, Math.min(48, degree * 3 + 10));
  if (node?.role === "leader") {
    return Math.max(40, base);
  }
  return base;
}

function goodsSummary(goodsNames) {
  const goods = Array.isArray(goodsNames) ? goodsNames.filter(Boolean) : [];
  if (goods.length === 0) return "-";
  if (goods.length === 1) return goods[0];
  return `${goods[0]}...`;
}

function edgeCurveOffset(source, target, base = 12) {
  const text = `${source}|${target}`;
  let sum = 0;
  for (let i = 0; i < text.length; i++) {
    sum += text.charCodeAt(i);
  }
  const sign = sum % 2 === 0 ? 1 : -1;
  return sign * (base + (sum % 3) * 5);
}

function buildTooltipHTML(type, model) {
  if (type === "edge") {
    const extra = Number(model?.gangId) === -1 ? `<div style="color:#8a8a8a;">跨团伙连接</div>` : "";
    return `
      <div style="min-width:250px;max-width:360px;padding:10px 12px;line-height:1.7;">
        <div style="font-size:13px;font-weight:700;color:#1f2f4d;margin-bottom:6px;">
          ${model.source} → ${model.target}
        </div>
        <div>金额: ${formatAmount(model.value || 0)}</div>
        <div>笔数: ${Number(model.count || 0)}笔</div>
        <div>购买内容: ${goodsSummary(model.goodsNames)}</div>
        ${extra}
      </div>
    `;
  }

  const gangText = Number(model?.gangId) > 0 ? `团伙${model.gangId}` : "未归属";
  const roleText = ROLE_LABEL[model?.role] || "未标注";
  return `
    <div style="min-width:250px;max-width:360px;padding:10px 12px;line-height:1.7;">
      <div style="font-size:13px;font-weight:700;color:#1f2f4d;margin-bottom:6px;">
        ${model.label || model.id}
      </div>
      <div>流入金额: ${formatAmount(model.totalIn || 0)}</div>
      <div>流出金额: ${formatAmount(model.totalOut || 0)}</div>
      <div>度数: ${Number(model.degree || 0)}</div>
      <div>介数中心性: ${Number(model.betweenness || 0).toFixed(2)}</div>
      <div>所属团伙: ${gangText}</div>
      <div>角色: ${roleText}</div>
    </div>
  `;
}

function toGraphData(rawGraph) {
  const rawNodes = Array.isArray(rawGraph?.nodes) ? rawGraph.nodes : [];
  const rawLinks = Array.isArray(rawGraph?.links) ? rawGraph.links : [];
  const undirectedPairCounts = new Map();

  for (const link of rawLinks) {
    const source = String(link.source);
    const target = String(link.target);
    const pairKey = source < target ? `${source}__${target}` : `${target}__${source}`;
    undirectedPairCounts.set(pairKey, (undirectedPairCounts.get(pairKey) || 0) + 1);
  }

  const nodes = rawNodes.map((node) => {
    const size = nodeSizeByDegree(node);
    const fillColor = nodeColorByGang(node.gangId);
    const isLeader = node.role === "leader";
    const isCore = node.role === "core";
    return {
      ...node,
      id: String(node.id),
      label: String(node.label || node.id),
      type: "circle",
      size,
      style: {
        fill: fillColor,
        stroke: isLeader ? "#111111" : "#ffffff",
        lineWidth: isLeader ? 3 : 1.4,
        shadowColor: isLeader
          ? "rgba(17,17,17,0.26)"
          : isCore
            ? "rgba(20,34,66,0.18)"
            : "rgba(20,34,66,0.12)",
        shadowBlur: isLeader ? 22 : 12,
        shadowOffsetY: isLeader ? 8 : 4,
      },
      labelCfg: {
        position: "right",
        offset: 8,
        style: {
          fill: "#2f3b57",
          fontSize: isLeader ? 13 : 11,
          fontWeight: isLeader ? 700 : 400,
          lineHeight: isLeader ? 16 : 14,
        },
      },
    };
  });

  const edges = rawLinks.map((link) => {
    const isCrossGang = Number(link.gangId) === -1;
    const source = String(link.source);
    const target = String(link.target);
    const pairKey = source < target ? `${source}__${target}` : `${target}__${source}`;
    const hasTwoWayPair = (undirectedPairCounts.get(pairKey) || 0) > 1;
    let curve = edgeCurveOffset(source, target, isCrossGang ? 14 : 10);
    if (hasTwoWayPair) {
      const magnitude = Math.abs(curve) + 8;
      curve = source < target ? magnitude : -magnitude;
    }
    const labelRefY = hasTwoWayPair ? (curve > 0 ? -12 : 12) : -10;
    const label = [`金额: ${formatAmount(link.value || 0)}`, `笔数: ${Number(link.count || 0)}笔`].join("\n");

    return {
      ...link,
      id: `${source}__${target}`,
      source,
      target,
      type: "quadratic",
      curveOffset: curve,
      _baseCurveOffset: curve,
      label,
      style: {
        stroke: isCrossGang ? "#bbb" : "#88a0d8",
        lineWidth: isCrossGang ? 1.2 : 1.4,
        lineDash: isCrossGang ? [6, 4] : undefined,
        opacity: 0.94,
        endArrow: {
          path: G6.Arrow.triangle(6, 8, 0),
          fill: isCrossGang ? "#bbb" : "#88a0d8",
          d: 0,
        },
      },
      labelCfg: {
        autoRotate: true,
        refY: labelRefY,
        style: {
          fill: "#2f3b57",
          fontSize: 9,
          lineHeight: 11,
          background: {
            fill: "rgba(255,255,255,0.96)",
            stroke: "#e7edf8",
            lineWidth: 1,
            radius: 6,
            padding: [2, 4],
          },
        },
      },
    };
  });

  return { nodes, edges };
}

function styleMinimap(container) {
  if (!container) return;
  const minimapEl = container.querySelector(".gang-minimap");
  if (!minimapEl) return;
  Object.assign(minimapEl.style, {
    position: "absolute",
    right: "12px",
    bottom: "12px",
    zIndex: "12",
    border: "1px solid #d9e3f5",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.96)",
    boxShadow: "0 6px 18px rgba(20,47,95,0.14)",
    overflow: "hidden",
    pointerEvents: "auto",
  });
}

export default function GraphView({ graph, title = "团伙画像网络图" }) {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const bundlingRef = useRef(null);
  const bundlingTimerRef = useRef(null);
  const baseDataRef = useRef({ nodes: [], edges: [] });
  const rawGraphRef = useRef(graph);
  const isDraggingNodeRef = useRef(false);

  rawGraphRef.current = graph;

  useEffect(() => {
    if (!containerRef.current || graphRef.current) return;

    const restoreBaseEdgeGeometry = (graphIns) => {
      const baseEdgeMap = new Map((baseDataRef.current.edges || []).map((edge) => [edge.id, edge]));
      graphIns.getEdges().forEach((edgeItem) => {
        const model = edgeItem.getModel();
        const base = baseEdgeMap.get(model.id);
        if (!base) return;
        if (!Array.isArray(model.controlPoints) || model.controlPoints.length === 0) return;
        graphIns.updateItem(edgeItem, {
          type: "quadratic",
          controlPoints: undefined,
          curveOffset: base._baseCurveOffset ?? base.curveOffset ?? 0,
        });
      });
      graphIns.paint();
    };

    const runBundling = (graphIns) => {
      if (isDraggingNodeRef.current) return;
      const latest = graphIns.save();
      if (!latest?.edges || latest.edges.length < 45) return;
      try {
        bundlingRef.current?.bundling({
          nodes: latest.nodes,
          edges: latest.edges,
        });
      } catch (err) {
        // keep rendering even if bundling fails on small/degenerate data
      }
    };

    const tooltip = new G6.Tooltip({
      offsetX: 10,
      offsetY: 10,
      itemTypes: ["node", "edge"],
      getContent: (evt) => {
        const model = evt?.item?.getModel?.() || {};
        const type = evt?.item?.getType?.() || "";
        const div = document.createElement("div");
        div.style.background = "rgba(255,255,255,0.98)";
        div.style.border = "1px solid #dce6fa";
        div.style.borderRadius = "10px";
        div.style.boxShadow = "0 8px 20px rgba(17,39,81,0.14)";
        div.innerHTML = buildTooltipHTML(type, model);
        return div;
      },
    });

    const minimap = new G6.Minimap({
      className: "gang-minimap",
      size: [200, 130],
      type: "keyShape",
    });

    const bundling = new G6.Bundling({
      bundleThreshold: 0.62,
      cycles: 4,
      iterations: 40,
      K: 0.08,
      lambda: 0.08,
      divisions: 1,
      divRate: 2,
      iterRate: 0.66,
    });
    bundlingRef.current = bundling;

    const graphIns = new G6.Graph({
      container: containerRef.current,
      renderer: "svg",
      width: containerRef.current.clientWidth || 960,
      height: containerRef.current.clientHeight || 720,
      fitView: true,
      fitViewPadding: [24, 28, 24, 24],
      animate: false,
      layout: {
        type: "force",
        preventOverlap: true,
        nodeSpacing: 8,
        alphaDecay: 0.05,
        linkDistance: (edge) => (Number(edge?.gangId) === -1 ? 170 : 130),
        nodeStrength: (node) => (node?.role === "leader" ? -450 : -280),
        edgeStrength: 0.08,
        collideStrength: 0.85,
      },
      defaultNode: {
        type: "circle",
      },
      defaultEdge: {
        type: "quadratic",
      },
      nodeStateStyles: {
        active: {
          opacity: 1,
          shadowBlur: 20,
        },
        inactive: {
          opacity: 0.14,
        },
      },
      edgeStateStyles: {
        active: {
          opacity: 1,
          lineWidth: 2.2,
        },
        inactive: {
          opacity: 0.08,
        },
      },
      modes: {
        default: [
          {
            type: "drag-canvas",
            enableOptimize: true,
          },
          {
            type: "zoom-canvas",
            enableOptimize: true,
          },
          "drag-node",
          {
            type: "activate-relations",
            trigger: "mouseenter",
            activeState: "active",
            inactiveState: "inactive",
          },
        ],
      },
      plugins: [tooltip, minimap, bundling],
    });

    graphIns.on("afterrender", () => styleMinimap(containerRef.current));
    graphIns.on("afterlayout", () => {
      if (bundlingTimerRef.current) {
        clearTimeout(bundlingTimerRef.current);
      }
      bundlingTimerRef.current = setTimeout(() => runBundling(graphIns), 120);
    });

    graphIns.on("node:dragstart", (evt) => {
      isDraggingNodeRef.current = true;
      restoreBaseEdgeGeometry(graphIns);
      const model = evt?.item?.getModel?.();
      if (model) {
        model.fx = evt.x;
        model.fy = evt.y;
      }
    });
    graphIns.on("node:drag", (evt) => {
      const model = evt?.item?.getModel?.();
      if (model) {
        model.fx = evt.x;
        model.fy = evt.y;
      }
      graphIns.refreshPositions();
    });
    graphIns.on("node:dragend", (evt) => {
      const model = evt?.item?.getModel?.();
      if (model) {
        model.fx = null;
        model.fy = null;
      }
      isDraggingNodeRef.current = false;
      if (bundlingTimerRef.current) {
        clearTimeout(bundlingTimerRef.current);
      }
      bundlingTimerRef.current = setTimeout(() => runBundling(graphIns), 120);
    });

    graphRef.current = graphIns;

    const onResize = () => {
      if (!containerRef.current || !graphRef.current) return;
      graphRef.current.changeSize(
        containerRef.current.clientWidth || 960,
        containerRef.current.clientHeight || 720
      );
      graphRef.current.fitView(24);
      styleMinimap(containerRef.current);
    };
    window.addEventListener("resize", onResize);
    setTimeout(() => styleMinimap(containerRef.current), 0);

    return () => {
      if (bundlingTimerRef.current) {
        clearTimeout(bundlingTimerRef.current);
      }
      window.removeEventListener("resize", onResize);
      graphIns.destroy();
      graphRef.current = null;
      bundlingRef.current = null;
      bundlingTimerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const graphIns = graphRef.current;
    if (!graphIns) return;

    const data = toGraphData(graph);
    baseDataRef.current = data;
    if (!data.nodes.length) {
      graphIns.clear();
      return;
    }

    graphIns.changeData(data);
    graphIns.fitView(24);
  }, [graph]);

  const resetToInitialGraph = () => {
    const graphIns = graphRef.current;
    if (!graphIns) return;
    isDraggingNodeRef.current = false;
    const data = toGraphData(rawGraphRef.current);
    baseDataRef.current = data;
    graphIns.changeData(data);
    graphIns.fitView(24);
  };

  if (!Array.isArray(graph?.nodes) || graph.nodes.length === 0) {
    return (
      <div
        style={{
          minHeight: 700,
          borderRadius: 12,
          border: "1px dashed #d4e0f7",
          background: "#fbfcff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Empty description="当前筛选条件下无可展示的团伙关系图" />
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: 700,
        height: 700,
        borderRadius: 12,
        border: "1px solid #dfe8fb",
        background: "#fbfcff",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 18,
          top: 16,
          zIndex: 9,
          color: "#253858",
          fontSize: 16,
          fontWeight: 600,
          pointerEvents: "none",
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          right: 16,
          top: 12,
          zIndex: 13,
        }}
      >
        <Button size="small" onClick={resetToInitialGraph}>
          还原初始图
        </Button>
      </div>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
