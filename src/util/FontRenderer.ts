import type { PointOnContour, GlyphData } from "../parseFontFile";
import clamp from "./clamp";
import lerp, { lerp_inverse } from "./lerp";
import { Vector2 } from "./Vector2";

type RenderedEdge = {
  from: Vector2;
  to: Vector2;
};

// ─── Curve helpers ────────────────────────────────────────────────────────────

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

type BBox = {
  topLeft: Vector2;
  bottomRight: Vector2;
};

function computeBbox(
  contour: Vector2[],
  rounded: boolean = false,
  clampBoundary?: BBox,
): BBox {
  let xMin = Infinity,
    xMax = -Infinity;
  let yMin = Infinity,
    yMax = -Infinity;
  for (const pt of contour) {
    xMin = Math.min(xMin, pt.x);
    xMax = Math.max(xMax, pt.x);
    yMin = Math.min(yMin, pt.y);
    yMax = Math.max(yMax, pt.y);
  }

  if (rounded) {
    // Snap to integer pixel boundaries, clamped to the render area
    xMin = Math.floor(xMin);
    xMax = Math.ceil(xMax);
    yMin = Math.floor(yMin);
    yMax = Math.ceil(yMax);
  }

  if (clampBoundary != null) {
    xMin = clamp(xMin, clampBoundary.topLeft.x, clampBoundary.bottomRight.x);
    xMax = clamp(xMax, clampBoundary.topLeft.x, clampBoundary.bottomRight.x);
    yMin = clamp(yMin, clampBoundary.topLeft.y, clampBoundary.bottomRight.y);
    yMax = clamp(yMax, clampBoundary.topLeft.y, clampBoundary.bottomRight.y);
  }

  return {
    topLeft: new Vector2(xMin, yMin),
    bottomRight: new Vector2(xMax, yMax),
  };
}

// ─── Coordinate transform ─────────────────────────────────────────────────────

function glyphCoordToRenderCoord(
  glyphCoord: Vector2,
  origin: Vector2,
  fontSize: number,
  unitsPerEm: number,
): Vector2 {
  const scaledGlyphCoord = glyphCoord.times(fontSize / unitsPerEm);
  // y-axis is flipped: glyph space has y pointing up, canvas has y pointing down
  const flippedGlyphCoord = new Vector2(
    scaledGlyphCoord.x,
    -scaledGlyphCoord.y,
  );
  return origin.add(flippedGlyphCoord);
}

function glyphDistToRenderDist(
  glyphDist: number,
  fontSize: number,
  unitsPerEm: number,
): number {
  return (glyphDist * fontSize) / unitsPerEm;
}

// ─── Rendering pipeline ───────────────────────────────────────────────────────

function transformPoints(
  glyph: GlyphData,
  origin: Vector2,
  fontSize: number,
  unitsPerEm: number,
): PointOnContour[] {
  return glyph.points.map((pt) => ({
    vec: glyphCoordToRenderCoord(pt.vec, origin, fontSize, unitsPerEm),
    onCurve: pt.onCurve,
  }));
}

function splitPointsIntoContours(
  points: PointOnContour[],
  glyph: GlyphData,
): PointOnContour[][] {
  let startPointIndex = 0;
  const pointsSplitByContour = [];
  for (const contour of glyph.contours) {
    pointsSplitByContour.push(points.slice(startPointIndex, contour + 1));
    startPointIndex = contour + 1;
  }
  return pointsSplitByContour;
}

function processedContoursToRenderedPixels(
  processedContours: Vector2[][],
  renderSize: Vector2,
): {
  windingNumbers: number[][];
  renderedPixels: boolean[][];
  xMin: number;
  yMin: number;
} {
  if (processedContours.length === 0) {
    return { windingNumbers: [], renderedPixels: [], xMin: 0, yMin: 0 };
  }

  // Compute bounding box of all the points (rounded to integer)
  const bbox = computeBbox(processedContours.flat(2), true, {
    topLeft: new Vector2(0, 0),
    bottomRight: renderSize,
  });
  const xMin = bbox.topLeft.x;
  const xMax = bbox.bottomRight.x;
  const yMin = bbox.topLeft.y;
  const yMax = bbox.bottomRight.y;

  const edges = processedContoursToEdges(processedContours);

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

  // Map winding numbers to filled/unfilled booleans
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

// ─── Public API ───────────────────────────────────────────────────────────────

export function renderGlyph(
  glyph: GlyphData,
  origin: Vector2,
  fontSize: number,
  unitsPerEm: number,
  renderSize: Vector2,
  decasteljauIters: number = 3,
) {
  const transformedPoints = transformPoints(
    glyph,
    origin,
    fontSize,
    unitsPerEm,
  );
  const contours = splitPointsIntoContours(transformedPoints, glyph);
  const processedContours = contours.map((contour) => {
    contour = insertImpliedOnCurvePoints(contour);
    for (let i = 0; i < decasteljauIters; i++) {
      contour = interpolateContour(contour);
    }
    return contour.filter((pt) => pt.onCurve).map((pt) => pt.vec);
  });
  const { renderedPixels, xMin, yMin } = processedContoursToRenderedPixels(
    processedContours,
    renderSize,
  );
  return { transformedPoints, processedContours, renderedPixels, xMin, yMin };
}

export function advanceOriginPastGlyph(
  glyph: GlyphData,
  origin: Vector2,
  fontSize: number,
  unitsPerEm: number,
): Vector2 {
  return origin.add(
    Vector2.right(
      glyphDistToRenderDist(glyph.hMetrics.advanceWidth, fontSize, unitsPerEm),
    ),
  );
}
