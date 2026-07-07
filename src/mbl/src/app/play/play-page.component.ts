import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { take } from 'rxjs';

import { CompletedResultRequest, ResultsApiClient } from '../core/api/results-api.client';
import { AuthService } from '../core/auth/auth.service';
import { AuthStateService } from '../core/auth/auth-state.service';
import { CompletedMatchSummary } from './match-types';
import { PhaserGameComponent } from './phaser-game.component';
import { createCompletedResultRequest } from './match-result-mapper';

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

@Component({
  selector: 'app-play-page',
  imports: [PhaserGameComponent],
  templateUrl: './play-page.component.html',
  styleUrl: './play-page.component.scss'
})
export class PlayPageComponent {
  protected readonly authState = inject(AuthStateService);

  private readonly authService = inject(AuthService);
  private readonly resultsApi = inject(ResultsApiClient);
  private readonly router = inject(Router);

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
      default:
        return null;
    }
  });

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/sign-in']);
  }

  handleMatchCompleted(summary: CompletedMatchSummary): void {
    if (this.resultPayload() || this.saveState() === 'saving') {
      return;
    }

    const payload = createCompletedResultRequest(summary);
    this.resultPayload.set(payload);
    this.saveCompletedResult(payload);
  }

  retrySave(): void {
    const payload = this.resultPayload();
    if (!payload || this.saveState() === 'saving') {
      return;
    }

    this.saveCompletedResult(payload);
  }

  private saveCompletedResult(payload: CompletedResultRequest): void {
    this.saveState.set('saving');
    this.savedClientMatchId.set(null);

    this.resultsApi.saveCompletedResult(payload).pipe(take(1)).subscribe({
      next: (response) => {
        this.savedClientMatchId.set(response.clientMatchId);
        this.saveState.set('saved');
      },
      error: () => {
        this.saveState.set('failed');
      }
    });
  }
}
