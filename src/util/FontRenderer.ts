import type { GlyphData } from "../parseFontFile";
import { Vector2 } from "./Vector2";

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

    const contoursVecs = [];

    for (let pointsInContour of pointsSplitByContour) {
      if (interpolateCurves) {
        // Insert implied points into array
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
        pointsInContour = pointsInContourWithImplied;

        // Interpolate curves using De Casteljau's Algorithm
        for (
          let decasteljaui = 0;
          decasteljaui < decasteljauIters;
          decasteljaui++
        ) {
          const pointsInContourInterpolated = [];
          // For each off-curve point, insert an on-curve point corresponding to t=0.5,
          // and two new off-curve points around it that split the curve in two at this point
          for (let i = 0; i < pointsInContour.length; i++) {
            const pt = pointsInContour[i];
            if (!pt.onCurve) {
              const lastPtV =
                pointsInContour[(i - 1) % pointsInContour.length].vec;
              const nextPtV =
                pointsInContour[(i + 1) % pointsInContour.length].vec;
              const midLastCurr = lastPtV.midpoint(pt.vec);
              const midNextCurr = nextPtV.midpoint(pt.vec);
              const bezierMidpoint = midLastCurr.midpoint(midNextCurr);
              pointsInContourInterpolated.push({
                onCurve: false,
                vec: midLastCurr,
              });
              pointsInContourInterpolated.push({
                onCurve: true,
                vec: bezierMidpoint,
              });
              pointsInContourInterpolated.push({
                onCurve: false,
                vec: midNextCurr,
              });
            } else {
              pointsInContourInterpolated.push(pt);
            }
          }
          pointsInContour = pointsInContourInterpolated;
        }

        // Remove off-curve points before drawing (unless we didn't use them to interpolate)
        pointsInContour = pointsInContour.filter((pt) => pt.onCurve);
      }

      contoursVecs.push(pointsInContour.map((pt) => pt.vec));
    }

    return contoursVecs;
  }
}
