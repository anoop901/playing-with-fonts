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
} from "./constants";
import Button from "./components/Button";
import parseFontData, { type GlyphData } from "./parseFontFile";
import defaultFontUrl from "./assets/Georgia.ttf";
import { FontRenderer } from "./util/FontRenderer";
import { Vector2 } from "./util/Vector2";
import clamp from "./util/clamp";
import Input from "./components/Input";
import Select from "./components/Select";
import Labeled from "./components/Labeled";
import Toggle from "./components/Toggle";
import Slider from "./components/Slider";

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
  const [text, setText] = useState<string>("H");
  const [fontSize, setFontSize] = useState<number>(FONT_SIZE);
  const [decasteljauIters, setDecasteljauIters] = useState<number>(1);

  const glyphs = useMemo(() => {
    return Array.from(text).map((c: string) => {
      const charCode = c.charCodeAt(0) || 0;
      const glyphIndex = fontData?.lookupGlyphIndex(charCode) ?? 0;
      return fontData?.glyphs[glyphIndex];
    });
  }, [fontData, text]);

  const fontRenderers = useMemo(() => {
    if (!fontData) return [];
    let cursorX = pixelGridOrigin.x;
    return glyphs.map((glyph) => {
      const renderer = new FontRenderer(
        new Vector2(cursorX, pixelGridOrigin.y),
        fontSize,
        fontData.unitsPerEm,
        new Vector2(PIXEL_GRID_SIZE, PIXEL_GRID_SIZE),
      );
      if (glyph) {
        cursorX +=
          (glyph.hMetrics.advanceWidth * fontSize) / fontData.unitsPerEm;
      }
      return renderer;
    });
  }, [fontData, glyphs, pixelGridOrigin.x, pixelGridOrigin.y, fontSize]);

  const renderResults = useMemo(() => {
    return glyphs.map((glyph, i) => {
      const renderer = fontRenderers[i];
      if (glyph == null || !renderer)
        return { processedContours: [], windingNumbers: [] };
      return renderer.renderGlyph(glyph, decasteljauIters, drawCurves);
    });
  }, [glyphs, fontRenderers, decasteljauIters, drawCurves]);

  const drawGlyph = useCallback(
    (ctx: CanvasRenderingContext2D, processedContours: Vector2[][]) => {
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
      ctx.fill();
    },
    [],
  );

  const drawPixelGrid = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      glyph: GlyphData,
      windingNumbers: number[][],
      renderer: FontRenderer,
    ) => {
      if (glyph == null || renderer == null) return;
      const transformedBboxMin = renderer.glyphCoordToRenderCoord(
        new Vector2(glyph.xMin, glyph.yMin),
      );
      const transformedBboxMax = renderer.glyphCoordToRenderCoord(
        new Vector2(glyph.xMax, glyph.yMax),
      );
      const xwMin = clamp(Math.floor(transformedBboxMin.x), 0, PIXEL_GRID_SIZE);
      const xwMax = clamp(Math.ceil(transformedBboxMax.x), 0, PIXEL_GRID_SIZE);
      const ywMin = clamp(Math.floor(transformedBboxMax.y), 0, PIXEL_GRID_SIZE);
      const ywMax = clamp(Math.ceil(transformedBboxMin.y), 0, PIXEL_GRID_SIZE);

      ctx.fillStyle = PIXEL_GRID_DOT_COLOR;
      ctx.lineWidth = 0.03;

      for (let yw = ywMin; yw < ywMax; yw++) {
        for (let xw = xwMin; xw < xwMax; xw++) {
          const windingNumber = windingNumbers[yw][xw];
          const dotRadius =
            windingNumber === 0 ? 0.05 : viewOutline ? 0.35 : 0.45;
          ctx.fillRect(
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

  const drawGlyphOnPixelGrid = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx == null || fontData == null) return;

    ctx.canvas.width = CANVAS_SIZE;
    ctx.canvas.height = CANVAS_SIZE;
    ctx.resetTransform();
    ctx.scale(PIXEL_GRID_SCALE, PIXEL_GRID_SCALE);

    if (!fontRenderers.length) return;

    for (let ci = 0; ci < text.length; ci++) {
      const renderer = fontRenderers[ci];
      const glyph = glyphs[ci];
      const processedContours = renderResults[ci].processedContours;
      const windingNumbers = renderResults[ci].windingNumbers;
      if (viewOutline) {
        drawGlyph(ctx, processedContours);
      }
      if (viewPixels && glyph != null) {
        drawPixelGrid(ctx, glyph, windingNumbers, renderer);
      }
    }

    // Mark the origin of the first glyph
    const originW = fontRenderers[0].glyphCoordToRenderCoord(Vector2.ZERO);
    ctx.strokeStyle = "red";
    ctx.fillStyle = "red";
    ctx.lineWidth = 0.03;
    ctx.strokeRect(originW.x - 0.1, originW.y - 0.1, 0.2, 0.2);
  }, [
    drawGlyph,
    drawPixelGrid,
    fontData,
    fontRenderers,
    glyphs,
    renderResults,
    text.length,
    viewOutline,
    viewPixels,
  ]);

  useEffect(() => {
    drawGlyphOnPixelGrid();
  }, [drawGlyphOnPixelGrid]);

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

        <Toggle
          label={"Draw curves"}
          checked={drawCurves}
          onCheckedChange={(checked) => setDrawCurves(checked)}
        />

        {drawCurves && (
          <Labeled label="De Casteljau Iterations">
            <Slider
              min={0}
              max={3}
              step={1}
              value={decasteljauIters}
              onValueChange={(value) => setDecasteljauIters(value)}
            />
          </Labeled>
        )}

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
        <div className="grid grid-cols-[64px_1fr] gap-y-2">
          <div className="text-heading">Glyph</div>
          <div className="text-heading">Instructions</div>
          {Array.from(text).map((c, i) => {
            const glyph = glyphs[i];
            const instructions = glyph?.instructions ?? [];
            return (
              <>
                <div>{c}</div>

                <div>
                  <div>(length: {instructions.length})</div>
                  <div className="grid grid-cols-8 font-mono">
                    {instructions.map((inst) => (
                      <div>
                        {inst.toString(16).padStart(2, "0").toUpperCase()}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })}
        </div>
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
