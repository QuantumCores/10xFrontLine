import type { CompletedResultRequest } from '../core/api/results-api.client';
import type { CompletedMatchSummary } from './match-types';

export interface MatchResultMapperOptions {
  clientMatchId?: string;
  completedAt?: string;
}

export function createCompletedResultRequest(
  summary: CompletedMatchSummary,
  options: MatchResultMapperOptions = {}
): CompletedResultRequest {
  return {
    clientMatchId: options.clientMatchId ?? createClientMatchId(),
    outcome: summary.outcome,
    durationSeconds: clamp(Math.round(summary.durationSeconds), 1, 86_400),
    completedAt: options.completedAt ?? summary.completedAt,
    finalScore: clamp(Math.round(summary.finalScore), -10_000, 10_000),
    finalFrontlinePosition: clamp(Number(summary.finalFrontlinePosition.toFixed(2)), 0, 100)
  };
}

export function createClientMatchId(): string {
  const randomUuid = globalThis.crypto?.randomUUID();
  if (randomUuid) {
    return randomUuid;
  }

  return `match-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
