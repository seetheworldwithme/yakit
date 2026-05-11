import test from "node:test";
import assert from "node:assert/strict";
import { deriveDisplayGraph } from "./penetrationGraphModel.js";

function makeGraph() {
  return {
    nodes: [
      { id: "R", label: "Root", depth: 0, totalIn: 0, totalOut: 1000, degree: 3 },
      { id: "A", label: "A", depth: 1, totalIn: 700, totalOut: 600, degree: 3 },
      { id: "B", label: "B", depth: 1, totalIn: 400, totalOut: 500, degree: 3 },
      { id: "C", label: "C", depth: 2, totalIn: 300, totalOut: 200, degree: 2 },
    ],
    links: [
      { source: "R", target: "A", value: 900, count: 8, isBackflow: false },
      { source: "R", target: "B", value: 200, count: 2, isBackflow: false },
      { source: "A", target: "B", value: 800, count: 5, isBackflow: false },
      { source: "A", target: "C", value: 100, count: 1, isBackflow: false },
      { source: "B", target: "A", value: 50, count: 1, isBackflow: true },
    ],
  };
}

test("focus mode keeps root bridge edges for focused neighborhood even with per-node cap", () => {
  const out = deriveDisplayGraph(makeGraph(), {
    focusMode: true,
    focusNodeID: "A",
    focusNeighborLimit: 4,
    maxEdgesPerNode: 1,
    maxNodes: 200,
    maxEdges: 200,
  });

  const hasBridge = out.links.some(
    (edge) => String(edge.source) === "R" && String(edge.target) === "B" && !edge.isBackflow,
  );
  assert.equal(hasBridge, true, "R->B should be retained as root bridge in focus view");
});

test("non-focus mode still enforces per-source top edge cap", () => {
  const out = deriveDisplayGraph(makeGraph(), {
    focusMode: false,
    maxEdgesPerNode: 1,
    maxNodes: 200,
    maxEdges: 200,
  });

  const hasDropped = out.links.some(
    (edge) => String(edge.source) === "R" && String(edge.target) === "B" && !edge.isBackflow,
  );
  assert.equal(hasDropped, false, "R->B should be trimmed in non-focus mode when capped");
});

test("focus mode keeps root-to-neighborhood bridge to avoid disconnected root node", () => {
  const out = deriveDisplayGraph(makeGraph(), {
    focusMode: true,
    focusNodeID: "C",
    focusNeighborLimit: 4,
    maxEdgesPerNode: 1,
    maxNodes: 200,
    maxEdges: 200,
  });

  const hasRootBridge = out.links.some(
    (edge) => String(edge.source) === "R" && String(edge.target) === "A" && !edge.isBackflow,
  );
  assert.equal(hasRootBridge, true, "R->A should be retained as root bridge for deeper focused node");
});
