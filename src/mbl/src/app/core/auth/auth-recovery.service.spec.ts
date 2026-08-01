import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { PersistentMemoryStorage } from '../../../testing/persistent-memory-storage';
import { MatchEngine } from '../../play/match-engine';
import {
  MATCH_SESSION_STORAGE,
  MatchSessionStore
} from '../session/match-session.store';
import { AuthRecoveryService, normalizeInternalReturnUrl } from './auth-recovery.service';
import { AuthStateService } from './auth-state.service';
import { AUTH_STORAGE } from './token-storage.service';

describe('AuthRecoveryService', () => {
  let authStorage: PersistentMemoryStorage;
  let matchStorage: PersistentMemoryStorage;
  let authState: AuthStateService;
  let matchSessions: MatchSessionStore;
  let recovery: AuthRecoveryService;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    authStorage = new PersistentMemoryStorage();
    matchStorage = new PersistentMemoryStorage();
    authStorage.seed('frontLine.authSession', sessionFor('player-1'));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AUTH_STORAGE, useValue: authStorage },
        { provide: MATCH_SESSION_STORAGE, useValue: matchStorage }
      ]
    });

    authState = TestBed.inject(AuthStateService);
    matchSessions = TestBed.inject(MatchSessionStore);
    recovery = TestBed.inject(AuthRecoveryService);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    saveActiveMatch(matchSessions);
  });

  it('invalidates credentials once and preserves match state across concurrent 401 reports', () => {
    recovery.reportUnauthorized('/play');
    recovery.reportUnauthorized('/play');

    expect(authState.session()).toBeNull();
    expect(authStorage.inspect('frontLine.authSession')).toBeNull();
    expect(matchSessions.readForPlayer('player-1')).not.toBeNull();
    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/sign-in'], {
      queryParams: { returnUrl: '/play' }
    });
    expect(recovery.state()).toBe('reauthentication-in-flight');
  });

  it('resumes the same player without deleting the persisted match', () => {
    recovery.reportUnauthorized('/play');

    expect(recovery.completeVerification('player-1')).toBe('same-player-resumed');
    expect(matchSessions.readForPlayer('player-1')).not.toBeNull();
  });

  it('deletes the original player match when another player verifies', () => {
    recovery.reportUnauthorized('/play');

    expect(recovery.completeVerification('player-2')).toBe('different-player-cleared');
    expect(matchSessions.readForPlayer('player-1')).toBeNull();
  });

  it('resolves a different player from persistent ownership after injector recreation', () => {
    recovery.reportUnauthorized('/play');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AUTH_STORAGE, useValue: authStorage },
        { provide: MATCH_SESSION_STORAGE, useValue: matchStorage }
      ]
    });

    const recreatedRecovery = TestBed.inject(AuthRecoveryService);
    const recreatedSessions = TestBed.inject(MatchSessionStore);

    expect(recreatedRecovery.completeVerification('player-2')).toBe('different-player-cleared');
    expect(recreatedSessions.readForPlayer('player-1')).toBeNull();
  });

  it('normalizes return URLs to safe internal application paths', () => {
    expect(normalizeInternalReturnUrl('/play?retry=true')).toBe('/play?retry=true');
    expect(normalizeInternalReturnUrl('https://attacker.example/play')).toBe('/play');
    expect(normalizeInternalReturnUrl('//attacker.example/play')).toBe('/play');
    expect(normalizeInternalReturnUrl('/\\attacker.example')).toBe('/play');
  });

  it('invalidates in-memory credentials even when persisted removal fails', () => {
    authStorage.failNext('remove');

    recovery.reportUnauthorized('/play');

    expect(authState.session()).toBeNull();
    expect(authState.token()).toBeNull();
    expect(matchSessions.readForPlayer('player-1')).not.toBeNull();
  });
});

function sessionFor(playerId: string) {
  return {
    token: `token-${playerId}`,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    player: { id: playerId, email: `${playerId}@example.com` }
  };
}

function saveActiveMatch(store: MatchSessionStore): void {
  store.saveActive({
    ownerPlayerId: 'player-1',
    clientMatchId: 'match-1',
    checkpointedAt: '2026-08-01T10:00:00.000Z',
    checkpoint: new MatchEngine({ seed: 123 }).getCheckpoint()
  });
}
