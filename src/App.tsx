import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CANVAS_HEIGHT_PX,
  CANVAS_WIDTH_PX,
  FONT_SIZE,
  GLYPH_FILL_COLOR,
  GLYPH_LINE_WIDTH,
  GLYPH_STROKE_COLOR,
  PIXEL_GRID_SIZE,
  PIXEL_GRID_SCALE,
  PIXEL_GRID_ORIGIN_Y,
  PIXEL_GRID_ORIGIN_X,
  PIXEL_GRID_DOT_COLOR,
  PIXEL_GRIDLINE_COLOR,
} from "./constants";
import Button from "./components/Button";
import parseFontData from "./parseFontFile";
import defaultFontUrl from "./assets/NotoSans-Regular.ttf";
import { FontRenderer } from "./util/FontRenderer";
import { Vector2 } from "./util/Vector2";

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [drawCurves, setDrawCurves] = useState<boolean>(true);
  const [pixelGridOrigin, setPixelGridOrigin] = useState({
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
  const [text, setText] = useState<string>("R");
  const [fontSize, setFontSize] = useState<number>(FONT_SIZE);
  const [decasteljauIters, setDecasteljauIters] = useState<number>(1);

  const firstGlyph = useMemo(() => {
    const charCode = text.charCodeAt(0) || 0;
    const glyphIndex = fontData?.lookupGlyphIndex(charCode) ?? 0;
    return fontData?.glyphs[glyphIndex];
  }, [fontData, text]);

  const fontRenderer = useMemo(() => {
    if (!fontData) return null;
    return new FontRenderer(
      new Vector2(pixelGridOrigin.x, pixelGridOrigin.y),
      fontSize,
      fontData.unitsPerEm,
      new Vector2(PIXEL_GRID_SIZE, PIXEL_GRID_SIZE),
    );
  }, [fontData, pixelGridOrigin.x, pixelGridOrigin.y, fontSize]);

  const { processedContours, windingNumbers } = useMemo(() => {
    if (!firstGlyph || !fontRenderer) {
      return { processedContours: [], windingNumbers: [] };
    }
    return fontRenderer.renderGlyph(firstGlyph, decasteljauIters, drawCurves);
  }, [firstGlyph, fontRenderer, decasteljauIters, drawCurves]);

  const drawGlyph = useCallback(
    (ctx: CanvasRenderingContext2D) => {
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
      ctx.fillStyle = GLYPH_FILL_COLOR;
      ctx.strokeStyle = GLYPH_STROKE_COLOR;
      ctx.lineWidth = GLYPH_LINE_WIDTH;
      ctx.fill();
      if (GLYPH_LINE_WIDTH > 0) ctx.stroke();
    },
    [processedContours],
  );

  const drawPixelGrid = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (firstGlyph == null || fontRenderer == null) return;
      const transformedBboxMin = fontRenderer.glyphCoordToRenderCoord(
        new Vector2(firstGlyph.xMin, firstGlyph.yMin),
      );
      const transformedBboxMax = fontRenderer.glyphCoordToRenderCoord(
        new Vector2(firstGlyph.xMax, firstGlyph.yMax),
      );
      const xwMin = Math.floor(transformedBboxMin.x);
      const xwMax = Math.ceil(transformedBboxMax.x);
      const ywMin = Math.floor(transformedBboxMax.y);
      const ywMax = Math.ceil(transformedBboxMin.y);

      ctx.fillStyle = PIXEL_GRID_DOT_COLOR;
      ctx.strokeStyle = PIXEL_GRIDLINE_COLOR;
      ctx.lineWidth = 0.03;

      for (let yw = ywMin; yw < ywMax; yw++) {
        for (let xw = xwMin; xw < xwMax; xw++) {
          const windingNumber = windingNumbers[yw] && windingNumbers[yw][xw];
          const dotRadius = viewOutline ? 0.4 : 0.5;
          if (windingNumber === 0 || windingNumber === undefined) {
            // ctx.strokeRect(
            //   xw + 0.5 - dotRadius,
            //   yw + 0.5 - dotRadius,
            //   2 * dotRadius,
            //   2 * dotRadius,
            // );
          } else {
            ctx.fillRect(
              xw + 0.5 - dotRadius,
              yw + 0.5 - dotRadius,
              2 * dotRadius,
              2 * dotRadius,
            );
          }
        }
      }
    },
    [firstGlyph, fontRenderer, viewOutline, windingNumbers],
  );

  const drawGlyphOnPixelGrid = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx == null || fontData == null) return;

    ctx.canvas.width = PIXEL_GRID_SIZE * PIXEL_GRID_SCALE;
    ctx.canvas.height = PIXEL_GRID_SIZE * PIXEL_GRID_SCALE;
    ctx.resetTransform();
    ctx.clearRect(0, 0, CANVAS_WIDTH_PX, CANVAS_HEIGHT_PX);
    ctx.scale(PIXEL_GRID_SCALE, PIXEL_GRID_SCALE);

    if (!fontRenderer) return;

    if (viewOutline) {
      drawGlyph(ctx);
    }
    if (viewPixels) {
      drawPixelGrid(ctx);
    }

    // Mark the origin
    const originW = fontRenderer.glyphCoordToRenderCoord(Vector2.ZERO);
    ctx.strokeStyle = "red";
    ctx.fillStyle = "red";
    ctx.lineWidth = 0.03;
    ctx.strokeRect(originW.x - 0.1, originW.y - 0.1, 0.2, 0.2);
  }, [
    drawGlyph,
    drawPixelGrid,
    fontData,
    fontRenderer,
    viewOutline,
    viewPixels,
  ]);

  useEffect(() => {
    drawGlyphOnPixelGrid();
  }, [drawGlyphOnPixelGrid]);

  return (
    <div className="min-h-full flex flex-col items-center justify-center py-4 gap-2">
      <div className="flex gap-3 items-center">
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
        <label>View Mode:</label>
        <select
          value={viewMode}
          onChange={(e) =>
            setViewMode(e.currentTarget.value as "outline" | "pixels" | "both")
          }
          className="border p-1 rounded"
        >
          <option value="both">Both</option>
          <option value="outline">Outline</option>
          <option value="pixels">Pixels</option>
        </select>
      </div>
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
      {drawCurves && (
        <div className="flex gap-4 items-baseline">
          <input
            name="decasteljau-iters"
            type="range"
            min="0"
            max="3"
            value={decasteljauIters}
            onChange={(e) => {
              setDecasteljauIters(Number(e.currentTarget.value));
            }}
          />
          <label>De Casteljau Iters: {decasteljauIters}</label>
        </div>
      )}
      <div className="flex gap-4 items-baseline">
        <input
          name="font-size"
          type="range"
          min="6"
          max="32"
          value={fontSize}
          onChange={(e) => {
            setFontSize(Number(e.currentTarget.value));
          }}
        />
        <label>Font Size: {fontSize}px</label>
      </div>
      <div className="flex flex-col items-start">
        <div>Single glyph on pixel grid</div>
        <canvas
          ref={canvasRef}
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
    </div>
  );
}

export default App;
