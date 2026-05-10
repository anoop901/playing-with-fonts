import type { PointOnContour, GlyphData } from "../parseFontFile";
import clamp from "./clamp";
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

  edgesToRenderedPixels(edges: RenderedEdge[]): {
    windingNumbers: number[][];
    renderedPixels: boolean[][];
    xMin: number;
    yMin: number;
  } {
    if (edges.length === 0) {
      return { windingNumbers: [], renderedPixels: [], xMin: 0, yMin: 0 };
    }

    // Compute the bounding box of all edge endpoints in pixel space
    let bboxXMin = Infinity,
      bboxXMax = -Infinity;
    let bboxYMin = Infinity,
      bboxYMax = -Infinity;
    for (const edge of edges) {
      bboxXMin = Math.min(bboxXMin, edge.from.x, edge.to.x);
      bboxXMax = Math.max(bboxXMax, edge.from.x, edge.to.x);
      bboxYMin = Math.min(bboxYMin, edge.from.y, edge.to.y);
      bboxYMax = Math.max(bboxYMax, edge.from.y, edge.to.y);
    }

    // Snap to integer pixel boundaries, clamped to the render area
    const xMin = clamp(Math.floor(bboxXMin), 0, this.renderSize.x);
    const xMax = clamp(Math.ceil(bboxXMax), 0, this.renderSize.x);
    const yMin = clamp(Math.floor(bboxYMin), 0, this.renderSize.y);
    const yMax = clamp(Math.ceil(bboxYMax), 0, this.renderSize.y);

    // Allocate the subgrid that contains the glyph
    const windingNumbers: number[][] = Array.from({ length: yMax - yMin }, () =>
      new Array(xMax - xMin).fill(0),
    );

    for (const edge of edges) {
      if (edge.from.y === edge.to.y) continue;

      // +1 or -1 depending on whether the edge goes upward or downward
      const dir = edge.from.y < edge.to.y ? 1 : -1;

      // Add dir to the winding number of every pixel such that the
      // rightward-pointing ray starting at the pixel's center intersects this edge.
      const yStart = dir === 1 ? edge.from.y : edge.to.y;
      const yEnd = dir === 1 ? edge.to.y : edge.from.y;
      const edgeYMin = Math.max(Math.ceil(yStart - 0.5), yMin);
      const edgeYMax = Math.min(Math.ceil(yEnd - 0.5) - 1, yMax - 1);
      for (let y = edgeYMin; y <= edgeYMax; y++) {
        const xLimit = Math.min(
          lerp(
            edge.from.x,
            edge.to.x,
            lerp_inverse(edge.from.y, edge.to.y, y + 0.5),
          ) - 0.5,
          xMax - 1,
        );
        for (let x = xMin; x <= xLimit; x++) {
          windingNumbers[y - yMin][x - xMin] += dir;
        }
      }
    }

    // Render each pixel for which the winding number is nonzero
    const renderedPixels: boolean[][] = Array.from(
      { length: yMax - yMin },
      (_, dy) =>
        Array.from(
          { length: xMax - xMin },
          (_, dx) => windingNumbers[dy][dx] !== 0,
        ),
    );

    return { windingNumbers, renderedPixels, xMin, yMin };
  }

  renderGlyph(glyph: GlyphData, decasteljauIters: number = 3) {
    const transformedPoints = this.transformPoints(glyph);
    const processedContours = processContours(
      glyph,
      transformedPoints,
      decasteljauIters,
    );
    const edges = processedContoursToEdges(processedContours);
    const { renderedPixels, xMin, yMin } = this.edgesToRenderedPixels(edges);
    return { processedContours, renderedPixels, xMin, yMin };
  }
}
