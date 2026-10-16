/** Parses a comma-separated model list; the first entry is the preferred model. */
export function modelChain(spec: string): string[] {
  return spec
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

const retryable =
  /\b(429|500|502|503|504|404)\b|timeout|timed out|aborted|high demand|quota|unavailable|overloaded|fetch failed|ECONNRESET/i;

/** True for provider outages worth retrying on another model, false for logic errors. */
export function isProviderFailure(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return retryable.test(text);
}

/**
 * Runs `attempt` against each model in turn within one shared deadline, moving on only for
 * provider failures (overload, quota, timeout). Overload is usually transient, so the chain
 * is tried for `rounds` passes. Each attempt is also capped at `perAttemptMs`, so a model that
 * hangs cannot consume the whole budget and starve the next one. The last failure is rethrown.
 */
export type FallbackOptions = { deadlineMs: number; perAttemptMs?: number; rounds?: number };

export async function withModelFallback<T>(
  models: string[],
  { deadlineMs, perAttemptMs = deadlineMs, rounds = 2 }: FallbackOptions,
  attempt: (model: string, signal: AbortSignal) => Promise<T>,
  onFallback?: (failed: string, error: unknown) => void,
): Promise<T> {
  const deadline = Date.now() + deadlineMs;
  let lastError: unknown = new Error("No model is configured.");
  const order = Array.from({ length: rounds }, () => models).flat();
  for (const [index, model] of order.entries()) {
    const remaining = deadline - Date.now();
    if (remaining <= 500) break;
    try {
      return await attempt(model, AbortSignal.timeout(Math.min(remaining, perAttemptMs)));
    } catch (error) {
      lastError = error;
      if (!isProviderFailure(error)) throw error;
      if (index < order.length - 1) onFallback?.(model, error);
    }
  }
  throw lastError;
}
