import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

import { MatchSessionStore } from '../session/match-session.store';
import { AuthStateService } from './auth-state.service';

export type AuthRecoveryState =
  | 'idle'
  | 'reauthentication-required'
  | 'reauthentication-in-flight'
  | 'same-player-resumed'
  | 'different-player-cleared'
  | 'explicit-logout';

@Injectable({ providedIn: 'root' })
export class AuthRecoveryService {
  private readonly authState = inject(AuthStateService);
  private readonly matchSessions = inject(MatchSessionStore);
  private readonly router = inject(Router);
  private readonly stateSignal = signal<AuthRecoveryState>('idle');
  private recoveryPlayerId: string | null = null;
  private recoveryActive = false;

  readonly state = this.stateSignal.asReadonly();

  reportUnauthorized(returnUrl = '/play'): void {
    if (this.recoveryActive) {
      return;
    }

    this.recoveryActive = true;
    this.recoveryPlayerId = this.authState.session()?.player.id ?? null;
    this.stateSignal.set('reauthentication-required');
    this.authState.invalidateCredentials();
    this.stateSignal.set('reauthentication-in-flight');

    void this.router.navigate(['/sign-in'], {
      queryParams: { returnUrl: normalizeInternalReturnUrl(returnUrl) }
    });
  }

  completeVerification(verifiedPlayerId: string): AuthRecoveryState {
    const expectedPlayerId = this.recoveryPlayerId ?? this.matchSessions.readOwnerPlayerId();
    if (!this.recoveryActive && !expectedPlayerId) {
      return this.stateSignal();
    }

    if (expectedPlayerId === verifiedPlayerId) {
      this.stateSignal.set('same-player-resumed');
    } else {
      if (expectedPlayerId) {
        this.matchSessions.clearOwner(expectedPlayerId);
      }
      this.stateSignal.set('different-player-cleared');
    }

    this.recoveryActive = false;
    this.recoveryPlayerId = null;
    return this.stateSignal();
  }

  recordExplicitLogout(): void {
    this.recoveryActive = false;
    this.recoveryPlayerId = null;
    this.stateSignal.set('explicit-logout');
  }
}

export function normalizeInternalReturnUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/play';
  }

  try {
    const base = new URL('https://front-line.local');
    const candidate = new URL(value, base);
    if (candidate.origin !== base.origin) {
      return '/play';
    }

    return `${candidate.pathname}${candidate.search}${candidate.hash}`;
  } catch {
    return '/play';
  }
}
