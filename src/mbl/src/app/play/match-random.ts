export const MATCH_RANDOM_ALGORITHM = 'mulberry32' as const;

export interface MatchRandomState {
  algorithm: typeof MATCH_RANDOM_ALGORITHM;
  state: number;
}

export class MatchRandom {
  private state: number;

  constructor(state: MatchRandomState) {
    if (!isMatchRandomState(state)) {
      throw new Error('Invalid match random state.');
    }

    this.state = state.state;
  }

  static create(seed = createMatchRandomSeed()): MatchRandom {
    return new MatchRandom({ algorithm: MATCH_RANDOM_ALGORITHM, state: seed });
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  getState(): MatchRandomState {
    return { algorithm: MATCH_RANDOM_ALGORITHM, state: this.state };
  }
}

export function createMatchRandomSeed(): number {
  const values = new Uint32Array(1);
  globalThis.crypto?.getRandomValues?.(values);
  if (values[0] !== 0) {
    return values[0];
  }

  return (Date.now() ^ Math.floor(Math.random() * 0x1_0000_0000)) >>> 0;
}

export function isMatchRandomState(value: unknown): value is MatchRandomState {
  if (!isRecord(value)) {
    return false;
  }

  return value['algorithm'] === MATCH_RANDOM_ALGORITHM &&
    Number.isInteger(value['state']) &&
    Number(value['state']) >= 0 &&
    Number(value['state']) <= 0xffff_ffff;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
