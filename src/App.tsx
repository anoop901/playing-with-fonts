import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BBOX_FILL_COLOR,
  CANVAS_HEIGHT_PX,
  CANVAS_WIDTH_PX,
  CONTOUR_POINT_ON_CURVE_COLOR,
  CONTOUR_POINT_LINE_WIDTH,
  CONTOUR_POINT_RADIUS,
  FONT_SIZE,
  GLYPH_FILL_COLOR,
  GLYPH_LINE_WIDTH,
  GLYPH_STROKE_COLOR,
  TEXT_COORDS,
  CONTOUR_POINT_OFF_CURVE_COLOR,
  SHOW_CONTOUR_POINTS,
  PIXEL_GRID_SIZE,
  PIXEL_GRID_SCALE,
  PIXEL_GRID_ORIGIN_Y,
  PIXEL_GRID_ORIGIN_X,
  PIXEL_GRID_DOT_COLOR,
  PIXEL_GRIDLINE_COLOR,
} from "./constants";
import Button from "./components/Button";
import parseFontData, { type GlyphData } from "./parseFontFile";
import defaultFontUrl from "./assets/NotoSans-Regular.ttf";

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas2Ref = useRef<HTMLCanvasElement>(null);
  const canvas3Ref = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [drawCurves, setDrawCurves] = useState<boolean>(true);
  const [pixelGridOrigin, setPixelGridOrigin] = useState({
    x: PIXEL_GRID_ORIGIN_X,
    y: PIXEL_GRID_ORIGIN_Y,
  });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetch(defaultFontUrl)
      .then((res) => res.arrayBuffer())
      .then((buffer) => setFileData(new Uint8Array(buffer)))
      .catch((err) => console.error("Failed to load default font:", err));
  }, []);
  const [loadedFontName, setLoadedFontName] = useState<string | null>(null);
  const { data: fontData, error: fontError } = useMemo(() => {
    if (fileData == null) return { data: null, error: "no font file selected" };
    try {
      return { data: parseFontData(fileData), error: null };
    } catch (e) {
      return {
        data: null,
        error:
          "error parsing font file: " +
          (e instanceof Error ? e.message : String(e)),
      };
    }
  }, [fileData]);
  const [text, setText] = useState<string>("Hello, world!");

  const firstGlyph = useMemo(() => {
    const charCode = text.charCodeAt(0) || 0;
    const glyphIndex = fontData?.lookupGlyphIndex(charCode) ?? 0;
    return fontData?.glyphs[glyphIndex];
  }, [fontData, text]);

  function clear(ctx: CanvasRenderingContext2D) {
    const dpr = window.devicePixelRatio || 1;
    ctx.canvas.width = CANVAS_WIDTH_PX * dpr;
    ctx.canvas.height = CANVAS_HEIGHT_PX * dpr;
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, CANVAS_WIDTH_PX, CANVAS_HEIGHT_PX);
  }

  const drawGlyph = useCallback(
    (ctx: CanvasRenderingContext2D, glyph: GlyphData) => {
      // Draw bounding box
      ctx.fillStyle = BBOX_FILL_COLOR;
      ctx.fillRect(
        glyph.xMin,
        glyph.yMin,
        glyph.xMax - glyph.xMin,
        glyph.yMax - glyph.yMin,
      );

      // Draw glyph

      ctx.beginPath();
      let startPointIndex = 0;
      const impliedOnCurvePoints = [];
      for (const contour of glyph.contours) {
        const pointsInContour = glyph.points.slice(
          startPointIndex,
          contour + 1,
        );
        ctx.moveTo(pointsInContour[0].vec.x, pointsInContour[0].vec.y);

        for (let i = 1; i < pointsInContour.length; i++) {
          const lastPt = pointsInContour[i - 1];
          const pt = pointsInContour[i];
          if (drawCurves) {
            if (!lastPt.onCurve && !pt.onCurve) {
              const midpoint = lastPt.vec.lerp(pt.vec, 0.5);
              impliedOnCurvePoints.push(midpoint);
              ctx.quadraticCurveTo(
                lastPt.vec.x,
                lastPt.vec.y,
                midpoint.x,
                midpoint.y,
              );
            } else if (!lastPt.onCurve && pt.onCurve) {
              ctx.quadraticCurveTo(
                lastPt.vec.x,
                lastPt.vec.y,
                pt.vec.x,
                pt.vec.y,
              );
            } else if (lastPt.onCurve && pt.onCurve) {
              ctx.lineTo(pt.vec.x, pt.vec.y);
            }
          } else {
            ctx.lineTo(pt.vec.x, pt.vec.y);
          }
        }
        const lastPoint = pointsInContour[pointsInContour.length - 1];
        const firstPoint = pointsInContour[0];
        if (lastPoint.onCurve) {
          ctx.lineTo(firstPoint.vec.x, firstPoint.vec.y);
        } else {
          ctx.quadraticCurveTo(
            lastPoint.vec.x,
            lastPoint.vec.y,
            firstPoint.vec.x,
            firstPoint.vec.y,
          );
        }
        startPointIndex = contour + 1;
      }
      ctx.fillStyle = GLYPH_FILL_COLOR;
      ctx.strokeStyle = GLYPH_STROKE_COLOR;
      ctx.lineWidth = GLYPH_LINE_WIDTH;
      ctx.fill();
      if (GLYPH_LINE_WIDTH > 0) ctx.stroke();

      if (SHOW_CONTOUR_POINTS) {
        for (let i = 0; i < glyph.points.length; i++) {
          const pt = glyph.points[i];
          ctx.beginPath();
          ctx.arc(pt.vec.x, pt.vec.y, CONTOUR_POINT_RADIUS, 0, 2 * Math.PI);
          ctx.fillStyle = pt.onCurve
            ? CONTOUR_POINT_ON_CURVE_COLOR
            : CONTOUR_POINT_OFF_CURVE_COLOR;
          ctx.strokeStyle = ctx.fillStyle;
          ctx.fill();
          ctx.stroke();
        }
        ctx.lineWidth = CONTOUR_POINT_LINE_WIDTH;
        ctx.strokeStyle = CONTOUR_POINT_ON_CURVE_COLOR;
        for (const impliedOnCurvePoint of impliedOnCurvePoints) {
          ctx.beginPath();
          ctx.arc(
            impliedOnCurvePoint.x,
            impliedOnCurvePoint.y,
            CONTOUR_POINT_RADIUS,
            0,
            2 * Math.PI,
          );
          ctx.stroke();
        }
      }
    },
    [drawCurves],
  );

  const drawFromFontFile = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    clear(ctx);

    if (fontData == null) return;

    const scale = FONT_SIZE / fontData.unitsPerEm;
    ctx.translate(TEXT_COORDS.x, TEXT_COORDS.y);
    ctx.scale(scale, scale);
    ctx.save();
    ctx.scale(1, -1);

    for (const char of text) {
      const codePoint = char.codePointAt(0)!;
      const glyphIndex = fontData.lookupGlyphIndex(codePoint);
      const glyph = fontData.glyphs[glyphIndex];
      if (glyph != null) {
        drawGlyph(ctx, glyph);
      }
      ctx.translate(glyph?.hMetrics.advanceWidth ?? 0, 0);
    }
  }, [drawGlyph, fontData, text]);

  const drawSingleGlyph = useCallback(() => {
    const ctx = canvas3Ref.current?.getContext("2d");
    if (!ctx) return;
    if (!fontData) return;

    ctx.canvas.width = PIXEL_GRID_SIZE * PIXEL_GRID_SCALE;
    ctx.canvas.height = PIXEL_GRID_SIZE * PIXEL_GRID_SCALE;
    ctx.resetTransform();
    ctx.clearRect(0, 0, CANVAS_WIDTH_PX, CANVAS_HEIGHT_PX);

    ctx.scale(PIXEL_GRID_SCALE, PIXEL_GRID_SCALE);

    ctx.save();
    ctx.translate(pixelGridOrigin.x, pixelGridOrigin.y);
    const scale = FONT_SIZE / fontData.unitsPerEm;
    ctx.scale(scale, scale);
    ctx.scale(1, -1);
    const glyph = firstGlyph;
    if (!glyph) return;
    drawGlyph(ctx, glyph);
    ctx.restore();

    const xwMin = Math.floor(glyph.xMin * scale + pixelGridOrigin.x);
    const xwMax = Math.ceil(glyph.xMax * scale + pixelGridOrigin.x);
    const ywMin = Math.floor(-(glyph.yMax * scale) + pixelGridOrigin.y);
    const ywMax = Math.ceil(-(glyph.yMin * scale) + pixelGridOrigin.y);

    ctx.font = "0.2px monospace";
    ctx.fillStyle = PIXEL_GRID_DOT_COLOR;
    ctx.strokeStyle = PIXEL_GRIDLINE_COLOR;
    ctx.lineWidth = 0.03;

    for (let yw = ywMin; yw < ywMax; yw++) {
      for (let xw = xwMin; xw < xwMax; xw++) {
        ctx.strokeRect(xw, yw, 1, 1);
        ctx.fillRect(xw + 0.45, yw + 0.45, 0.1, 0.1);
        ctx.fillText(`${xw},${yw}`, xw + 0.15, yw + 0.25);
      }
    }

    ctx.save();
    ctx.translate(pixelGridOrigin.x, pixelGridOrigin.y);
    ctx.strokeStyle = "red";
    ctx.fillStyle = "red";
    ctx.lineWidth = 0.03;
    ctx.strokeRect(-0.1, -0.1, 0.2, 0.2);
    ctx.fillText("origin", 0.15, 0);
    ctx.restore();
  }, [drawGlyph, firstGlyph, fontData, pixelGridOrigin]);

  const drawDirectlyToCanvas = useCallback(async () => {
    const ctx = canvas2Ref.current?.getContext("2d");
    if (!ctx) return;
    clear(ctx);

    if (fontData == null || fileData == null) return;

    // 1. Create a FontFace from the raw binary
    const fontFace = new FontFace(
      "MyUploadedFont",
      fileData.buffer as ArrayBuffer,
    );

    // 2. Load it (parses the font and makes it ready to use)
    await fontFace.load();

    // 3. Register it with the document so the canvas can find it
    document.fonts.add(fontFace);
    setLoadedFontName("MyUploadedFont");

    const scale = FONT_SIZE / fontData.unitsPerEm;
    ctx.translate(TEXT_COORDS.x, TEXT_COORDS.y);
    ctx.scale(scale, scale);
    ctx.fillStyle = GLYPH_FILL_COLOR;

    // 4. Reference the font by the name you gave it in step 1
    ctx.font = `${fontData.unitsPerEm}px MyUploadedFont`;
    ctx.fillText(text, 0, 0);
  }, [fontData, fileData, text]);

  const draw = useCallback(() => {
    drawFromFontFile();
    drawDirectlyToCanvas();
    drawSingleGlyph();
  }, [drawDirectlyToCanvas, drawFromFontFile, drawSingleGlyph]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div className="min-h-full flex flex-col items-center justify-center py-4 gap-2">
      <div className="flex gap-3 items-center">
        <Button
          onClick={() => {
            draw();
          }}
        >
          Refresh
        </Button>
        <Button onClick={() => fileInputRef.current?.click()}>
          Upload File
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) {
              setSelectedFile(null);
              setFileData(null);
              return;
            }
            setSelectedFile(file.name);
            const reader = new FileReader();
            reader.onload = () => {
              setFileData(new Uint8Array(reader.result as ArrayBuffer));
            };
            reader.readAsArrayBuffer(file);
          }}
        />
        {selectedFile && (
          <span className="text-sm text-gray-600">{selectedFile}</span>
        )}
        <input
          type="text"
          value={text}
          className="border-2 p-2 rounded border-gray-200"
          onChange={(e) => setText(e.currentTarget.value)}
        />
      </div>
      {fontError && (
        <div className="px-4 py-2 rounded text-red-800 border-2 border-red-800 bg-red-200">
          {fontError}
        </div>
      )}
      {fontData && <div className="font-mono"></div>}
      <div className="flex gap-4 items-baseline">
        <input
          name="draw-curves"
          type="checkbox"
          checked={drawCurves}
          onChange={(e) => {
            setDrawCurves(e.currentTarget.checked);
          }}
        />
        <label>Draw Curves</label>
      </div>
      <div className="flex flex-col items-start">
        <div>Single glyph on pixel grid</div>
        <canvas
          ref={canvas3Ref}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setIsDragging(true);
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / PIXEL_GRID_SCALE;
            const y = (e.clientY - rect.top) / PIXEL_GRID_SCALE;
            setPixelGridOrigin({ x, y });
          }}
          onPointerMove={(e) => {
            if (!isDragging) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / PIXEL_GRID_SCALE;
            const y = (e.clientY - rect.top) / PIXEL_GRID_SCALE;
            setPixelGridOrigin({ x, y });
          }}
          onPointerUp={(e) => {
            setIsDragging(false);
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={(e) => {
            setIsDragging(false);
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          className="border-2 border-gray-200 [image-rendering:pixelated]"
        />
      </div>
      <div className="flex flex-col items-start">
        <div>Canvas path rendering</div>
        <canvas
          ref={canvasRef}
          style={{ width: CANVAS_WIDTH_PX, height: CANVAS_HEIGHT_PX }}
          className="border-2 border-gray-200 [image-rendering:pixelated]"
        />
      </div>
      <div className="flex flex-col items-start">
        <div>Canvas fillText</div>
        <canvas
          ref={canvas2Ref}
          style={{ width: CANVAS_WIDTH_PX, height: CANVAS_HEIGHT_PX }}
          className="border-2 border-gray-200 [image-rendering:pixelated]"
        />
      </div>
      <div>
        <div>SVG text</div>
        <svg
          width={CANVAS_WIDTH_PX}
          height={CANVAS_HEIGHT_PX}
          className="border-2 border-gray-200 [image-rendering:pixelated]"
        >
          {loadedFontName && (
            <text
              x={TEXT_COORDS.x}
              y={TEXT_COORDS.y}
              style={{
                font: `${FONT_SIZE}px ${loadedFontName}`,
                fill: GLYPH_FILL_COLOR,
              }}
            >
              {text}
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}

export default App;
