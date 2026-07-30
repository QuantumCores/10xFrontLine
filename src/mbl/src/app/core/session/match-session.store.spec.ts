import { TestBed } from '@angular/core/testing';

import { PersistentMemoryStorage } from '../../../testing/persistent-memory-storage';
import { MATCH_CONFIG_VERSION } from '../../play/match-config';
import { MatchEngine } from '../../play/match-engine';
import type { CompletedResultRequest } from '../api/results-api.client';
import {
  MATCH_SESSION_STORAGE,
  MATCH_SESSION_STORAGE_KEY,
  MatchSessionStore
} from './match-session.store';
import { MATCH_SESSION_SCHEMA_VERSION } from './match-session.types';

describe('MatchSessionStore', () => {
  let storage: PersistentMemoryStorage;
  let store: MatchSessionStore;

  beforeEach(() => {
    storage = new PersistentMemoryStorage();
    store = createStore(storage);
  });

  it('round trips an active checkpoint with stable identity across store instances', () => {
    const checkpoint = createCheckpoint();

    expect(store.saveActive({
      ownerPlayerId: 'player-1',
      clientMatchId: 'match-1',
      checkpointedAt: '2026-07-30T10:00:00.000Z',
      checkpoint
    })).toBe(true);

    TestBed.resetTestingModule();
    const recreatedStore = createStore(storage);
    expect(recreatedStore.readForPlayer('player-1')).toEqual({
      schemaVersion: MATCH_SESSION_SCHEMA_VERSION,
      matchConfigVersion: MATCH_CONFIG_VERSION,
      ownerPlayerId: 'player-1',
      clientMatchId: 'match-1',
      checkpointedAt: '2026-07-30T10:00:00.000Z',
      state: { kind: 'active', checkpoint }
    });
    expect(recreatedStore.readForPlayer('player-2')).toBeNull();
    expect(storage.inspect(MATCH_SESSION_STORAGE_KEY)).not.toBeNull();
  });

  it('coalesces byte-equivalent active checkpoints', () => {
    const checkpoint = createCheckpoint();
    store.saveActive({
      ownerPlayerId: 'player-1',
      clientMatchId: 'match-1',
      checkpointedAt: '2026-07-30T10:00:00.000Z',
      checkpoint
    });

    expect(store.saveActive({
      ownerPlayerId: 'player-1',
      clientMatchId: 'match-1',
      checkpointedAt: '2026-07-30T10:00:05.000Z',
      checkpoint: structuredClone(checkpoint)
    })).toBe(true);
    expect(storage.setCalls).toBe(1);
  });

  it('atomically replaces active state with one exact pending result and confirms it', () => {
    saveActive(store);
    const request = createPendingRequest();

    expect(store.promoteToPending({
      ownerPlayerId: 'player-1',
      clientMatchId: 'match-1',
      checkpointedAt: '2026-07-30T10:01:00.000Z',
      request
    })).toBe(true);
    expect(store.readForPlayer('player-1')?.state).toEqual({
      kind: 'pending-result',
      request
    });
    expect(store.promoteToPending({
      ownerPlayerId: 'player-1',
      clientMatchId: 'match-1',
      checkpointedAt: '2026-07-30T10:02:00.000Z',
      request: structuredClone(request)
    })).toBe(true);
    expect(storage.setCalls).toBe(2);

    expect(store.confirmPending('player-2', 'match-1')).toBe(false);
    expect(store.confirmPending('player-1', 'match-1')).toBe(true);
    expect(store.readForPlayer('player-1')).toBeNull();
  });

  it('refuses pending promotion without the matching active match', () => {
    expect(store.promoteToPending({
      ownerPlayerId: 'player-1',
      clientMatchId: 'match-1',
      checkpointedAt: '2026-07-30T10:01:00.000Z',
      request: createPendingRequest()
    })).toBe(false);
    expect(storage.inspect(MATCH_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('silently removes corrupt, unsupported, and contradictory envelopes', () => {
    const invalidValues = [
      '{not-json',
      JSON.stringify({ schemaVersion: 999 }),
      JSON.stringify({
        schemaVersion: MATCH_SESSION_SCHEMA_VERSION,
        matchConfigVersion: MATCH_CONFIG_VERSION,
        ownerPlayerId: 'player-1',
        clientMatchId: 'match-1',
        checkpointedAt: '2026-07-30T10:00:00.000Z',
        state: {
          kind: 'active',
          checkpoint: createCheckpoint(),
          request: createPendingRequest()
        }
      }),
      JSON.stringify({
        schemaVersion: MATCH_SESSION_SCHEMA_VERSION,
        matchConfigVersion: MATCH_CONFIG_VERSION + 1,
        ownerPlayerId: 'player-1',
        clientMatchId: 'match-1',
        checkpointedAt: '2026-07-30T10:00:00.000Z',
        state: { kind: 'active', checkpoint: createCheckpoint() }
      })
    ];

    for (const value of invalidValues) {
      storage.seed(MATCH_SESSION_STORAGE_KEY, value);
      expect(store.readForPlayer('player-1')).toBeNull();
      expect(storage.inspect(MATCH_SESSION_STORAGE_KEY)).toBeNull();
    }
  });

  it('clears only matching ownership or all state explicitly', () => {
    saveActive(store);

    expect(store.clearOwner('player-2')).toBe(false);
    expect(store.readForPlayer('player-1')).not.toBeNull();
    expect(store.clearOwner('player-1')).toBe(true);
    expect(store.readForPlayer('player-1')).toBeNull();

    saveActive(store);
    expect(store.clearAll()).toBe(true);
    expect(store.readForPlayer('player-1')).toBeNull();
  });

  it('fails safely when storage access throws', () => {
    storage.failNext('set');
    expect(saveActive(store)).toBe(false);
    expect(store.readForPlayer('player-1')).toBeNull();

    saveActive(store);
    storage.failNext('get');
    expect(store.readForPlayer('player-1')).toBeNull();
    expect(storage.inspect(MATCH_SESSION_STORAGE_KEY)).not.toBeNull();

    storage.failNext('remove');
    expect(store.clearAll()).toBe(false);
    expect(storage.inspect(MATCH_SESSION_STORAGE_KEY)).not.toBeNull();
  });
});

function createStore(storage: PersistentMemoryStorage): MatchSessionStore {
  TestBed.configureTestingModule({
    providers: [{ provide: MATCH_SESSION_STORAGE, useValue: storage }]
  });
  return TestBed.inject(MatchSessionStore);
}

function createCheckpoint() {
  const engine = new MatchEngine({ seed: 123 });
  engine.startBuild('tank');
  engine.step(1_000);
  return engine.getCheckpoint();
}

function saveActive(store: MatchSessionStore): boolean {
  return store.saveActive({
    ownerPlayerId: 'player-1',
    clientMatchId: 'match-1',
    checkpointedAt: '2026-07-30T10:00:00.000Z',
    checkpoint: createCheckpoint()
  });
}

function createPendingRequest(): CompletedResultRequest {
  return {
    clientMatchId: 'match-1',
    outcome: 'Victory',
    durationSeconds: 90,
    completedAt: '2026-07-30T10:01:00.000Z',
    finalScore: 12,
    finalFrontlinePosition: 100
  };
}
