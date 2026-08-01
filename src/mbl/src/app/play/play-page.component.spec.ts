import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import type Phaser from 'phaser';

import { CompletedResultRequest, CompletedResultResponse, ResultsApiClient } from '../core/api/results-api.client';
import { AuthService } from '../core/auth/auth.service';
import { AuthStateService } from '../core/auth/auth-state.service';
import { AppLifecycleService } from '../core/lifecycle/app-lifecycle.service';
import {
  MATCH_SESSION_STORAGE,
  MATCH_SESSION_STORAGE_KEY,
  MatchSessionStore
} from '../core/session/match-session.store';
import type { ActiveMatchSession } from '../core/session/match-session.types';
import { PersistentMemoryStorage } from '../../testing/persistent-memory-storage';
import { CHECKPOINT_INTERVAL_MS, isPeriodicCheckpointDue } from './match-checkpoint-policy';
import { MatchEngine } from './match-engine';
import type { CompletedMatchSummary, MatchEngineCheckpoint } from './match-types';
import { PHASER_GAME_FACTORY, type PhaserGameFactory } from './phaser-game.component';
import { MATCH_ID_FACTORY, PlayPageComponent } from './play-page.component';

describe('PlayPageComponent', () => {
  let fixture: ComponentFixture<PlayPageComponent>;
  let resultsApi: Pick<ResultsApiClient, 'saveCompletedResult'>;
  let authService: Pick<AuthService, 'logout'>;
  let createGame: ReturnType<typeof vi.fn<PhaserGameFactory>>;
  let onComplete: ((summary: CompletedMatchSummary) => void) | undefined;
  let onCheckpoint: ((checkpoint: MatchEngineCheckpoint) => void) | undefined;
  let initialCheckpoint: MatchEngineCheckpoint | undefined;
  let storage: PersistentMemoryStorage;
  let background: Subject<void>;

  beforeEach(async () => {
    storage = new PersistentMemoryStorage();
    background = new Subject<void>();
    onComplete = undefined;
    onCheckpoint = undefined;
    initialCheckpoint = undefined;
    createGame = vi.fn((_parent, checkpoint, complete, checkpointed, registerRequest) => {
      let currentCheckpoint = checkpoint;
      initialCheckpoint = checkpoint;
      onComplete = complete;
      onCheckpoint = (nextCheckpoint) => {
        currentCheckpoint = nextCheckpoint;
        checkpointed(nextCheckpoint);
      };
      registerRequest(() => checkpointed(currentCheckpoint));
      return {
        destroy: vi.fn(),
        scale: { updateBounds: vi.fn() }
      } as unknown as Phaser.Game;
    });

    resultsApi = {
      saveCompletedResult: vi.fn((request: CompletedResultRequest) => successfulSave(request))
    };
    authService = { logout: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PlayPageComponent],
      providers: [
        provideRouter([]),
        { provide: PHASER_GAME_FACTORY, useValue: createGame },
        { provide: ResultsApiClient, useValue: resultsApi },
        { provide: AuthService, useValue: authService },
        { provide: MATCH_SESSION_STORAGE, useValue: storage },
        { provide: MATCH_ID_FACTORY, useValue: () => 'match-stable-1' },
        { provide: AppLifecycleService, useValue: { background$: background.asObservable() } },
        {
          provide: AuthStateService,
          useValue: {
            player: () => ({ id: 'player-1', email: 'player@example.com' })
          }
        }
      ]
    }).compileComponents();

    fixture = createFixture();
  });

  afterEach(() => {
    fixture.destroy();
    background.complete();
  });

  it('creates and persists one stable session before mounting Phaser', () => {
    const persisted = readActiveSession();

    expect(persisted.ownerPlayerId).toBe('player-1');
    expect(persisted.clientMatchId).toBe('match-stable-1');
    expect(initialCheckpoint).toEqual(persisted.state.checkpoint);
    expect(createGame).toHaveBeenCalledOnce();
  });

  it('persists published checkpoints and restores the exact paused engine on remount', () => {
    const engine = MatchEngine.hydrate(initialCheckpoint!);
    engine.step(1_700);
    const checkpoint = engine.getCheckpoint();

    onCheckpoint?.(checkpoint);
    fixture.destroy();
    fixture = createFixture();

    expect(initialCheckpoint).toEqual(checkpoint);
    expect(initialCheckpoint?.elapsedMs).toBe(1_700);
    expect(readActiveSession().clientMatchId).toBe('match-stable-1');
    expect(createGame).toHaveBeenCalledTimes(2);
  });

  it('flushes the latest checkpoint immediately when the app backgrounds', () => {
    const store = TestBed.inject(MatchSessionStore);
    const saveActive = vi.spyOn(store, 'saveActive');
    const engine = MatchEngine.hydrate(initialCheckpoint!);
    engine.step(600);
    onCheckpoint?.(engine.getCheckpoint());
    saveActive.mockClear();

    background.next();

    expect(saveActive).toHaveBeenCalledOnce();
    expect(saveActive.mock.calls[0][0].checkpoint.elapsedMs).toBe(600);
  });

  it('coalesces the periodic scene checkpoint boundary to five seconds', () => {
    expect(isPeriodicCheckpointDue(0, CHECKPOINT_INTERVAL_MS - 1)).toBe(false);
    expect(isPeriodicCheckpointDue(0, CHECKPOINT_INTERVAL_MS)).toBe(true);
    expect(isPeriodicCheckpointDue(CHECKPOINT_INTERVAL_MS, CHECKPOINT_INTERVAL_MS * 2 - 1)).toBe(false);
  });

  it('saves one completed result when the Phaser host reports completion', () => {
    onComplete?.(completedSummary());

    expect(resultsApi.saveCompletedResult).toHaveBeenCalledTimes(1);
    expect(resultsApi.saveCompletedResult).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'Victory',
      durationSeconds: 90,
      completedAt: '2026-07-07T10:00:00.000Z',
      finalScore: 12,
      finalFrontlinePosition: 100
    }));
  });

  it('does not start a duplicate save while the first completion is saving', () => {
    const pendingSave = new Subject<CompletedResultResponse>();
    vi.mocked(resultsApi.saveCompletedResult).mockReturnValue(pendingSave.asObservable());

    onComplete?.(completedSummary());
    onComplete?.({ ...completedSummary(), outcome: 'Defeat' });

    expect(resultsApi.saveCompletedResult).toHaveBeenCalledTimes(1);
  });

  it('retries a failed save with the same completed-result payload and clientMatchId', () => {
    vi.mocked(resultsApi.saveCompletedResult)
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockImplementation((request) => successfulSave(request));

    onComplete?.(completedSummary());
    fixture.detectChanges();
    const retry = fixture.nativeElement.querySelector('.save-status button') as HTMLButtonElement;
    retry.click();

    const firstPayload = vi.mocked(resultsApi.saveCompletedResult).mock.calls[0][0];
    const retryPayload = vi.mocked(resultsApi.saveCompletedResult).mock.calls[1][0];
    expect(retryPayload).toBe(firstPayload);
    expect(retryPayload.clientMatchId).toBe(firstPayload.clientMatchId);
  });

  it('renders failed save retry status before the full-height game surface', () => {
    vi.mocked(resultsApi.saveCompletedResult).mockReturnValueOnce(throwError(() => new Error('offline')));

    onComplete?.(completedSummary());
    fixture.detectChanges();
    const mainChildren = Array.from(fixture.nativeElement.querySelector('main').children) as HTMLElement[];

    expect(mainChildren.map((element) => element.tagName.toLowerCase())).toEqual([
      'header',
      'section',
      'app-phaser-game'
    ]);
    expect(mainChildren[1].querySelector('button')?.textContent?.trim()).toBe('Retry save');
  });

  it('logs out through the existing auth service', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const logout = fixture.nativeElement.querySelector('.logout') as HTMLButtonElement;

    logout.click();

    expect(authService.logout).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/sign-in']);
  });

  function createFixture(): ComponentFixture<PlayPageComponent> {
    const nextFixture = TestBed.createComponent(PlayPageComponent);
    nextFixture.detectChanges();
    return nextFixture;
  }

  function readActiveSession(): ActiveMatchSession {
    const session = JSON.parse(storage.inspect(MATCH_SESSION_STORAGE_KEY)!) as ActiveMatchSession;
    if (session.state.kind !== 'active') {
      throw new Error('Expected an active match session.');
    }

    return session;
  }
});

function completedSummary(): CompletedMatchSummary {
  return {
    outcome: 'Victory',
    durationSeconds: 90,
    completedAt: '2026-07-07T10:00:00.000Z',
    finalScore: 12,
    finalFrontlinePosition: 100
  };
}

function successfulSave(request: CompletedResultRequest) {
  return of({
    resultId: 'result-1',
    clientMatchId: request.clientMatchId,
    outcome: request.outcome,
    savedAt: '2026-07-07T10:00:01.000Z'
  });
}
