import type { PointOnContour } from "../parseFontFile";

export class HintingEngine {
  origPoints: PointOnContour[];
  points: PointOnContour[];
  instructions: number[];
  iidx: number = 0;

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
  }

  runNextInstruction() {
    const opidx = this.iidx;
    const instruction = this.instructions[this.iidx++];
    if (instruction === 0x40) {
      const n = this.instructions[this.iidx++];
      console.log(`${opidx}: NPUSHB[${n}]`);
      this.runNPUSHB(n);
    } else if (instruction === 0x41) {
      const n = this.instructions[this.iidx++];
      console.log(`${opidx}: NPUSHW[${n}]`);
      this.runNPUSHW(n);
    } else if (0xb0 <= instruction && instruction <= 0xb7) {
      const abc = instruction & 0x7;
      console.log(`${opidx}: PUSHB[${abc}]`);
      this.runPUSHB(abc);
    } else if (0xb8 <= instruction && instruction <= 0xbf) {
      const abc = instruction & 0x7;
      console.log(`${opidx}: PUSHW[${abc}]`);
      this.runPUSHW(abc);
    } else {
      throw new Error(
        `${opidx}: unknown instruction 0x${instruction.toString(16).padStart(2, "0").toUpperCase()}`,
      );
    }
  }

  runNPUSHB(n: number) {
    this.iidx += n;
    // TODO: use stack
  }

  runNPUSHW(n: number) {
    this.iidx += n * 2;
    // TODO: use stack
  }

  runPUSHB(abc: number) {
    const n = abc + 1;
    this.iidx += n;
    // TODO: use stack
  }
  runPUSHW(abc: number) {
    const n = abc + 1;
    this.iidx += n * 2;
    // TODO: use stack
  }
}
