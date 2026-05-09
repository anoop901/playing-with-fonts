import { Vector2 } from "./util/Vector2";

type TableDirectory = {
  offset: number;
  length: number;
};
export type GlyphData = {
  contours: number[];
  points: PointOnContour[];
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  instructions: number[];
  hMetrics: HMetrics;
};

type Flags = {
  onCurve: boolean;
  xShortVector: boolean;
  yShortVector: boolean;
  repeat: boolean;
  thisXIsSame: boolean;
  thisYIsSame: boolean;
};

export type PointOnContour = {
  vec: Vector2;
  onCurve: boolean;
};

function parseFlags(flags: number): Flags {
  return {
    onCurve: (flags & (1 << 0)) != 0,
    xShortVector: (flags & (1 << 1)) != 0,
    yShortVector: (flags & (1 << 2)) != 0,
    repeat: (flags & (1 << 3)) != 0,
    thisXIsSame: (flags & (1 << 4)) != 0,
    thisYIsSame: (flags & (1 << 5)) != 0,
  };
}

type CmapSubtable = {
  platformID: number;
  platformSpecificID: number;
  offset: number;
};

type HMetrics = {
  advanceWidth: number;
  lsb: number;
};

export default function parseFontData(data: Uint8Array) {
  let offset = 0;

  function readUint8(): number {
    const value = data[offset];
    offset++;
    return value;
  }

  function readAscii(length: number): string {
    const codePoints = [];
    for (let i = 0; i < length; i++) {
      codePoints.push(readUint8());
    }
    return String.fromCodePoint(...codePoints);
  }

  function readUint16(): number {
    const value = (readUint8() << 8) | readUint8();
    return value;
  }

  function readInt16(): number {
    const u = readUint16();
    return u >= 0x8000 ? u - 0x10000 : u;
  }

  function readUint32(): number {
    return (
      ((readUint8() << 24) |
        (readUint8() << 16) |
        (readUint8() << 8) |
        readUint8()) >>>
      0
    ); // >>> 0 keeps the result as an unsigned 32-bit integer
  }

  function readCoordinates(flags: Flags[], axis: "x" | "y") {
    const coords = [];
    let prev = 0;
    let currX = 0;
    for (const f of flags) {
      const shortVector = axis === "x" ? f.xShortVector : f.yShortVector;
      const isSame = axis === "x" ? f.thisXIsSame : f.thisYIsSame;
      if (shortVector) {
        const isPositive = isSame;
        const sign = isPositive ? 1 : -1;
        currX += readUint8() * sign;
        coords.push(currX);
        prev = currX;
      } else {
        if (isSame) {
          coords.push(prev);
          continue;
        }
        currX += readInt16();
        coords.push(currX);
        prev = currX;
      }
    }
    return coords;
  }

  function readGlyph(): GlyphData {
    const numberOfContours = readInt16();
    const xMin = readInt16();
    const yMin = readInt16();
    const xMax = readInt16();
    const yMax = readInt16();

    const contours = [];
    for (let i = 0; i < numberOfContours; i++) {
      contours.push(readUint16());
    }
    const numPoints = contours[contours.length - 1] + 1;
    const instructionLength = readUint16();
    const instructions = [];
    for (let instri = 0; instri < instructionLength; instri++) {
      instructions.push(readUint8());
    }
    const flags: Flags[] = [];
    while (flags.length < numPoints) {
      const currFlags = parseFlags(readUint8());
      flags.push(currFlags);
      if (currFlags.repeat) {
        const numCopies = readUint8();
        for (let j = 0; j < numCopies; j++) {
          flags.push(currFlags);
        }
      }
    }
    const xCoords = readCoordinates(flags, "x");
    const yCoords = readCoordinates(flags, "y");
    const points: PointOnContour[] = [];
    for (let i = 0; i < numPoints; i++) {
      points.push({
        vec: new Vector2(xCoords[i], yCoords[i]),
        onCurve: flags[i].onCurve,
      });
    }

    return {
      contours,
      points,
      xMin,
      yMin,
      xMax,
      yMax,
      instructions,
      hMetrics: { advanceWidth: 0, lsb: 0 },
    };
  }

  function readCmapSubtable(): CmapSubtable {
    const platformID = readUint16();
    const platformSpecificID = readUint16();
    const offset = readUint32();
    return { platformID, platformSpecificID, offset };
  }

  readAscii(4); // scalerType
  const numTables = readUint16();
  readUint16(); // searchRange
  readUint16(); // entrySelector
  readUint16(); // rangeShift

  const tableDirectory = new Map<string, TableDirectory>();

  for (let i = 0; i < numTables; i++) {
    const tableName = readAscii(4);
    readUint32(); // checksum
    const offset = readUint32();
    const length = readUint32();
    tableDirectory.set(tableName, { offset, length });
  }

  const glyfTable = tableDirectory.get("glyf");
  if (glyfTable == null) {
    throw new Error("glyf table not present");
  }
  const maxpTable = tableDirectory.get("maxp");
  if (maxpTable == null) {
    throw new Error("maxp table not present");
  }
  const headTable = tableDirectory.get("head");
  if (headTable == null) {
    throw new Error("head table not present");
  }
  const locaTable = tableDirectory.get("loca");
  if (locaTable == null) {
    throw new Error("loca table not present");
  }
  const cmapTable = tableDirectory.get("cmap");
  if (cmapTable == null) {
    throw new Error("cmap table not present");
  }
  const hheaTable = tableDirectory.get("hhea");
  if (hheaTable == null) {
    throw new Error("hhea table not present");
  }
  const hmtxTable = tableDirectory.get("hmtx");
  if (hmtxTable == null) {
    throw new Error("hmtx table not present");
  }

  offset = maxpTable.offset;
  readUint32(); // version
  const numGlyphs = readUint16();

  offset = headTable.offset;
  readUint32(); // version
  readUint32(); // fontRevision
  readUint32(); // checkSumAdjustment
  readUint32(); // magicNumber
  readUint16(); // flags
  const unitsPerEm = readUint16();
  offset += 8; // created
  offset += 8; // modified
  readInt16(); // xMin
  readInt16(); // yMin
  readInt16(); // xMax
  readInt16(); // yMax
  readUint16(); // maxStyle
  readUint16(); // lowestRecPPEM
  readInt16(); // fontDirectionHint
  const indexToLocFormat = readInt16();
  readInt16(); // glyphDataFormat

  const locShortFormat = indexToLocFormat === 0;
  const readLocEntry = locShortFormat ? readUint16 : readUint32;
  offset = locaTable.offset;
  const locs: (number | null)[] = [];
  for (let i = 0; i < numGlyphs; i++) {
    locs.push(readLocEntry());
  }
  for (let i = 0; i < locs.length - 1; i++) {
    if (locs[i] === locs[i + 1]) {
      locs[i] = null;
    }
  }

  const glyphs: GlyphData[] = [];
  for (const loc of locs) {
    if (loc != null) {
      offset = glyfTable.offset + (locShortFormat ? 2 : 1) * loc;
      glyphs.push(readGlyph());
    } else {
      glyphs.push({
        contours: [],
        points: [],
        xMin: 0,
        xMax: 0,
        yMin: 0,
        yMax: 0,
        instructions: [],
        hMetrics: {
          advanceWidth: 0,
          lsb: 0,
        },
      });
    }
  }

  let unicodeCmapOffset = null;

  offset = cmapTable.offset;
  readUint16(); // version
  const numberSubtables = readUint16(); // numberSubtables
  for (let i = 0; i < numberSubtables; i++) {
    const cmapSubtable = readCmapSubtable();
    if (cmapSubtable.platformID === 0) {
      unicodeCmapOffset = cmapSubtable.offset;
      break;
    }
  }

  if (unicodeCmapOffset == null) {
    throw new Error("no cmap subtable for Unicode platform");
  }

  offset = cmapTable.offset + unicodeCmapOffset;
  const cmapSubtableFormat = readUint16();

  let lookupGlyphIndex: (c: number) => number;

  if (cmapSubtableFormat === 4) {
    readUint16(); // length
    readUint16(); // language
    const segCountX2 = readUint16();
    readUint16(); // searchRange
    readUint16(); // entrySelector
    readUint16(); // rangeShift

    const segCount = segCountX2 >> 1;
    const endCode: number[] = [];
    for (let i = 0; i < segCount; i++) {
      endCode.push(readUint16());
    }
    readUint16(); // reservedPad
    const startCode: number[] = [];
    for (let i = 0; i < segCount; i++) {
      startCode.push(readUint16());
    }
    const idDelta: number[] = [];
    for (let i = 0; i < segCount; i++) {
      idDelta.push(readUint16());
    }
    const idRangeOffsetAddress = offset;
    const idRangeOffset: number[] = [];
    for (let i = 0; i < segCount; i++) {
      idRangeOffset.push(readUint16());
    }

    const segments = [];
    for (let i = 0; i < segCount; i++) {
      segments.push({
        startCode: startCode[i],
        endCode: endCode[i],
        idDelta: idDelta[i],
        idRangeOffset: idRangeOffset[i],
      });
    }

    lookupGlyphIndex = (c: number) => {
      let i;
      for (i = 0; i < segCount; i++) {
        if (c <= endCode[i]) {
          break;
        }
      }
      if (c < startCode[i]) {
        return 0;
      }
      if (idRangeOffset[i] > 0) {
        const idRangeOffsetIAddress = idRangeOffsetAddress + 2 * i;
        offset = idRangeOffsetIAddress;

        const glyphIndexAddress =
          idRangeOffset[i] + 2 * (c - startCode[i]) + idRangeOffsetIAddress;
        offset = glyphIndexAddress;
        const glyphIndex = readUint16();
        if (glyphIndex === 0) {
          return 0;
        }
        return (idDelta[i] + glyphIndex) % (1 << 16);
      } else {
        return (idDelta[i] + c) % (1 << 16);
      }
    };
  } else {
    throw new Error("unsupported cmap subtable format: " + cmapSubtableFormat);
  }

  offset = hheaTable.offset + 4;
  const ascender = readInt16();
  const descender = readInt16();
  offset = hheaTable.offset + 34;
  const numberOfHMetrics = readUint16();

  offset = hmtxTable.offset;
  for (let i = 0; i < numGlyphs; i++) {
    if (i < numberOfHMetrics) {
      glyphs[i].hMetrics = { advanceWidth: readUint16(), lsb: readInt16() };
    } else {
      glyphs[i].hMetrics = { advanceWidth: readUint16(), lsb: 0 };
    }
  }

  return {
    numTables,
    glyphs,
    unitsPerEm,
    ascender,
    descender,
    lookupGlyphIndex,
  };
}
