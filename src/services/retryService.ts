// RetryService — wraps Fable (and any external API) calls with exponential backoff.
// On persistent failure: status → 'GATEWAY_RETRY', not 'FAILED'. Logs to audit.

import { log } from './auditService';

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; label?: string } = {},
): Promise<T> {
  const { maxAttempts = 3, label = 'operation' } = options;
  let lastError: Error = new Error('No attempts made');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      console.error(
        `[RETRY] ${label} failed attempt ${attempt}/${maxAttempts}: ${lastError.message}` +
        (attempt < maxAttempts ? ` — retrying in ${delayMs / 1000}s` : ' — all retries exhausted'),
      );
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }

  void log('GATEWAY_RETRY_EXHAUSTED', 'system', {
    metadata: { label, error: lastError.message, attempts: maxAttempts },
  });

  throw lastError;
}
