import { inject, Injectable, InjectionToken } from '@angular/core';

import type { CompletedResultRequest } from '../api/results-api.client';
import type { StorageLike } from '../auth/token-storage.service';
import { MATCH_CONFIG_VERSION } from '../../play/match-config';
import { MatchEngine } from '../../play/match-engine';
import {
  MATCH_SESSION_SCHEMA_VERSION,
  type MatchSessionEnvelope,
  type PromotePendingResultSession,
  type SaveActiveMatchSession
} from './match-session.types';

export const MATCH_SESSION_STORAGE_KEY = 'frontLine.matchSession';

export const MATCH_SESSION_STORAGE = new InjectionToken<StorageLike | null>('MATCH_SESSION_STORAGE', {
  providedIn: 'root',
  factory: () => getBrowserStorage()
});

@Injectable({ providedIn: 'root' })
export class MatchSessionStore {
  private readonly storage = inject(MATCH_SESSION_STORAGE);

  readOwnerPlayerId(): string | null {
    return this.readStoredSession()?.ownerPlayerId ?? null;
  }

  readForPlayer(ownerPlayerId: string): MatchSessionEnvelope | null {
    const session = this.readStoredSession();
    return session?.ownerPlayerId === ownerPlayerId ? structuredClone(session) : null;
  }

  saveActive(input: SaveActiveMatchSession): boolean {
    if (!isIdentity(input.ownerPlayerId) ||
        !isIdentity(input.clientMatchId) ||
        !isTimestamp(input.checkpointedAt) ||
        !MatchEngine.isCheckpointValid(input.checkpoint)) {
      return false;
    }

    const current = this.readStoredSession();
    if (current?.state.kind === 'active' &&
        current.ownerPlayerId === input.ownerPlayerId &&
        current.clientMatchId === input.clientMatchId &&
        JSON.stringify(current.state.checkpoint) === JSON.stringify(input.checkpoint)) {
      return true;
    }

    const session: MatchSessionEnvelope = {
      schemaVersion: MATCH_SESSION_SCHEMA_VERSION,
      matchConfigVersion: MATCH_CONFIG_VERSION,
      ownerPlayerId: input.ownerPlayerId,
      clientMatchId: input.clientMatchId,
      checkpointedAt: input.checkpointedAt,
      state: {
        kind: 'active',
        checkpoint: structuredClone(input.checkpoint)
      }
    };
    return this.writeSession(session);
  }

  promoteToPending(input: PromotePendingResultSession): boolean {
    if (!isIdentity(input.ownerPlayerId) ||
        !isIdentity(input.clientMatchId) ||
        !isTimestamp(input.checkpointedAt) ||
        !isCompletedResultRequest(input.request) ||
        input.request.clientMatchId !== input.clientMatchId) {
      return false;
    }

    const current = this.readStoredSession();
    if (!current ||
        current.ownerPlayerId !== input.ownerPlayerId ||
        current.clientMatchId !== input.clientMatchId) {
      return false;
    }

    if (current.state.kind === 'pending-result') {
      return JSON.stringify(current.state.request) === JSON.stringify(input.request);
    }

    const session: MatchSessionEnvelope = {
      schemaVersion: MATCH_SESSION_SCHEMA_VERSION,
      matchConfigVersion: MATCH_CONFIG_VERSION,
      ownerPlayerId: input.ownerPlayerId,
      clientMatchId: input.clientMatchId,
      checkpointedAt: input.checkpointedAt,
      state: {
        kind: 'pending-result',
        request: structuredClone(input.request)
      }
    };
    return this.writeSession(session);
  }

  confirmPending(ownerPlayerId: string, clientMatchId: string): boolean {
    const current = this.readStoredSession();
    if (current?.ownerPlayerId !== ownerPlayerId ||
        current.clientMatchId !== clientMatchId ||
        current.state.kind !== 'pending-result') {
      return false;
    }

    return this.removeStoredSession();
  }

  clearOwner(ownerPlayerId: string): boolean {
    const current = this.readStoredSession();
    if (current?.ownerPlayerId !== ownerPlayerId) {
      return false;
    }

    return this.removeStoredSession();
  }

  clearAll(): boolean {
    return this.removeStoredSession();
  }

  private readStoredSession(): MatchSessionEnvelope | null {
    let rawSession: string | null;
    try {
      rawSession = this.storage?.getItem(MATCH_SESSION_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }

    if (!rawSession) {
      return null;
    }

    try {
      const session: unknown = JSON.parse(rawSession);
      if (!isMatchSessionEnvelope(session)) {
        this.removeStoredSession();
        return null;
      }

      return session;
    } catch {
      this.removeStoredSession();
      return null;
    }
  }

  private writeSession(session: MatchSessionEnvelope): boolean {
    try {
      this.storage?.setItem(MATCH_SESSION_STORAGE_KEY, JSON.stringify(session));
      return this.storage !== null;
    } catch {
      return false;
    }
  }

  private removeStoredSession(): boolean {
    try {
      this.storage?.removeItem(MATCH_SESSION_STORAGE_KEY);
      return this.storage !== null;
    } catch {
      return false;
    }
  }
}

function isMatchSessionEnvelope(value: unknown): value is MatchSessionEnvelope {
  if (!isRecord(value) ||
      !hasExactKeys(value, [
        'schemaVersion',
        'matchConfigVersion',
        'ownerPlayerId',
        'clientMatchId',
        'checkpointedAt',
        'state'
      ]) ||
      value['schemaVersion'] !== MATCH_SESSION_SCHEMA_VERSION ||
      value['matchConfigVersion'] !== MATCH_CONFIG_VERSION ||
      !isIdentity(value['ownerPlayerId']) ||
      !isIdentity(value['clientMatchId']) ||
      !isTimestamp(value['checkpointedAt']) ||
      !isRecord(value['state'])) {
    return false;
  }

  const state = value['state'];
  if (state['kind'] === 'active') {
    return hasExactKeys(state, ['kind', 'checkpoint']) &&
      MatchEngine.isCheckpointValid(state['checkpoint']) &&
      value['matchConfigVersion'] === state['checkpoint'].matchConfigVersion;
  }

  return state['kind'] === 'pending-result' &&
    hasExactKeys(state, ['kind', 'request']) &&
    isCompletedResultRequest(state['request']) &&
    state['request'].clientMatchId === value['clientMatchId'];
}

function isCompletedResultRequest(value: unknown): value is CompletedResultRequest {
  return isRecord(value) &&
    isIdentity(value['clientMatchId']) &&
    (value['outcome'] === 'Victory' || value['outcome'] === 'Defeat') &&
    Number.isInteger(value['durationSeconds']) &&
    Number(value['durationSeconds']) >= 1 &&
    Number(value['durationSeconds']) <= 86_400 &&
    isTimestamp(value['completedAt']) &&
    Number.isInteger(value['finalScore']) &&
    Number(value['finalScore']) >= -10_000 &&
    Number(value['finalScore']) <= 10_000 &&
    typeof value['finalFrontlinePosition'] === 'number' &&
    Number.isFinite(value['finalFrontlinePosition']) &&
    value['finalFrontlinePosition'] >= 0 &&
    value['finalFrontlinePosition'] <= 100;
}

function isIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length && expectedKeys.every((key) => key in value);
}

function getBrowserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
