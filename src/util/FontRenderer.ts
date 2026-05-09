import type { PointOnContour, GlyphData } from "../parseFontFile";
import { Vector2 } from "./Vector2";

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
      const lastPtV = pointsInContour[(i - 1) % pointsInContour.length].vec;
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

  renderGlyph(
    glyph: GlyphData,
    decasteljauIters: number = 3,
    interpolateCurves: boolean,
  ) {
    // Transform all points from outline definition into render coords
    const transformedPoints = glyph.points.map((pt) => ({
      vec: this.glyphCoordToRenderCoord(pt.vec),
      onCurve: pt.onCurve,
    }));

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
      if (interpolateCurves) {
        // Interpolate curves using De Casteljau's Algorithm decasteljauIters times
        for (
          let decasteljaui = 0;
          decasteljaui < decasteljauIters;
          decasteljaui++
        ) {
          pointsInContour = interpolateContour(pointsInContour);
        }
        // Remove off-curve points before drawing
        pointsInContour = pointsInContour.filter((pt) => pt.onCurve);
      }

      processedContours.push(pointsInContour.map((pt) => pt.vec));
    }

    return processedContours;
  }
}
