import test from "node:test";
import assert from "node:assert/strict";
import { simplifyHierarchyGraph } from "./graphHierarchySimplify.js";

function mkRootWithManyChildren(count = 20) {
  const nodes = [{ id: "R", label: "Root", depth: 0, totalOut: 1000 }];
  const links = [];
  for (let i = 1; i <= count; i += 1) {
    const id = `C${i}`;
    nodes.push({ id, label: `Child${i}`, depth: 1, totalOut: 0 });
    links.push({
      source: "R",
      target: id,
      value: 100 - i,
      count: i,
      goodsNames: [`G${i}`],
      isBackflow: false,
    });
  }
  return { nodes, links };
}

test("keeps major downstream children and aggregates long tail", () => {
  const graph = mkRootWithManyChildren(20);
  const out = simplifyHierarchyGraph(graph, {
    maxChildrenRoot: 5,
    maxChildrenPerNode: 3,
    maxTotalNodes: 30,
  });

  const nodeIds = new Set(out.nodes.map((n) => n.id));
  // Top 5 by value are C1..C5 and should be retained.
  ["C1", "C2", "C3", "C4", "C5"].forEach((id) => assert.equal(nodeIds.has(id), true));
  // Long-tail nodes should be collapsed.
  assert.equal(nodeIds.has("C20"), false);

  const aggNode = out.nodes.find((n) => String(n.id).startsWith("__others__R__"));
  assert.ok(aggNode, "expected aggregated downstream node for root");
  assert.match(String(aggNode.label), /其他下游公司/);

  const aggEdge = out.links.find((l) => l.source === "R" && l.target === aggNode.id);
  assert.ok(aggEdge, "expected aggregated edge from root to other downstream companies");
  assert.ok((aggEdge.value || 0) > 0);
  assert.ok((aggEdge.count || 0) > 0);
});

test("keeps backflow edges when both endpoints are preserved", () => {
  const graph = {
    nodes: [
      { id: "R", label: "Root", depth: 0, totalOut: 1000 },
      { id: "A", label: "A", depth: 1, totalOut: 600 },
    ],
    links: [
      { source: "R", target: "A", value: 600, count: 10, goodsNames: ["棉纱"], isBackflow: false },
      { source: "A", target: "R", value: 120, count: 2, goodsNames: ["回款"], isBackflow: true },
    ],
  };

  const out = simplifyHierarchyGraph(graph, {
    maxChildrenRoot: 5,
    maxChildrenPerNode: 3,
    maxTotalNodes: 30,
  });
  const hasBackflow = out.links.some((l) => l.source === "A" && l.target === "R" && l.isBackflow);
  assert.equal(hasBackflow, true);
});

