const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;
const cooldowns = new Map();

export const isRateLimited = (api) => {
  const until = cooldowns.get(api) || 0;
  return Date.now() < until;
};

export const markRateLimited = (api, cooldownMs) => {
  const ms = cooldownMs || DEFAULT_COOLDOWN_MS;
  cooldowns.set(api, Date.now() + ms);
  console.warn(`Rate limited: ${api}. Cooling down for ${ms / 1000}s.`);
};

export const resetRateLimit = (api) => {
  cooldowns.delete(api);
};

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class RequestQueue {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.running < this.concurrency) {
      this.running++;
      return;
    }
    await new Promise((resolve) => this.queue.push(resolve));
    this.running++;
  }

  release() {
    this.running--;
    if (this.queue.length > 0) {
      this.queue.shift()();
    }
  }

  async run(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

export const anilistQueue = new RequestQueue(2);

class CircuitBreaker {
  constructor({ failureThreshold = 5, resetTimeoutMs = 60000, halfOpenAfterMs = 30000 } = {}) {
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.halfOpenAfterMs = halfOpenAfterMs;
    this.failures = 0;
    this.state = "closed";
    this.lastFailureTime = 0;
  }

  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = "open";
      console.warn(`Circuit breaker OPEN after ${this.failures} failures. Halting requests for ${this.resetTimeoutMs / 1000}s.`);
    }
  }

  recordSuccess() {
    this.failures = 0;
    if (this.state !== "closed") {
      console.log("Circuit breaker CLOSED. Resuming requests.");
    }
    this.state = "closed";
  }

  isOpen() {
    if (this.state === "closed") return false;
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime >= this.halfOpenAfterMs) {
        this.state = "half-open";
        return false;
      }
      return true;
    }
    return false;
  }
}

export const anilistBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 120000,
  halfOpenAfterMs: 30000,
});

export const retryWithBackoff = async (fn, { maxRetries = 3, baseDelay = 2000, label = "operation" } = {}) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const isAborted = error.code === "ECONNABORTED" || error.message === "aborted" || error.message?.includes("abort");
      const isTimeout = error.code === "ECONNABORTED" || error.message?.includes("timeout");
      const is522 = error.response?.status === 522;
      const isRetryable = isAborted || isTimeout || is522 || !error.response || error.response.status >= 500 || error.response.status === 429;

      if (!isRetryable || isLastAttempt) throw error;

      const retryAfter = error.response?.headers?.["retry-after"];
      let waitMs;
      if (retryAfter) {
        waitMs = parseInt(retryAfter, 10) * 1000;
      } else if (is522) {
        waitMs = Math.min(baseDelay * Math.pow(3, attempt - 1), 120000);
      } else {
        waitMs = baseDelay * Math.pow(2, attempt - 1);
      }

      const jitter = Math.floor(Math.random() * 1000);
      waitMs += jitter;

      console.warn(`${label} attempt ${attempt}/${maxRetries} failed: ${error.message}. Retrying in ${(waitMs / 1000).toFixed(1)}s...`);
      await delay(waitMs);
    }
  }
};
