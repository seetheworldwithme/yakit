import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHierarchyCustomSeriesData,
  buildHierarchyCustomOption,
} from "./graphHierarchyCustomSeries.js";

test("main chain edges use direct orthogonal routing and compact inline labels", () => {
  const items = buildHierarchyCustomSeriesData(
    [
      { id: "A", x: 100, y: 120, label: "节点A" },
      { id: "B", x: 360, y: 220, label: "节点B" },
    ],
    [
      {
        source: "A",
        target: "B",
        value: 100000,
        count: 2,
        _edgeLabelText: "金额: 10.00万 / 2笔",
        isBackflow: false,
      },
    ],
  );

  const edge = items.find((item) => item.kind === "edge");
  assert.ok(edge, "expected edge item");
  assert.deepEqual(edge.points, [
    [180, 120],
    [260, 120],
    [260, 220],
    [280, 220],
  ]);
  assert.equal(edge.isBackflow, false);
  assert.equal(edge.lineColor, "#88a0d8");
  assert.equal(edge.lineDash, null);
  assert.equal(edge.edgeLabelText, "金额: 10.00万 / 2笔");
});

test("backflow edges are routed on a dedicated upper rail with red dashed style", () => {
  const items = buildHierarchyCustomSeriesData(
    [
      { id: "B", x: 360, y: 220, label: "节点B" },
      { id: "A", x: 100, y: 120, label: "节点A" },
    ],
    [
      {
        source: "B",
        target: "A",
        value: 20000,
        count: 1,
        _edgeLabelText: "",
        isBackflow: true,
      },
    ],
  );

  const edge = items.find((item) => item.kind === "edge");
  assert.ok(edge, "expected edge item");
  assert.equal(edge.isBackflow, true);
  assert.equal(edge.lineColor, "#f5222d");
  assert.deepEqual(edge.lineDash, [7, 5]);
  assert.equal(edge.arrowColor, "#f5222d");
  assert.equal(edge.edgeLabelText, "");
  assert.equal(edge.points.length, 6);
  assert.ok(edge.points[2][1] < edge.points[0][1], "backflow rail should be above the source");
  assert.equal(edge.labelPoint.y, edge.points[2][1]);
  assert.ok(edge.points[1][0] < edge.points[0][0], "backflow should first escape away from the source column");
  assert.ok(edge.points[4][0] > edge.points[5][0], "backflow should approach the target on a dedicated side lane");
});

test("custom hierarchy tooltip calls out suspicious backflow edges", () => {
  const option = buildHierarchyCustomOption({
    nodes: [
      { id: "A", label: "节点A", x: 100, y: 120 },
      { id: "B", label: "节点B", x: 360, y: 220 },
    ],
    links: [
      {
        source: "B",
        target: "A",
        value: 20000,
        count: 1,
        goodsNames: ["回款"],
        _edgeLabelText: "",
        isBackflow: true,
      },
    ],
    width: 640,
    height: 380,
    chartHeight: 520,
  });

  const tip = option.tooltip.formatter({ dataIndex: 0 });
  assert.match(String(tip), /B ➔ A/);
  assert.match(String(tip), /资金方向：B 流向 A/);
  assert.match(String(tip), /疑似回流\/回环边/);
  assert.match(String(tip), /金额/);
});

test("edge renderer uses per-edge style and keeps arrow aligned with final segment", () => {
  const option = buildHierarchyCustomOption({
    nodes: [
      { id: "A", label: "节点A", x: 100, y: 120 },
      { id: "B", label: "节点B", x: 360, y: 220 },
    ],
    links: [
      {
        source: "B",
        target: "A",
        value: 20000,
        count: 1,
        goodsNames: ["回款"],
        _edgeLabelText: "",
        isBackflow: true,
      },
    ],
    width: 640,
    height: 380,
    chartHeight: 520,
  });

  const rendered = option.series[0].renderItem(
    { dataIndex: 0 },
    { coord: (point) => point },
  );
  const line = rendered.children.find((child) => child.type === "polyline");
  const arrow = rendered.children.find((child) => child.type === "polygon");

  assert.ok(line, "expected polyline child");
  assert.ok(arrow, "expected arrow child");
  assert.equal(line.style.stroke, "#f5222d");
  assert.deepEqual(line.style.lineDash, [7, 5]);
  assert.equal(arrow.style.fill, "#f5222d");
  assert.deepEqual(arrow.shape.points[0], [180, 120]);
});

test("hierarchy option includes an explicit legend for main flow and backflow", () => {
  const option = buildHierarchyCustomOption({
    nodes: [
      { id: "A", label: "节点A", x: 100, y: 120 },
      { id: "B", label: "节点B", x: 360, y: 220 },
    ],
    links: [],
    width: 640,
    height: 380,
    chartHeight: 520,
  });

  assert.ok(Array.isArray(option.graphic));
  assert.ok(option.graphic.length > 0);
  const legend = option.graphic[0];
  const textChildren = legend.children.filter((child) => child.type === "text");
  assert.equal(textChildren.length, 2);
  assert.match(textChildren[0].style.text, /主链路/);
  assert.match(textChildren[1].style.text, /回流\/回环/);
});

test("hierarchy option exposes custom-series items for node click resolution", () => {
  const option = buildHierarchyCustomOption({
    nodes: [
      { id: "A", label: "节点A", x: 100, y: 120 },
      { id: "B", label: "节点B", x: 360, y: 220 },
    ],
    links: [
      {
        source: "A",
        target: "B",
        value: 100000,
        count: 2,
        goodsNames: ["棉花"],
        _edgeLabelText: "金额: 10.00万 / 2笔",
        isBackflow: false,
      },
    ],
    width: 640,
    height: 380,
    chartHeight: 520,
  });

  assert.ok(Array.isArray(option._items));
  const nodeItem = option._items.find((item) => item.kind === "node" && item.id === "A");
  assert.ok(nodeItem);
  assert.equal(nodeItem.nodeLabel, "节点A");
});
