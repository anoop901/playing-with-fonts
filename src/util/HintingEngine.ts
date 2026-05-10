import type { PointOnContour } from "../parseFontFile";

function formatHex(n: number, numDigits: number = 8) {
  return "0x" + n.toString(16).padStart(numDigits, "0").toUpperCase();
}
function formatHexB(n: number) {
  return formatHex(n, 2);
}
function formatHexW(n: number) {
  return formatHex(n, 4);
}

export class HintingEngine {
  origPoints: PointOnContour[];
  points: PointOnContour[];
  instructions: number[];
  iidx: number = 0;

  cvt: number[] = [];

  stack: number[] = [];
  rp0: number = 0;
  rp1: number = 0;
  rp2: number = 0;
  loop: number = 1;

  constructor(origPoints: PointOnContour[], instructions: number[]) {
    this.origPoints = origPoints;
    // Deep copy points
    this.points = origPoints.map((x) => ({ vec: x.vec, onCurve: x.onCurve }));
    this.instructions = instructions;
  }

  runAll() {
    while (this.iidx < this.instructions.length) {
      try {
        this.runNextInstruction();
      } catch (error) {
        console.error(error);
        break;
      }
    }
    this.logState();
  }

  logState() {
    console.log(
      "stack",
      this.stack.map((n) => formatHex(n)),
    );
    console.log("RP0", formatHex(this.rp0));
    console.log("RP1", formatHex(this.rp1));
    console.log("RP2", formatHex(this.rp2));
    console.log("loop", formatHex(this.loop));
  }

  runNextInstruction() {
    const opidx = this.iidx;
    const instruction = this.instructions[this.iidx++];
    if (instruction === 0x00) {
      const a = instruction & 0x1;
      console.log(`${opidx}: SVTCA[${a}]`);
      // TODO
    } else if (instruction === 0x10) {
      console.log(`${opidx}: SRP0`);
      this.runSRP0();
    } else if (instruction === 0x11) {
      console.log(`${opidx}: SRP1`);
      this.runSRP1();
    } else if (instruction === 0x12) {
      console.log(`${opidx}: SRP2`);
      this.runSRP2();
    } else if (instruction === 0x17) {
      console.log(`${opidx}: SLOOP`);
      this.runSLOOP();
    } else if (instruction === 0x2b) {
      console.log(`${opidx}: CALL`);
      this.runCALL();
    } else if (0x2e <= instruction && instruction <= 0x2f) {
      const a = instruction & 0x1;
      console.log(`${opidx}: MDAP[${a}]`);
      // TODO
    } else if (0x30 <= instruction && instruction <= 0x31) {
      const a = instruction & 0x1;
      console.log(`${opidx}: IUP[${a}]`);
      // TODO
    } else if (0x32 <= instruction && instruction <= 0x33) {
      const a = instruction & 0x1;
      console.log(`${opidx}: SHP[${a}]`);
      this.runSHP(a);
    } else if (instruction === 0x39) {
      console.log(`${opidx}: IP`);
      // TODO
    } else if (0x3e <= instruction && instruction <= 0x3f) {
      const a = instruction & 0x1;
      console.log(`${opidx}: MIAP[${a}]`);
      // TODO
    } else if (instruction === 0x40) {
      console.log(`${opidx}: NPUSHB`);
      this.runNPUSHB();
    } else if (instruction === 0x41) {
      console.log(`${opidx}: NPUSHW`);
      this.runNPUSHW();
    } else if (instruction === 0x5d) {
      console.log(`${opidx}: DELTAP1`);
      this.runDELTAP1();
    } else if (instruction === 0x71) {
      console.log(`${opidx}: DELTAP2`);
      this.runDELTAP1();
    } else if (0xb0 <= instruction && instruction <= 0xb7) {
      const abc = instruction & 0x7;
      console.log(`${opidx}: PUSHB[${abc.toString(2).padStart(3, "0")}]`);
      this.runPUSHB(abc);
    } else if (0xb8 <= instruction && instruction <= 0xbf) {
      const abc = instruction & 0x7;
      console.log(`${opidx}: PUSHW[${abc.toString(2).padStart(3, "0")}]`);
      this.runPUSHW(abc);
    } else if (0xe0 <= instruction && instruction <= 0xff) {
      const abcde = instruction & 0x1f;
      const a = (instruction & 0x10) >> 4;
      const b = (instruction & 0x8) >> 3;
      const c = (instruction & 0x4) >> 2;
      const de = instruction & 0x3;
      console.log(`${opidx}: MIRP[${abcde.toString(2).padStart(5, "0")}]`);
      this.runMIRP(a, b, c, de);
    } else {
      throw new Error(
        `${opidx}: unknown instruction ${formatHexB(instruction)}`,
      );
    }
  }
  runSLOOP() {
    const loop = this.pop();
    console.log({ loop });
    this.loop = loop;
  }

  pushBytes(n: number) {
    console.log(`pushing ${n} bytes`);
    this.stack.push(...this.instructions.slice(this.iidx, this.iidx + n));
    this.iidx += n;
  }

  pushWords(n: number) {
    console.log(`pushing ${n} words`);
    for (let i = 0; i < n; i++) {
      this.stack.push(
        (this.instructions[this.iidx + i * 2] << 8) |
          this.instructions[this.iidx + i * 2 + 1],
      );
    }
    this.iidx += n * 2;
  }

  pop(): number {
    const v = this.stack.pop();
    if (v == null) throw new Error("attempt to pop empty stack");
    return v;
  }

  runNPUSHB() {
    const n = this.instructions[this.iidx++];
    this.pushBytes(n);
  }
  runNPUSHW() {
    const n = this.instructions[this.iidx++];
    this.pushWords(n);
  }

  runPUSHB(abc: number) {
    const n = abc + 1;
    this.pushBytes(n);
  }

  runPUSHW(abc: number) {
    const n = abc + 1;
    this.pushWords(n);
  }

  runSRP0() {
    this.rp0 = this.pop();
  }

  runSRP1() {
    this.rp1 = this.pop();
  }

  runSRP2() {
    this.rp2 = this.pop();
  }

  runMIRP(a: number, b: number, c: number, de: number) {
    const cvtEntryNumber = this.pop();
    const pointNumber = this.pop();
    console.log({ cvtEntryNumber, pointNumber });
    if (a) {
      this.rp0 = pointNumber;
    }
    // TODO
  }

  runCALL() {
    const functionIdentifier = this.pop();
    console.log({ functionIdentifier });
    // TODO
  }

  runSHP(a: number) {
    const pp = [];
    for (let i = 0; i < this.loop; i++) {
      pp.push(this.pop());
    }
    console.log({ pp });
    // TODO
  }

  runDELTAP1() {
    const n = this.pop();
    const pairs = [];
    console.log({ n });
    for (let i = 0; i < n; i++) {
      this.pop();
      this.pop();
    }
  }
}
