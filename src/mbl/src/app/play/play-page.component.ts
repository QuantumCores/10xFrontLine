import { HttpErrorResponse } from '@angular/common/http';
import { Component, InjectionToken, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, take } from 'rxjs';

import { CompletedResultRequest, ResultsApiClient } from '../core/api/results-api.client';
import { AuthService } from '../core/auth/auth.service';
import { AuthStateService } from '../core/auth/auth-state.service';
import { AppLifecycleService } from '../core/lifecycle/app-lifecycle.service';
import { MatchSessionStore } from '../core/session/match-session.store';
import { MatchEngine } from './match-engine';
import { CompletedMatchSummary, MatchEngineCheckpoint } from './match-types';
import { PhaserGameComponent } from './phaser-game.component';
import { createCompletedResultRequest } from './match-result-mapper';

type SaveState = 'idle' | 'saving' | 'saved' | 'failed' | 'reauthenticating';

export const MATCH_ID_FACTORY = new InjectionToken<() => string>('MATCH_ID_FACTORY', {
  providedIn: 'root',
  factory: () => () => globalThis.crypto.randomUUID()
});

@Component({
  selector: 'app-play-page',
  imports: [PhaserGameComponent],
  templateUrl: './play-page.component.html',
  styleUrl: './play-page.component.scss'
})
export class PlayPageComponent implements OnInit, OnDestroy {
  protected readonly authState = inject(AuthStateService);

  private readonly authService = inject(AuthService);
  private readonly resultsApi = inject(ResultsApiClient);
  private readonly router = inject(Router);
  private readonly lifecycle = inject(AppLifecycleService);
  private readonly matchSessions = inject(MatchSessionStore);
  private readonly createMatchId = inject(MATCH_ID_FACTORY);
  private readonly lifecycleSubscription = new Subscription();
  private ownerPlayerId: string | null = null;
  private clientMatchId: string | null = null;
  private latestCheckpoint: MatchEngineCheckpoint | null = null;

  protected readonly sessionReady = signal(false);
  protected readonly initialCheckpoint = signal<MatchEngineCheckpoint | null>(null);

  protected readonly saveState = signal<SaveState>('idle');
  protected readonly resultPayload = signal<CompletedResultRequest | null>(null);
  protected readonly savedClientMatchId = signal<string | null>(null);
  protected readonly saveStatus = computed(() => {
    switch (this.saveState()) {
      case 'saving':
        return 'Saving completed match...';
      case 'saved':
        return `Saved result ${this.savedClientMatchId() ?? this.resultPayload()?.clientMatchId ?? ''}`.trim();
      case 'failed':
        return 'Result save failed. Retry when the API is reachable.';
      case 'reauthenticating':
        return 'Sign in again to resume saving this result.';
      default:
        return null;
    }
  });

  ngOnInit(): void {
    const player = this.authState.player();
    if (!player) {
      this.sessionReady.set(true);
      return;
    }

    this.ownerPlayerId = player.id;
    const restored = this.matchSessions.readForPlayer(player.id);
    if (restored?.state.kind === 'active') {
      this.clientMatchId = restored.clientMatchId;
      this.latestCheckpoint = restored.state.checkpoint;
    } else if (restored?.state.kind === 'pending-result') {
      this.clientMatchId = restored.clientMatchId;
      this.resultPayload.set(restored.state.request);
    } else if (!restored) {
      this.clientMatchId = this.createMatchId();
      this.latestCheckpoint = new MatchEngine().getCheckpoint();
      this.persistCheckpoint(this.latestCheckpoint);
    }

    this.initialCheckpoint.set(this.latestCheckpoint);
    this.sessionReady.set(true);
    this.lifecycleSubscription.add(
      this.lifecycle.background$.subscribe(() => this.flushLatestCheckpoint())
    );

    const pendingResult = this.resultPayload();
    if (pendingResult) {
      this.saveCompletedResult(pendingResult);
    }
  }

  ngOnDestroy(): void {
    this.lifecycleSubscription.unsubscribe();
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/sign-in']);
  }

  handleMatchCompleted(summary: CompletedMatchSummary): void {
    if (this.resultPayload() || this.saveState() === 'saving') {
      return;
    }

    if (!this.ownerPlayerId || !this.clientMatchId) {
      return;
    }

    const payload = createCompletedResultRequest(summary, { clientMatchId: this.clientMatchId });
    this.resultPayload.set(payload);
    this.promoteAndSave(payload);
  }

  handleMatchCheckpoint(checkpoint: MatchEngineCheckpoint): void {
    if (this.resultPayload()) {
      return;
    }

    this.latestCheckpoint = checkpoint;
    this.persistCheckpoint(checkpoint);
  }

  retrySave(): void {
    const payload = this.resultPayload();
    if (!payload || this.saveState() === 'saving') {
      return;
    }

    this.promoteAndSave(payload);
  }

  private promoteAndSave(payload: CompletedResultRequest): void {
    if (!this.ownerPlayerId || !this.clientMatchId || !this.matchSessions.promoteToPending({
      ownerPlayerId: this.ownerPlayerId,
      clientMatchId: this.clientMatchId,
      checkpointedAt: new Date().toISOString(),
      request: payload
    })) {
      this.saveState.set('failed');
      return;
    }

    this.latestCheckpoint = null;
    this.saveCompletedResult(payload);
  }

  private saveCompletedResult(payload: CompletedResultRequest): void {
    this.saveState.set('saving');
    this.savedClientMatchId.set(null);

    this.resultsApi.saveCompletedResult(payload).pipe(take(1)).subscribe({
      next: (response) => {
        if (this.ownerPlayerId) {
          this.matchSessions.confirmPending(this.ownerPlayerId, payload.clientMatchId);
        }
        this.savedClientMatchId.set(response.clientMatchId);
        this.saveState.set('saved');
      },
      error: (error: unknown) => {
        this.saveState.set(
          error instanceof HttpErrorResponse && error.status === 401 ? 'reauthenticating' : 'failed'
        );
      }
    });
  }

  private flushLatestCheckpoint(): void {
    if (this.latestCheckpoint) {
      this.persistCheckpoint(this.latestCheckpoint);
    }
  }

  private persistCheckpoint(checkpoint: MatchEngineCheckpoint): void {
    if (!this.ownerPlayerId || !this.clientMatchId) {
      return;
    }

    this.matchSessions.saveActive({
      ownerPlayerId: this.ownerPlayerId,
      clientMatchId: this.clientMatchId,
      checkpointedAt: new Date().toISOString(),
      checkpoint
    });
  }
}
