import type { PointOnContour, GlyphData } from "../parseFontFile";
import lerp, { lerp_inverse } from "./lerp";
import { Vector2 } from "./Vector2";

type RenderedEdge = {
  from: Vector2;
  to: Vector2;
};

function decasteljauSplitQuadBezier(
  pt1: Vector2,
  anchor: Vector2,
  pt2: Vector2,
) {
  const mid1Anchor = pt1.midpoint(anchor);
  const mid2Anchor = pt2.midpoint(anchor);
  const bezierMidpoint = mid1Anchor.midpoint(mid2Anchor);
  return [
    { pt1: pt1, anchor: mid1Anchor, pt2: bezierMidpoint },
    { pt1: bezierMidpoint, anchor: mid2Anchor, pt2: pt2 },
  ];
}

function processContours(
  glyph: GlyphData,
  transformedPoints: PointOnContour[],
  decasteljauIters: number = 3,
) {
  // Put the points of each contour in a separate array
  let startPointIndex = 0;
  const pointsSplitByContour = [];
  for (const contour of glyph.contours) {
    pointsSplitByContour.push(
      transformedPoints.slice(startPointIndex, contour + 1),
    );
    startPointIndex = contour + 1;
  }

  const processedContours = [];

  for (let pointsInContour of pointsSplitByContour) {
    pointsInContour = insertImpliedOnCurvePoints(pointsInContour);
    // Interpolate curves using De Casteljau's Algorithm decasteljauIters times
    for (
      let decasteljaui = 0;
      decasteljaui < decasteljauIters;
      decasteljaui++
    ) {
      pointsInContour = interpolateContour(pointsInContour);
    }
    // Remove off-curve points
    pointsInContour = pointsInContour.filter((pt) => pt.onCurve);

    processedContours.push(pointsInContour.map((pt) => pt.vec));
  }

  return processedContours;
}

// Insert implied on-curve points into array. These are the midpoints
// between any two consecutive off-curve points.
// Returns a new array, and leaves the input unmodified.
function insertImpliedOnCurvePoints(pointsInContour: PointOnContour[]) {
  const pointsInContourWithImplied = [];
  for (let i = 0; i < pointsInContour.length; i++) {
    const pt1 = pointsInContour[i];
    const pt2 = pointsInContour[(i + 1) % pointsInContour.length];
    pointsInContourWithImplied.push(pt1);
    if (!pt1.onCurve && !pt2.onCurve) {
      const mid = { onCurve: true, vec: pt1.vec.lerp(pt2.vec, 0.5) };
      pointsInContourWithImplied.push(mid);
    }
  }
  return pointsInContourWithImplied;
}

function processedContoursToEdges(
  processedContours: Vector2[][],
): RenderedEdge[] {
  const edges = [];
  for (const contour of processedContours) {
    for (let i = 0; i < contour.length; i++) {
      const pt = contour[i];
      const nextPt = contour[(i + 1) % contour.length];
      edges.push({ from: pt, to: nextPt });
    }
  }
  return edges;
}

// For each off-curve point, insert an on-curve point corresponding to t=0.5,
// and two new off-curve points around it that split the curve in two at this point.
// Returns a new array, and leaves the input unmodified.
function interpolateContour(pointsInContour: PointOnContour[]) {
  const pointsInContourInterpolated = [];
  for (let i = 0; i < pointsInContour.length; i++) {
    const pt = pointsInContour[i];
    if (!pt.onCurve) {
      const lastPtV =
        pointsInContour[
          (i - 1 + pointsInContour.length) % pointsInContour.length
        ].vec;
      const nextPtV = pointsInContour[(i + 1) % pointsInContour.length].vec;
      const subBeziers = decasteljauSplitQuadBezier(lastPtV, pt.vec, nextPtV);
      pointsInContourInterpolated.push({
        onCurve: false,
        vec: subBeziers[0].anchor,
      });
      pointsInContourInterpolated.push({
        onCurve: true,
        vec: subBeziers[0].pt2,
      });
      pointsInContourInterpolated.push({
        onCurve: false,
        vec: subBeziers[1].anchor,
      });
    } else {
      pointsInContourInterpolated.push(pt);
    }
  }
  return pointsInContourInterpolated;
}

export class FontRenderer {
  origin: Vector2;
  fontSize: number;
  unitsPerEm: number;
  renderSize: Vector2;

  constructor(
    origin: Vector2,
    fontSize: number,
    unitsPerEm: number,
    renderSize: Vector2,
  ) {
    this.origin = origin;
    this.fontSize = fontSize;
    this.unitsPerEm = unitsPerEm;
    this.renderSize = renderSize;
  }

  glyphCoordToRenderCoord(glyphCoord: Vector2) {
    const scaledGlyphCoord = glyphCoord.times(this.fontSize / this.unitsPerEm);
    const flippedGlyphCoord = new Vector2(
      scaledGlyphCoord.x,
      -scaledGlyphCoord.y,
    );
    const renderCoord = this.origin.add(flippedGlyphCoord);
    return renderCoord;
  }

  // Transform all points from outline definition into render coords
  transformPoints(glyph: GlyphData): PointOnContour[] {
    return glyph.points.map((pt) => ({
      vec: this.glyphCoordToRenderCoord(pt.vec),
      onCurve: pt.onCurve,
    }));
  }

  calculateWindingNumbers(edges: RenderedEdge[]) {
    const windingNumbers: number[][] = [];
    for (let y = 0; y < this.renderSize.y; y++) {
      windingNumbers.push([]);
      for (let x = 0; x < this.renderSize.x; x++) {
        windingNumbers[y].push(0);
      }
    }

    for (const edge of edges) {
      if (edge.from.y === edge.to.y) continue;

      const dir = edge.from.y < edge.to.y ? 1 : -1;
      const yStart = dir === 1 ? edge.from.y : edge.to.y;
      const yEnd = dir === 1 ? edge.to.y : edge.from.y;

      const yMin = Math.max(Math.ceil(yStart - 0.5), 0);
      const yMax = Math.min(Math.ceil(yEnd - 0.5) - 1, this.renderSize.y - 1);

      for (let y = yMin; y <= yMax; y++) {
        for (
          let x = 0;
          x <=
          Math.min(
            lerp(
              edge.from.x,
              edge.to.x,
              lerp_inverse(edge.from.y, edge.to.y, y + 0.5),
            ) - 0.5,
            this.renderSize.x - 1,
          );
          x++
        ) {
          windingNumbers[y][x] += dir;
        }
      }
    }

    return windingNumbers;
  }

  renderGlyph(glyph: GlyphData, decasteljauIters: number = 3) {
    const transformedPoints = this.transformPoints(glyph);
    const processedContours = processContours(
      glyph,
      transformedPoints,
      decasteljauIters,
    );
    const edges = processedContoursToEdges(processedContours);
    const windingNumbers = this.calculateWindingNumbers(edges);
    return { processedContours, windingNumbers };
  }
}
