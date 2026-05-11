/**
 * Build orthogonal edge graphics from node positions in pixel space.
 */
export function buildOrthogonalGraphics(links, nodePositions) {
  const elements = [];
  links.forEach((l) => {
    const src = nodePositions[l.source];
    const tgt = nodePositions[l.target];
    if (!src || !tgt) return;

    const isBackflow = !!l.isBackflow;
    const midX = (src.x + tgt.x) / 2;

    elements.push({
      type: "polyline",
      z: 1,
      shape: {
        points: [
          [src.x, src.y],
          [midX, src.y],
          [midX, tgt.y],
          [tgt.x, tgt.y],
        ],
      },
      style: {
        stroke: isBackflow ? "#f5222d" : "#88a0d8",
        lineWidth: isBackflow ? 2.4 : 1.6,
        lineDash: isBackflow ? [6, 4] : null,
        opacity: isBackflow ? 0.85 : 0.7,
      },
      silent: true,
    });

    const arrowSize = 8;
    const arrowDir = tgt.x > midX ? 1 : tgt.x < midX ? -1 : 0;
    if (arrowDir !== 0) {
      elements.push({
        type: "polygon",
        z: 2,
        shape: {
          points: [
            [tgt.x, tgt.y],
            [tgt.x - arrowDir * arrowSize, tgt.y - arrowSize / 2],
            [tgt.x - arrowDir * arrowSize, tgt.y + arrowSize / 2],
          ],
        },
        style: {
          fill: isBackflow ? "#f5222d" : "#88a0d8",
        },
        silent: true,
      });
    }

    const labelText = String(l._edgeLabelText || "").trim();
    if (labelText) {
      elements.push({
        type: "text",
        z: 3,
        style: {
          x: midX + 6,
          y: (src.y + tgt.y) / 2 - 8,
          text: labelText,
          fill: isBackflow ? "#f5222d" : "#5a7ab5",
          font: "12px sans-serif",
          backgroundColor: "rgba(255,255,255,0.88)",
          padding: [2, 6],
          borderRadius: 3,
        },
        silent: true,
      });
    }
  });
  return elements;
}

/**
 * Project layout coordinates to the current chart view coordinates.
 */
export function projectNodePositions(nodePositions, projectPoint) {
  if (typeof projectPoint !== "function") return nodePositions;

  const projected = {};
  Object.entries(nodePositions || {}).forEach(([id, point]) => {
    if (!point) return;
    const out = projectPoint([point.x, point.y]);
    if (Array.isArray(out) && out.length >= 2 && Number.isFinite(out[0]) && Number.isFinite(out[1])) {
      projected[id] = { x: out[0], y: out[1] };
      return;
    }
    projected[id] = { x: point.x, y: point.y };
  });
  return projected;
}

/**
 * Build orthogonal graphics after projecting nodes into current view.
 */
export function buildProjectedOrthogonalGraphics(links, nodePositions, projectPoint) {
  const projected = projectNodePositions(nodePositions, projectPoint);
  return buildOrthogonalGraphics(links, projected);
}

/**
 * Build orthogonal graphics using chart's graph coordinate transform.
 */
export function buildProjectedOrthogonalGraphicsFromChart(chart, links, nodePositions, seriesIndex = 0) {
  const seriesModel = chart?.getModel?.()?.getSeriesByIndex?.(seriesIndex);
  const coordSys = seriesModel?.coordinateSystem;
  const projectPoint = typeof coordSys?.dataToPoint === "function"
    ? (point) => coordSys.dataToPoint(point)
    : null;
  return buildProjectedOrthogonalGraphics(links, nodePositions, projectPoint);
}
