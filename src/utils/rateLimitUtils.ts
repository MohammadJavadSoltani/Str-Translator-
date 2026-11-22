export class LruCache<V> {
  private readonly maxEntries: number;
  private readonly store = new Map<string, V>();

  constructor(maxEntries = 200) {
    this.maxEntries = Math.max(1, maxEntries);
  }

  get(key: string): V | undefined {
    const val = this.store.get(key);
    if (val === undefined) return undefined;
    // Refresh recency
    this.store.delete(key);
    this.store.set(key, val);
    return val;
  }

  set(key: string, value: V): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, value);
  }

  get size(): number {
    return this.store.size;
  }
}

export function isRateLimitError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  return (
    raw.includes('RESOURCE_EXHAUSTED') ||
    raw.includes('"code":429') ||
    raw.includes('"code": 429') ||
    /\b429\b/.test(raw) ||
    raw.toLowerCase().includes('rate limit') ||
    raw.toLowerCase().includes('quota')
  );
}

export function isTransientServiceError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  return (
    raw.includes('"code":503') ||
    raw.includes('"code": 503') ||
    raw.includes('UNAVAILABLE') ||
    raw.includes('high demand') ||
    raw.includes('ECONNRESET') ||
    raw.includes('ETIMEDOUT') ||
    raw.includes('REQUEST_TIMEOUT')
  );
}

export function isRetryableModelError(err: unknown): boolean {
  return isRateLimitError(err) || isTransientServiceError(err);
}

export interface ModelCandidate {
  model: string;
  useThinkingLow: boolean;
}

function supportsThinkingLow(model: string): boolean {
  return model.startsWith('gemini-4-');
}

/**
 * Selects the ordered model fallback chain.
 * When the primary model is inside a rate-limit/timeout cooldown window, routes straight
 * to the fallback model first so requests avoid repeated stalls or 429s.
 */
export function selectModelPlan(options: {
  primaryModel: string;
  fallbackModel: string;
  preferFallback?: boolean;
  primaryCooldownUntil: number;
  now?: number;
}): ModelCandidate[] {
  const now = options.now ?? Date.now();
  const primaryCooling = now < options.primaryCooldownUntil;

  const primaryCandidate: ModelCandidate = {
    model: options.primaryModel,
    useThinkingLow: supportsThinkingLow(options.primaryModel),
  };
  const fallbackCandidate: ModelCandidate = {
    model: options.fallbackModel,
    useThinkingLow: supportsThinkingLow(options.fallbackModel),
  };

  if (options.preferFallback || primaryCooling) {
    return [fallbackCandidate, primaryCandidate];
  }

  return [primaryCandidate, fallbackCandidate];
}
