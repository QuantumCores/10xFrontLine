import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import type Phaser from 'phaser';

import { CompletedResultRequest, CompletedResultResponse, ResultsApiClient } from '../core/api/results-api.client';
import { AuthService } from '../core/auth/auth.service';
import { AuthStateService } from '../core/auth/auth-state.service';
import { CompletedMatchSummary } from './match-types';
import { PHASER_GAME_FACTORY, type PhaserGameFactory } from './phaser-game.component';
import { PlayPageComponent } from './play-page.component';

describe('PlayPageComponent', () => {
  let fixture: ComponentFixture<PlayPageComponent>;
  let resultsApi: Pick<ResultsApiClient, 'saveCompletedResult'>;
  let authService: Pick<AuthService, 'logout'>;
  let createGame: ReturnType<typeof vi.fn<PhaserGameFactory>>;
  let onComplete: ((summary: CompletedMatchSummary) => void) | undefined;

  beforeEach(async () => {
    onComplete = undefined;
    createGame = vi.fn((_parent, callback) => {
      onComplete = callback;
      return {
        destroy: vi.fn(),
        scale: {
          updateBounds: vi.fn()
        }
      } as unknown as Phaser.Game;
    });

    resultsApi = {
      saveCompletedResult: vi.fn((request: CompletedResultRequest) => successfulSave(request))
    };
    authService = {
      logout: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [PlayPageComponent],
      providers: [
        provideRouter([]),
        { provide: PHASER_GAME_FACTORY, useValue: createGame },
        { provide: ResultsApiClient, useValue: resultsApi },
        { provide: AuthService, useValue: authService },
        {
          provide: AuthStateService,
          useValue: {
            player: () => ({
              id: 'player-1',
              email: 'player@example.com'
            })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PlayPageComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
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

    expect(resultsApi.saveCompletedResult).toHaveBeenCalledTimes(2);
    expect(retryPayload).toBe(firstPayload);
    expect(retryPayload.clientMatchId).toBe(firstPayload.clientMatchId);
  });

  it('logs out through the existing auth service', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const logout = fixture.nativeElement.querySelector('.logout') as HTMLButtonElement;
    logout.click();

    expect(authService.logout).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/sign-in']);
  });
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
