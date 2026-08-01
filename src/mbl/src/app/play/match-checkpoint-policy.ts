export const CHECKPOINT_INTERVAL_MS = 5_000;

export function isPeriodicCheckpointDue(lastCheckpointElapsedMs: number, elapsedMs: number): boolean {
  return elapsedMs - lastCheckpointElapsedMs >= CHECKPOINT_INTERVAL_MS;
}
