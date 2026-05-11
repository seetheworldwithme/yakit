import test from "node:test";
import assert from "node:assert/strict";
import { buildProjectedOrthogonalGraphics } from "./graphOrthogonalOverlay.js";

test("projects node coordinates before building orthogonal graphics", () => {
  const links = [{ source: "A", target: "B", isBackflow: false, _edgeLabelText: "100万 / 2笔" }];
  const nodePositions = {
    A: { x: 10, y: 20 },
    B: { x: 110, y: 60 },
  };

  const project = ([x, y]) => [x * 2 + 5, y * 2 - 3];
  const out = buildProjectedOrthogonalGraphics(links, nodePositions, project);

  const line = out.find((el) => el.type === "polyline");
  assert.ok(line, "expected orthogonal polyline");

  const src = project([10, 20]);
  const tgt = project([110, 60]);
  const midX = (src[0] + tgt[0]) / 2;

  assert.deepEqual(line.shape.points, [
    [src[0], src[1]],
    [midX, src[1]],
    [midX, tgt[1]],
    [tgt[0], tgt[1]],
  ]);
});
