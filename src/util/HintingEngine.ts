import type { PointOnContour } from "../parseFontFile";

export class HintingEngine {
  origPoints: PointOnContour[];
  points: PointOnContour[];
  instructions: number[];
  iidx: number = 0;

  stack: number[] = [];

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
    console.log(
      "final stack",
      this.stack.map((x) => "0x" + x.toString(16).toUpperCase()),
    );
  }

  runNextInstruction() {
    const opidx = this.iidx;
    const instruction = this.instructions[this.iidx++];
    if (instruction === 0x40) {
      console.log(`${opidx}: NPUSHB`);
      this.runNPUSHB();
    } else if (instruction === 0x41) {
      console.log(`${opidx}: NPUSHW`);
      this.runNPUSHW();
    } else if (0xb0 <= instruction && instruction <= 0xb7) {
      const abc = instruction & 0x7;
      console.log(`${opidx}: PUSHB`);
      this.runPUSHB(abc);
    } else if (0xb8 <= instruction && instruction <= 0xbf) {
      const abc = instruction & 0x7;
      console.log(`${opidx}: PUSHW`);
      this.runPUSHW(abc);
    } else {
      throw new Error(
        `${opidx}: unknown instruction 0x${instruction.toString(16).padStart(2, "0").toUpperCase()}`,
      );
    }
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
}
