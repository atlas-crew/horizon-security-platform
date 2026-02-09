export class Rng {
  private state: number;

  constructor(seed: number) {
    // xorshift32 requires non-zero internal state
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  nextU32(): number {
    // xorshift32
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }

  float(): number {
    // [0,1)
    return this.nextU32() / 0x1_0000_0000;
  }

  int(minIncl: number, maxIncl: number): number {
    if (maxIncl < minIncl) throw new Error(`rng.int invalid range ${minIncl}..${maxIncl}`);
    const span = maxIncl - minIncl + 1;
    return minIncl + (this.nextU32() % span);
  }

  bool(p = 0.5): boolean {
    return this.float() < p;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('rng.pick called with empty array');
    return arr[this.int(0, arr.length - 1)];
  }

  shuffleInPlace<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}

