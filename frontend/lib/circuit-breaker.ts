type State = "closed" | "open" | "half-open";

interface Options {
  threshold: number;
  cooldownMs: number;
}

class CircuitBreaker {
  private state: State = "closed";
  private failures = 0;
  private openedAt = 0;

  constructor(private opts: Options) {}

  isOpen(): boolean {
    if (this.state === "open") {
      if (Date.now() - this.openedAt > this.opts.cooldownMs) {
        this.state = "half-open";
        return false;
      }
      return true;
    }
    return false;
  }

  success() {
    this.failures = 0;
    this.state = "closed";
  }

  failure() {
    this.failures++;
    if (this.failures >= this.opts.threshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }

  getState() {
    return this.state;
  }
}

export const mcpBreaker = new CircuitBreaker({
  threshold: 3,
  cooldownMs: 15_000,
});
