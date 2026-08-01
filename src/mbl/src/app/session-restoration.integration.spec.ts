import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { AppState } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import type Phaser from 'phaser';

import { routes } from './app.routes';
import { API_BASE_URL } from './core/api/api-base-url';
import type { VerifyCodeResponse } from './core/api/auth-api.client';
import type { CompletedResultRequest } from './core/api/results-api.client';
import { AuthRecoveryService } from './core/auth/auth-recovery.service';
import { AuthService } from './core/auth/auth.service';
import { AuthStateService } from './core/auth/auth-state.service';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AUTH_STORAGE } from './core/auth/token-storage.service';
import {
  APP_LIFECYCLE_PLUGIN,
  type AppLifecyclePlugin
} from './core/lifecycle/app-lifecycle.service';
import {
  MATCH_SESSION_STORAGE,
  MATCH_SESSION_STORAGE_KEY,
  MatchSessionStore
} from './core/session/match-session.store';
import type {
  ActiveMatchSession,
  PendingResultMatchSession
} from './core/session/match-session.types';
import { MatchEngine } from './play/match-engine';
import type { CompletedMatchSummary, MatchEngineCheckpoint } from './play/match-types';
import { MATCH_ID_FACTORY, PlayPageComponent } from './play/play-page.component';
import { PHASER_GAME_FACTORY, type PhaserGameFactory } from './play/phaser-game.component';
import { PersistentMemoryStorage } from '../testing/persistent-memory-storage';

describe('session restoration across cold Angular bootstrap', () => {
  const apiBaseUrl = 'https://api.test/api';
  let authStorage: PersistentMemoryStorage;
  let matchStorage: PersistentMemoryStorage;
  let lifecyclePlugin: TestLifecyclePlugin;
  let createdGames: CapturedGame[];
  let matchIdSequence: number;
  let fixture: ComponentFixture<PlayPageComponent> | undefined;

  beforeEach(() => {
    authStorage = new PersistentMemoryStorage();
    matchStorage = new PersistentMemoryStorage();
    lifecyclePlugin = new TestLifecyclePlugin();
    createdGames = [];
    matchIdSequence = 0;
  });

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
    TestBed.resetTestingModule();
  });

  it('restores a valid player and equivalent paused active match after injector recreation', async () => {
    authStorage.seed('frontLine.authSession', sessionFor('player-1'));
    await bootstrap();
    expect(TestBed.inject(AuthStateService).player()?.id).toBe('player-1');

    fixture = createPlayPage();
    const firstGame = createdGames[0];
    const originalMatchId = readActiveSession().clientMatchId;
    const runningEngine = MatchEngine.hydrate(firstGame.initialCheckpoint);
    expect(runningEngine.startBuild('tank').accepted).toBe(true);
    runningEngine.step(1_750);
    const savedCheckpoint = runningEngine.getCheckpoint();
    firstGame.checkpoint(savedCheckpoint);
    lifecyclePlugin.emit(false);

    fixture.destroy();
    fixture = undefined;
    await bootstrap();
    fixture = createPlayPage();

    const restoredGame = createdGames[1];
    expect(readActiveSession().clientMatchId).toBe(originalMatchId);
    expect(restoredGame.initialCheckpoint).toEqual(savedCheckpoint);
    expect(restoredGame.initialCheckpoint.elapsedMs).toBe(1_750);

    const uninterrupted = MatchEngine.hydrate(savedCheckpoint);
    const restored = MatchEngine.hydrate(restoredGame.initialCheckpoint);
    uninterrupted.step(2_500);
    restored.step(2_500);
    expect(restored.getSnapshot()).toEqual(uninterrupted.getSnapshot());
    expect(restored.getCheckpoint()).toEqual(uninterrupted.getCheckpoint());
  });

  it('restores the exact pending result and retries it after one same-player recovery flow', async () => {
    authStorage.seed('frontLine.authSession', sessionFor('player-1'));
    await bootstrap();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = createPlayPage();

    createdGames[0].complete(completedSummary());
    TestBed.inject(HttpClient).get(`${apiBaseUrl}/profile`).subscribe({ error: () => undefined });
    const http = TestBed.inject(HttpTestingController);
    const protectedRequests = http.match((request) =>
      request.url === `${apiBaseUrl}/results` || request.url === `${apiBaseUrl}/profile`
    );
    expect(protectedRequests).toHaveLength(2);
    protectedRequests.forEach((request) =>
      request.flush({}, { status: 401, statusText: 'Unauthorized' })
    );

    const pending = readPendingSession();
    const exactPayload = structuredClone(pending.state.request);
    expect(navigate).toHaveBeenCalledOnce();
    expect(TestBed.inject(AuthRecoveryService).state()).toBe('reauthentication-in-flight');
    expect(authStorage.inspect('frontLine.authSession')).toBeNull();

    fixture.destroy();
    fixture = undefined;
    await bootstrap();
    const auth = TestBed.inject(AuthService);
    let verifiedPlayerId: string | undefined;
    auth.verifyCode('player@example.com', 'CODE1234').subscribe((session) => {
      verifiedPlayerId = session.player.id;
    });
    TestBed.inject(HttpTestingController).expectOne(`${apiBaseUrl}/auth/verify-code`).flush(
      verifyResponse('player-1')
    );
    expect(verifiedPlayerId).toBe('player-1');
    expect(TestBed.inject(AuthRecoveryService).state()).toBe('same-player-resumed');

    fixture = createPlayPage();
    const retry = TestBed.inject(HttpTestingController).expectOne(`${apiBaseUrl}/results`);
    expect(retry.request.body).toEqual(exactPayload);
    retry.flush(completedResponse(exactPayload));

    expect(createdGames).toHaveLength(1);
    expect(matchStorage.inspect(MATCH_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('deletes inherited state for a different verified player and on explicit logout', async () => {
    authStorage.seed('frontLine.authSession', sessionFor('player-1'));
    seedActiveSession('player-1', 'original-match');
    await bootstrap();
    TestBed.inject(HttpClient).get(`${apiBaseUrl}/results`).subscribe({ error: () => undefined });
    TestBed.inject(HttpTestingController).expectOne(`${apiBaseUrl}/results`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    await bootstrap();
    TestBed.inject(AuthService).verifyCode('other@example.com', 'CODE1234').subscribe();
    TestBed.inject(HttpTestingController).expectOne(`${apiBaseUrl}/auth/verify-code`).flush(
      verifyResponse('player-2')
    );
    expect(TestBed.inject(AuthRecoveryService).state()).toBe('different-player-cleared');
    expect(TestBed.inject(MatchSessionStore).readForPlayer('player-1')).toBeNull();

    fixture = createPlayPage();
    expect(readActiveSession().ownerPlayerId).toBe('player-2');
    expect(readActiveSession().clientMatchId).not.toBe('original-match');

    TestBed.inject(AuthService).logout();
    expect(matchStorage.inspect(MATCH_SESSION_STORAGE_KEY)).toBeNull();
    expect(authStorage.inspect('frontLine.authSession')).toBeNull();
    expect(TestBed.inject(AuthRecoveryService).state()).toBe('explicit-logout');
  });

  it('discards corrupt persisted match data and starts one fresh match', async () => {
    authStorage.seed('frontLine.authSession', sessionFor('player-1'));
    matchStorage.seed(MATCH_SESSION_STORAGE_KEY, '{not-json');
    await bootstrap();

    fixture = createPlayPage();

    expect(createdGames).toHaveLength(1);
    expect(readActiveSession().ownerPlayerId).toBe('player-1');
    expect(readActiveSession().clientMatchId).toBe('match-1');
  });

  async function bootstrap(): Promise<void> {
    fixture?.destroy();
    fixture = undefined;
    TestBed.resetTestingModule();
    lifecyclePlugin = new TestLifecyclePlugin();

    const gameFactory: PhaserGameFactory = (
      _parent,
      initialCheckpoint,
      onComplete,
      onCheckpoint,
      registerCheckpointRequest
    ) => {
      let currentCheckpoint = structuredClone(initialCheckpoint);
      const captured: CapturedGame = {
        initialCheckpoint: currentCheckpoint,
        complete: onComplete,
        checkpoint: (checkpoint) => {
          currentCheckpoint = structuredClone(checkpoint);
          onCheckpoint(checkpoint);
        }
      };
      createdGames.push(captured);
      registerCheckpointRequest(() => onCheckpoint(currentCheckpoint));
      return {
        destroy: vi.fn(),
        scale: { updateBounds: vi.fn() }
      } as unknown as Phaser.Game;
    };

    await TestBed.configureTestingModule({
      imports: [PlayPageComponent],
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: apiBaseUrl },
        { provide: AUTH_STORAGE, useValue: authStorage },
        { provide: MATCH_SESSION_STORAGE, useValue: matchStorage },
        { provide: APP_LIFECYCLE_PLUGIN, useValue: lifecyclePlugin },
        { provide: PHASER_GAME_FACTORY, useValue: gameFactory },
        { provide: MATCH_ID_FACTORY, useValue: () => `match-${++matchIdSequence}` }
      ]
    }).compileComponents();
  }

  function createPlayPage(): ComponentFixture<PlayPageComponent> {
    const nextFixture = TestBed.createComponent(PlayPageComponent);
    nextFixture.detectChanges();
    return nextFixture;
  }

  function seedActiveSession(ownerPlayerId: string, clientMatchId: string): void {
    matchStorage.seed(MATCH_SESSION_STORAGE_KEY, {
      schemaVersion: 1,
      matchConfigVersion: 1,
      ownerPlayerId,
      clientMatchId,
      checkpointedAt: '2026-08-01T10:00:00.000Z',
      state: {
        kind: 'active',
        checkpoint: new MatchEngine({ seed: 123 }).getCheckpoint()
      }
    });
  }

  function readActiveSession(): ActiveMatchSession {
    const session = JSON.parse(matchStorage.inspect(MATCH_SESSION_STORAGE_KEY)!) as ActiveMatchSession;
    if (session.state.kind !== 'active') {
      throw new Error('Expected an active match session.');
    }
    return session;
  }

  function readPendingSession(): PendingResultMatchSession {
    const session = JSON.parse(matchStorage.inspect(MATCH_SESSION_STORAGE_KEY)!) as PendingResultMatchSession;
    if (session.state.kind !== 'pending-result') {
      throw new Error('Expected a pending-result match session.');
    }
    return session;
  }
});

interface CapturedGame {
  initialCheckpoint: MatchEngineCheckpoint;
  complete: (summary: CompletedMatchSummary) => void;
  checkpoint: (checkpoint: MatchEngineCheckpoint) => void;
}

class TestLifecyclePlugin implements AppLifecyclePlugin {
  private listener?: (state: AppState) => void;

  addListener(
    _eventName: 'appStateChange',
    listener: (state: AppState) => void
  ): Promise<PluginListenerHandle> {
    this.listener = listener;
    return Promise.resolve({
      remove: async () => {
        this.listener = undefined;
      }
    });
  }

  emit(isActive: boolean): void {
    this.listener?.({ isActive });
  }
}

function sessionFor(playerId: string) {
  return {
    token: `token-${playerId}`,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    player: { id: playerId, email: `${playerId}@example.com` }
  };
}

function verifyResponse(playerId: string): VerifyCodeResponse {
  return {
    token: `token-${playerId}`,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    player: { id: playerId, email: `${playerId}@example.com` }
  };
}

function completedSummary(): CompletedMatchSummary {
  return {
    outcome: 'Victory',
    durationSeconds: 90,
    completedAt: '2026-08-01T10:30:00.000Z',
    finalScore: 12,
    finalFrontlinePosition: 100
  };
}

function completedResponse(request: CompletedResultRequest) {
  return {
    resultId: 'result-1',
    clientMatchId: request.clientMatchId,
    outcome: request.outcome,
    savedAt: '2026-08-01T10:30:01.000Z'
  };
}
