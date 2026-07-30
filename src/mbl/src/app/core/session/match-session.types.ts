import type { CompletedResultRequest } from '../api/results-api.client';
import type { MatchEngineCheckpoint } from '../../play/match-types';

export const MATCH_SESSION_SCHEMA_VERSION = 1;

interface MatchSessionBase {
  schemaVersion: typeof MATCH_SESSION_SCHEMA_VERSION;
  matchConfigVersion: number;
  ownerPlayerId: string;
  clientMatchId: string;
  checkpointedAt: string;
}

export interface ActiveMatchSession extends MatchSessionBase {
  state: {
    kind: 'active';
    checkpoint: MatchEngineCheckpoint;
  };
}

export interface PendingResultMatchSession extends MatchSessionBase {
  state: {
    kind: 'pending-result';
    request: CompletedResultRequest;
  };
}

export type MatchSessionEnvelope = ActiveMatchSession | PendingResultMatchSession;

export interface SaveActiveMatchSession {
  ownerPlayerId: string;
  clientMatchId: string;
  checkpointedAt: string;
  checkpoint: MatchEngineCheckpoint;
}

export interface PromotePendingResultSession {
  ownerPlayerId: string;
  clientMatchId: string;
  checkpointedAt: string;
  request: CompletedResultRequest;
}
