export interface RetryDecision {
  destination: 'retry' | 'dead-letter';
  nextRetryCount: number;
}

export function decideRetry(
  currentRetryCount: number,
  maximumRetries: number,
  retryable: boolean,
): RetryDecision {
  const normalizedCount = Number.isInteger(currentRetryCount)
    ? Math.max(currentRetryCount, 0)
    : 0;
  const nextRetryCount = normalizedCount + 1;

  return {
    destination:
      retryable && normalizedCount < maximumRetries ? 'retry' : 'dead-letter',
    nextRetryCount,
  };
}

export function retryCountFrom(headers: unknown): number {
  if (!isRecord(headers)) return 0;
  const value = headers['x-retry-count'];
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
