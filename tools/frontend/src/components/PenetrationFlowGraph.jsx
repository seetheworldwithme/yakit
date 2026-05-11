import React, { useEffect, useMemo, useRef } from "react";
import G6 from "@antv/g6";
import { Empty } from "antd";
import { formatAmount } from "@/components/penetrationGraphModel";
import {
  buildBackflowEdgeModel,
  buildBackflowRoutingMeta,
  buildPenetrationEdgeStyle,
} from "@/components/penetrationBackflowRouting";

const ANCHOR_POINTS = [
  [0, 0.5], // 0 left-mid
  [1, 0.5], // 1 right-mid
  [0.5, 0], // 2 top-mid
  [0.5, 1], // 3 bottom-mid
  [1, 0.2], // 4 right-top
  [1, 0.8], // 5 right-bottom
  [0, 0.2], // 6 left-top
  [0, 0.8], // 7 left-bottom
];

function lineLabel(link) {
  const amount = formatAmount(link.value || 0);
  const count = Number(link.count || 0);
  return `${amount} / ${count}笔`;
}

function nodeLabel(node) {
  return [
    `${node.label || node.id}`,
    `流入 ${formatAmount(node.totalIn || 0)}`,
    `流出 ${formatAmount(node.totalOut || 0)}`,
  ].join("\n");
}

function edgeCurveOffset(edge) {
  const source = String(edge.source || "");
  const target = String(edge.target || "");
  const sum = [...`${source}|${target}`].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const sign = sum % 2 === 0 ? 1 : -1;
  return sign * (64 + (sum % 4) * 20);
}

function nodeSizeByDensity(compactNode) {
  return compactNode ? { w: 180, h: 52 } : { w: 240, h: 86 };
}

function buildTooltipHTML(type, model) {
  if (type === "edge") {
    const goods = Array.isArray(model.goodsNames) ? model.goodsNames.slice(0, 6) : [];
    const goodsText = goods.length > 0 ? goods.join("、") : "无";
    const edgeType = model.isBackflow ? "回环/回流边" : "正常流向边";
    return `
      <div style="min-width:250px;max-width:340px;padding:10px 12px;line-height:1.7;">
        <div style="font-size:13px;font-weight:700;color:#11314d;margin-bottom:6px;">${model.source} → ${model.target}</div>
        <div><b>类型:</b> ${edgeType}</div>
        <div><b>金额:</b> ${formatAmount(model.value || 0)}</div>
        <div><b>笔数:</b> ${Number(model.count || 0)} 笔</div>
        <div><b>摘要:</b> ${goodsText}</div>
      </div>
    `;
  }
  return `
    <div style="min-width:230px;padding:10px 12px;line-height:1.7;">
      <div style="font-size:13px;font-weight:700;color:#11314d;margin-bottom:6px;">${model.label || model.id}</div>
      <div><b>流入:</b> ${formatAmount(model.totalIn || 0)}</div>
      <div><b>流出:</b> ${formatAmount(model.totalOut || 0)}</div>
      <div><b>层级:</b> L${Number(model.depth ?? -1)}</div>
      <div><b>连通度:</b> ${Number(model.degree || 0)}</div>
    </div>
  `;
}

export default function PenetrationFlowGraph({
  graph,
  focusNodeID,
  onFocusNodeChange,
  height = 760,
  showEdgeLabels = false,
}) {
  const containerRef = useRef(null);
  const graphRef = useRef(null);

  const transformedData = useMemo(() => {
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    const links = Array.isArray(graph?.links) ? graph.links : [];
    const denseMode = nodes.length > 180 || links.length > 320;
    const compactNode = nodes.length > 220;
    const edgeLabelEnabled = showEdgeLabels && links.length <= 80;
    const nodeSize = nodeSizeByDensity(compactNode);

    const nodeItems = nodes.map((node) => {
      const id = String(node.id);
      const depth = Number(node.depth ?? -1);
      return {
        ...node,
        id,
        depth,
        x: Number(node.x || 0),
        y: Number(node.y || 0),
      };
    });
    const routingMeta = buildBackflowRoutingMeta(nodeItems, links, nodeSize);

    return {
      nodes: nodeItems.map((node) => {
        const isRoot = Number(node.depth) === 0;
        return {
          id: node.id,
          x: Number(node.x || 0),
          y: Number(node.y || 0),
          label: compactNode ? String(node.label || node.id) : nodeLabel(node),
          type: "rect",
          anchorPoints: ANCHOR_POINTS,
          size: [nodeSize.w, nodeSize.h],
          style: {
            radius: compactNode ? 10 : 14,
            stroke: isRoot ? "#f59f00" : "#6a94ff",
            fill: isRoot ? "#fff7e8" : "#f8fbff",
            lineWidth: isRoot ? 2.6 : 1.6,
            shadowColor: isRoot ? "rgba(245,159,0,0.18)" : "rgba(47,87,191,0.14)",
            shadowBlur: compactNode ? 8 : 16,
            shadowOffsetY: compactNode ? 3 : 6,
          },
          labelCfg: {
            style: {
              fontSize: compactNode ? 11 : 12,
              lineHeight: compactNode ? 14 : 18,
              fill: "#10243d",
              textAlign: compactNode ? "center" : "left",
              textBaseline: "middle",
            },
            position: "center",
          },
          ...node,
        };
      }),
      edges: links.map((edge, edgeIndex) => {
        const isBackflow = !!edge.isBackflow;
        const baseModel = isBackflow
          ? buildBackflowEdgeModel(edge, edgeIndex, routingMeta)
          : {
              ...edge,
              source: String(edge.source),
              target: String(edge.target),
              type: denseMode ? "line" : "polyline",
              sourceAnchor: 1,
              targetAnchor: 0,
            };
        if (!baseModel) return null;

        const lineType = baseModel.type || (denseMode ? "line" : "polyline");
        return {
          ...baseModel,
          label: edgeLabelEnabled ? lineLabel(edge) : "",
          type: lineType,
          curveOffset: !denseMode && !isBackflow && lineType === "quadratic" ? edgeCurveOffset(edge) : 0,
          zIndex: isBackflow ? 3 : 1,
          style: buildPenetrationEdgeStyle({
            isBackflow,
            denseMode,
            lineType,
          }),
          labelCfg: {
            autoRotate: true,
            style: {
              fill: isBackflow ? "#b02525" : "#1e7a37",
              fontSize: 10,
              background: {
                fill: "rgba(255,255,255,0.95)",
                radius: 4,
                padding: [2, 4],
              },
            },
          },
        };
      }).filter(Boolean),
    };
  }, [graph, showEdgeLabels]);

  useEffect(() => {
    if (!containerRef.current || graphRef.current) return;
    const tooltip = new G6.Tooltip({
      offsetX: 12,
      offsetY: 12,
      itemTypes: ["node", "edge"],
      getContent: (evt) => {
        const model = evt?.item?.getModel?.() || {};
        const type = evt?.item?.getType?.() || "";
        const div = document.createElement("div");
        div.style.background = "rgba(255,255,255,0.98)";
        div.style.border = "1px solid #d8e4ff";
        div.style.borderRadius = "10px";
        div.style.boxShadow = "0 8px 24px rgba(15, 40, 90, 0.12)";
        div.innerHTML = buildTooltipHTML(type, model);
        return div;
      },
    });

      const graphIns = new G6.Graph({
        container: containerRef.current,
        renderer: "svg",
        width: containerRef.current.clientWidth || 1200,
      height: height,
      fitView: true,
      fitViewPadding: [36, 56, 36, 36],
      animate: false,
      defaultNode: {
        type: "rect",
      },
      defaultEdge: {
        type: "polyline",
      },
      nodeStateStyles: {
        selected: {
          lineWidth: 3,
          stroke: "#0b6cff",
          shadowColor: "rgba(11,108,255,0.24)",
          shadowBlur: 18,
        },
        hover: {
          lineWidth: 2.4,
          stroke: "#2a6fff",
        },
      },
      edgeStateStyles: {
        hover: {
          lineWidth: 2.6,
          opacity: 1,
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
        ],
      },
      plugins: [tooltip],
    });

    graphIns.on("node:click", (evt) => {
      const id = String(evt?.item?.getModel?.()?.id || "");
      onFocusNodeChange?.(id);
    });
    graphIns.on("canvas:click", () => {
      onFocusNodeChange?.("");
    });
    graphIns.on("node:mouseenter", (evt) => {
      if (evt.item) graphIns.setItemState(evt.item, "hover", true);
    });
    graphIns.on("node:mouseleave", (evt) => {
      if (evt.item) graphIns.setItemState(evt.item, "hover", false);
    });
    graphIns.on("edge:mouseenter", (evt) => {
      if (evt.item) graphIns.setItemState(evt.item, "hover", true);
    });
    graphIns.on("edge:mouseleave", (evt) => {
      if (evt.item) graphIns.setItemState(evt.item, "hover", false);
    });

    graphRef.current = graphIns;
    const onResize = () => {
      if (!containerRef.current || !graphRef.current) return;
      graphRef.current.changeSize(containerRef.current.clientWidth || 1200, height);
      graphRef.current.fitView(20);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      graphIns.destroy();
      graphRef.current = null;
    };
  }, [height, onFocusNodeChange]);

  useEffect(() => {
    const graphIns = graphRef.current;
    if (!graphIns) return;
    const nodes = transformedData.nodes || [];
    const edges = transformedData.edges || [];

    if (nodes.length === 0) {
      graphIns.clear();
      return;
    }
    graphIns.data({ nodes, edges });
    graphIns.render();
    graphIns.fitView(24);
  }, [transformedData]);

  useEffect(() => {
    const graphIns = graphRef.current;
    if (!graphIns) return;
    graphIns.getNodes().forEach((nodeItem) => {
      graphIns.setItemState(nodeItem, "selected", false);
    });
    if (!focusNodeID) return;
    const nodeItem = graphIns.findById(String(focusNodeID));
    if (nodeItem) {
      graphIns.setItemState(nodeItem, "selected", true);
      graphIns.focusItem(nodeItem, true, { easing: "easeCubic", duration: 350 });
    }
  }, [focusNodeID]);

  if (!Array.isArray(graph?.nodes) || graph.nodes.length === 0) {
    return (
      <div
        style={{
          height,
          border: "1px dashed #c9d9ff",
          borderRadius: 16,
          background: "linear-gradient(145deg, #f7fbff 0%, #eef4ff 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Empty description="当前筛选条件下没有可展示的资金流图谱" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        height,
        border: "1px solid #d8e4ff",
        borderRadius: 16,
        userSelect: "none",
        WebkitUserSelect: "none",
        background:
          "radial-gradient(circle at 12% 8%, rgba(245, 250, 255, 0.95), rgba(236, 244, 255, 0.95) 56%, rgba(245, 249, 255, 0.95))",
        overflow: "hidden",
      }}
    />
  );
}
