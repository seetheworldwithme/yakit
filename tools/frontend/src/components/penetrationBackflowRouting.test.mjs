import test from "node:test";
import assert from "node:assert/strict";
import {
  BACKFLOW_ROUTING_CONSTANTS,
  buildBackflowEdgeModel,
  buildBackflowRoutingMeta,
  buildPenetrationEdgeStyle,
} from "./penetrationBackflowRouting.js";

const NODE_SIZE = { w: 240, h: 86 };

test("same-depth backflow keeps right lane when no downstream conflict exists", () => {
  const nodes = [
    { id: "R", depth: 0, x: 140, y: 180 },
    { id: "A", depth: 1, x: 400, y: 120 },
    { id: "T", depth: 1, x: 400, y: 260 },
    { id: "N", depth: 2, x: 760, y: 200 },
  ];
  const links = [
    { source: "A", target: "T", isBackflow: true, value: 1000, count: 1 },
    { source: "A", target: "N", isBackflow: false, value: 6000, count: 2 },
  ];

  const meta = buildBackflowRoutingMeta(nodes, links, NODE_SIZE);
  const model = buildBackflowEdgeModel(links[0], 0, meta);

  assert.equal(model.sourceAnchor, 1);
  assert.equal(model.targetAnchor, 1);
  assert.equal(model.type, "polyline");

  const laneX = model.controlPoints[0].x;
  const srcRight = Number(nodes[1].x) + NODE_SIZE.w / 2;
  assert.ok(laneX > srcRight, "lane should escape to the right of same-depth column");

  const downstreamBoundary = meta.downstreamBoundaryByDepth.get(1);
  assert.ok(
    laneX <= downstreamBoundary - BACKFLOW_ROUTING_CONSTANTS.RED_TO_GREEN_MIN_GAP,
    "same-depth red lane should stay left of downstream green boundary",
  );
});

test("same-depth backflow moves to left lane only when downstream conflict is detected", () => {
  const nodes = [
    { id: "R", depth: 0, x: 140, y: 180 },
    { id: "A", depth: 1, x: 400, y: 120 },
    { id: "T", depth: 1, x: 400, y: 260 },
    { id: "N", depth: 2, x: 660, y: 200 },
  ];
  const links = [
    { source: "A", target: "T", isBackflow: true, value: 1000, count: 1 },
    { source: "A", target: "N", isBackflow: false, value: 6000, count: 2 },
  ];

  const meta = buildBackflowRoutingMeta(nodes, links, NODE_SIZE);
  const model = buildBackflowEdgeModel(links[0], 0, meta);

  assert.equal(model.sourceAnchor, 0);
  assert.equal(model.targetAnchor, 0);

  const laneX = model.controlPoints[0].x;
  const srcCenter = Number(nodes[1].x);
  assert.ok(laneX < srcCenter, "conflict lane should reroute to the left side corridor");
});

test("same-depth backflows to one target are globally staggered to avoid overlap", () => {
  const nodes = [
    { id: "A", depth: 1, x: 400, y: 110 },
    { id: "B", depth: 1, x: 400, y: 170 },
    { id: "T", depth: 1, x: 400, y: 240 },
    { id: "N", depth: 2, x: 760, y: 170 },
  ];
  const links = [
    { source: "A", target: "T", isBackflow: true, value: 1000, count: 1 },
    { source: "B", target: "T", isBackflow: true, value: 900, count: 1 },
    { source: "A", target: "N", isBackflow: false, value: 4000, count: 1 },
  ];

  const meta = buildBackflowRoutingMeta(nodes, links, NODE_SIZE);
  const edgeA = buildBackflowEdgeModel(links[0], 0, meta);
  const edgeB = buildBackflowEdgeModel(links[1], 1, meta);

  const laneAX = edgeA.controlPoints[0].x;
  const laneBX = edgeB.controlPoints[0].x;
  assert.notEqual(laneAX, laneBX);
  assert.ok(laneBX < laneAX, "later edges in same target group should shift further left");
  assert.ok(
    Math.abs(laneAX - laneBX) >= BACKFLOW_ROUTING_CONSTANTS.SAME_TARGET_LANE_STEP,
    "same target spacing should meet configured lane step",
  );
});

test("left reroute under guard still keeps same-target edges separated", () => {
  const nodes = [
    { id: "R", depth: 0, x: 140, y: 170 },
    { id: "A", depth: 1, x: 400, y: 110 },
    { id: "B", depth: 1, x: 400, y: 180 },
    { id: "T", depth: 1, x: 400, y: 250 },
    { id: "N", depth: 2, x: 660, y: 170 },
  ];
  const links = [
    { source: "A", target: "T", isBackflow: true, value: 1000, count: 1 },
    { source: "B", target: "T", isBackflow: true, value: 900, count: 1 },
    { source: "A", target: "N", isBackflow: false, value: 4000, count: 1 },
  ];

  const meta = buildBackflowRoutingMeta(nodes, links, NODE_SIZE);
  const edgeA = buildBackflowEdgeModel(links[0], 0, meta);
  const edgeB = buildBackflowEdgeModel(links[1], 1, meta);

  assert.equal(edgeA.sourceAnchor, 0);
  assert.equal(edgeB.sourceAnchor, 0);
  const laneAX = edgeA.controlPoints[0].x;
  const laneBX = edgeB.controlPoints[0].x;
  assert.ok(laneBX > laneAX, "left reroute lanes should still be distinct under guard clamp");
});

test("cross-depth backflow routing keeps legacy anchor direction behavior", () => {
  const nodes = [
    { id: "S", depth: 2, x: 700, y: 240 },
    { id: "U", depth: 1, x: 400, y: 120 },
    { id: "R", depth: 0, x: 140, y: 180 },
  ];
  const links = [
    { source: "S", target: "U", isBackflow: true, value: 1200, count: 1 },
  ];

  const meta = buildBackflowRoutingMeta(nodes, links, NODE_SIZE);
  const model = buildBackflowEdgeModel(links[0], 0, meta);

  assert.equal(model.type, "polyline");
  assert.equal(model.sourceAnchor, 0);
  assert.ok(model.targetAnchor === 4 || model.targetAnchor === 5);
  assert.equal(model.controlPoints.length, 2);
});

test("edge style disables arrows and keeps stroke style", () => {
  const style = buildPenetrationEdgeStyle({
    isBackflow: true,
    denseMode: false,
    lineType: "polyline",
  });

  assert.equal(style.endArrow, undefined);
  assert.equal(style.stroke, "#e03131");
  assert.deepEqual(style.lineDash, [7, 4]);
});
