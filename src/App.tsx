import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FONT_SIZE,
  GLYPH_FILL_COLOR,
  PIXEL_GRID_SIZE,
  PIXEL_GRID_SCALE,
  PIXEL_GRID_ORIGIN_Y,
  PIXEL_GRID_ORIGIN_X,
  PIXEL_GRID_DOT_COLOR,
  CANVAS_SIZE,
  CONTOUR_POINT_ON_CURVE_COLOR,
  CONTOUR_POINT_RADIUS,
  CONTOUR_LINE_WIDTH,
  CONTOUR_POINT_OFF_CURVE_COLOR,
} from "./constants";
import Button from "./components/Button";
import parseFontData, { type PointOnContour } from "./parseFontFile";
import defaultFontUrl from "./assets/NotoSans-Regular.ttf";
import { advanceOriginPastGlyph, renderGlyph } from "./util/FontRenderer";
import { Vector2 } from "./util/Vector2";
import Input from "./components/Input";
import Select from "./components/Select";
import Labeled from "./components/Labeled";
import Slider from "./components/Slider";

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [firstGlyphOrigin, setFirstGlyphOrigin] = useState({
    x: PIXEL_GRID_ORIGIN_X,
    y: PIXEL_GRID_ORIGIN_Y,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<"outline" | "pixels" | "both">(
    "both",
  );

  const viewOutline = viewMode == "outline" || viewMode == "both";
  const viewPixels = viewMode == "pixels" || viewMode == "both";

  useEffect(() => {
    fetch(defaultFontUrl)
      .then((res) => res.arrayBuffer())
      .then((buffer) => setFileData(new Uint8Array(buffer)))
      .catch((err) => console.error("Failed to load default font:", err));
  }, []);
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
  const [text, setText] = useState<string>("Hello");
  const [fontSize, setFontSize] = useState<number>(FONT_SIZE);
  const [decasteljauIters, setDecasteljauIters] = useState<number>(1);

  const glyphs = useMemo(() => {
    if (!fontData) return [];
    return Array.from(text).map((c: string) => {
      const charCode = c.charCodeAt(0) || 0;
      const glyphIndex = fontData?.lookupGlyphIndex(charCode) ?? 0;
      return fontData.glyphs[glyphIndex];
    });
  }, [fontData, text]);

  // One origin (cursor position) per glyph — advances by each glyph's advance width
  const glyphOrigins = useMemo(() => {
    if (!fontData) return [];
    let cursor = new Vector2(firstGlyphOrigin.x, firstGlyphOrigin.y);
    const origins = [cursor];
    for (const glyph of glyphs) {
      if (glyph) {
        cursor = advanceOriginPastGlyph(
          glyph,
          cursor,
          fontSize,
          fontData.unitsPerEm,
        );
      }
      origins.push(cursor);
    }
    return origins;
  }, [fontData, glyphs, firstGlyphOrigin.x, firstGlyphOrigin.y, fontSize]);

  const renderResults = useMemo(() => {
    return glyphs.map((glyph, i) => {
      const origin = glyphOrigins[i];
      if (glyph == null || fontData == null) return null;
      return renderGlyph(
        glyph,
        origin,
        fontSize,
        fontData.unitsPerEm,
        new Vector2(PIXEL_GRID_SIZE, PIXEL_GRID_SIZE),
        decasteljauIters,
      );
    });
  }, [glyphs, glyphOrigins, fontData, fontSize, decasteljauIters]);

  const drawGlyphOutline = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      transformedPoints: PointOnContour[],
      processedContours: Vector2[][],
    ) => {
      ctx.beginPath();

      for (let c = 0; c < processedContours.length; c++) {
        const contourVecs = processedContours[c];
        if (contourVecs.length === 0) continue;

        // Draw this subpath on the canvas
        ctx.moveTo(
          contourVecs[contourVecs.length - 1].x,
          contourVecs[contourVecs.length - 1].y,
        );
        for (const contourVec of contourVecs) {
          ctx.lineTo(contourVec.x, contourVec.y);
        }
        ctx.closePath();
      }

      // Fill all the subpaths at once
      ctx.lineWidth = CONTOUR_LINE_WIDTH;
      ctx.fillStyle = GLYPH_FILL_COLOR;
      ctx.strokeStyle = CONTOUR_POINT_ON_CURVE_COLOR;
      ctx.fill();
      ctx.stroke();

      if (!viewPixels) {
        // ctx.fillStyle = CONTOUR_POINT_ON_CURVE_COLOR;
        // for (const contour of processedContours) {
        //   for (const pt of contour) {
        //     ctx.fillRect(
        //       pt.x - CONTOUR_POINT_RADIUS,
        //       pt.y - CONTOUR_POINT_RADIUS,
        //       2 * CONTOUR_POINT_RADIUS,
        //       2 * CONTOUR_POINT_RADIUS,
        //     );
        //   }
        // }

        for (const pt of transformedPoints) {
          ctx.fillStyle = pt.onCurve
            ? CONTOUR_POINT_ON_CURVE_COLOR
            : CONTOUR_POINT_OFF_CURVE_COLOR;
          ctx.fillRect(
            pt.vec.x - CONTOUR_POINT_RADIUS,
            pt.vec.y - CONTOUR_POINT_RADIUS,
            2 * CONTOUR_POINT_RADIUS,
            2 * CONTOUR_POINT_RADIUS,
          );
        }
      }
    },
    [viewPixels],
  );

  const drawGlyphPixels = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      renderedPixels: boolean[][],
      xMin: number,
      yMin: number,
    ) => {
      ctx.strokeStyle = PIXEL_GRID_DOT_COLOR;
      ctx.fillStyle = PIXEL_GRID_DOT_COLOR;
      ctx.lineWidth = 0.03;

      for (let dy = 0; dy < renderedPixels.length; dy++) {
        for (let dx = 0; dx < renderedPixels[dy].length; dx++) {
          const xw = dx + xMin;
          const yw = dy + yMin;
          const renderedPixel = renderedPixels[dy][dx];
          const dotRadius = viewOutline ? 0.35 : 0.5;

          const rectFn = renderedPixel
            ? ctx.fillRect.bind(ctx)
            : viewOutline
              ? ctx.strokeRect.bind(ctx)
              : () => {};
          rectFn(
            xw + 0.5 - dotRadius,
            yw + 0.5 - dotRadius,
            2 * dotRadius,
            2 * dotRadius,
          );
        }
      }
    },
    [viewOutline],
  );

  const drawGlyphOrigins = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      // Mark the origin of the first glyph
      for (const glyphOrigin of glyphOrigins) {
        ctx.strokeStyle = "red";
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        ctx.ellipse(glyphOrigin.x, glyphOrigin.y, 0.15, 0.15, 0, 0, 2 * Math.PI);
        ctx.stroke()
      }
    },
    [glyphOrigins],
  );

  const drawAllGlyphs = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx == null || fontData == null) return;

    ctx.canvas.width = CANVAS_SIZE;
    ctx.canvas.height = CANVAS_SIZE;
    ctx.resetTransform();
    ctx.scale(PIXEL_GRID_SCALE, PIXEL_GRID_SCALE);

    for (let ci = 0; ci < renderResults.length; ci++) {
      const renderResult = renderResults[ci];
      if (renderResult == null) continue;
      const {
        transformedPoints,
        processedContours,
        renderedPixels,
        xMin,
        yMin,
      } = renderResult;
      if (viewOutline) {
        drawGlyphOutline(ctx, transformedPoints, processedContours);
      }
      if (viewPixels) {
        drawGlyphPixels(ctx, renderedPixels, xMin, yMin);
      }
      drawGlyphOrigins(ctx);
    }
  }, [
    drawGlyphOrigins,
    drawGlyphOutline,
    drawGlyphPixels,
    fontData,
    renderResults,
    viewOutline,
    viewPixels,
  ]);

  useEffect(() => {
    drawAllGlyphs();
  }, [drawAllGlyphs]);

  const Settings = (
    <div className="w-80 overflow-hidden border-2 rounded border-border text-foreground font-semibold">
      {/* Header */}
      <div className="px-4 py-2 bg-background-2 border-b border-border">
        <h2 className="uppercase text-heading tracking-wide">Settings</h2>
      </div>

      <div className="px-4 py-2 flex flex-col gap-4 bg-background">
        <Labeled label="Font file">
          <div className="flex flex-col items-start">
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
            {selectedFile && <span className="">{selectedFile}</span>}
          </div>
        </Labeled>
        <Labeled label="Text to render">
          <Input
            type="text"
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
          />
        </Labeled>

        <Labeled label="View Mode">
          <Select
            value={viewMode}
            onChange={(value) =>
              setViewMode(value as "outline" | "pixels" | "both")
            }
            options={[
              { name: "Outline", value: "outline" },
              { name: "Pixels", value: "pixels" },
              { name: "Both", value: "both" },
            ]}
          />
        </Labeled>

        <Labeled label="De Casteljau Iterations">
          <Slider
            min={0}
            max={3}
            step={1}
            value={decasteljauIters}
            onValueChange={(value) => setDecasteljauIters(value)}
          />
        </Labeled>

        <Labeled label="Font Size">
          <Slider
            min={6}
            max={96}
            step={1}
            value={fontSize}
            format={(x) => `${x}px`}
            onValueChange={(value) => setFontSize(value)}
          />
        </Labeled>
      </div>
    </div>
  );

  return (
    <div className="min-h-full flex flex-row items-start justify-center py-4 gap-2 text-sm">
      <div className="flex flex-col items-start">
        <canvas
          ref={canvasRef}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setIsDragging(true);
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / PIXEL_GRID_SCALE;
            const y = (e.clientY - rect.top) / PIXEL_GRID_SCALE;
            setFirstGlyphOrigin({ x, y });
          }}
          onPointerMove={(e) => {
            if (!isDragging) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / PIXEL_GRID_SCALE;
            const y = (e.clientY - rect.top) / PIXEL_GRID_SCALE;
            setFirstGlyphOrigin({ x, y });
          }}
          onPointerUp={(e) => {
            setIsDragging(false);
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={(e) => {
            setIsDragging(false);
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          className="border-2 rounded border-border bg-background [image-rendering:pixelated]"
        />
      </div>{" "}
      <div className="w-80 flex flex-col gap-2 self">
        {fontError && (
          <div className="px-4 py-2 rounded text-danger-foreground border-2 border-danger-foreground bg-danger-background">
            {fontError}
          </div>
        )}
        {Settings}
      </div>
    </div>
  );
}

export default App;
