import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ResultsApiClient } from '../core/api/results-api.client';
import { AuthService } from '../core/auth/auth.service';
import { AuthStateService } from '../core/auth/auth-state.service';

@Component({
  selector: 'app-protected-placeholder',
  templateUrl: './protected-placeholder.component.html',
  styleUrl: './protected-placeholder.component.scss'
})
export class ProtectedPlaceholderComponent {
  protected readonly authState = inject(AuthStateService);
  private readonly authService = inject(AuthService);
  private readonly resultsApi = inject(ResultsApiClient);
  private readonly router = inject(Router);

  protected readonly saveStatus = signal<string | null>(null);
  protected readonly saving = signal(false);

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/sign-in']);
  }

  submitSmokeResult(): void {
    if (this.saving()) {
      return;
    }

    this.saving.set(true);
    this.saveStatus.set(null);

    const clientMatchId = `smoke-${Date.now()}`;
    this.resultsApi.saveCompletedResult({
      clientMatchId,
      outcome: 'Victory',
      durationSeconds: 120,
      completedAt: new Date().toISOString(),
      finalScore: 5,
      finalFrontlinePosition: 72
    }).subscribe({
      next: (response) => {
        this.saveStatus.set(`Saved ${response.clientMatchId}`);
        this.saving.set(false);
      },
      error: () => {
        this.saveStatus.set('Result save failed.');
        this.saving.set(false);
      }
    });
  }
}
