import { computed, inject, Injectable, signal } from '@angular/core';

import { VerifyCodeResponse } from '../api/auth-api.client';
import { AuthSession, TokenStorageService } from './token-storage.service';

@Injectable({
  providedIn: 'root'
})
export class AuthStateService {
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly sessionSignal = signal<AuthSession | null>(this.tokenStorage.read());

  readonly session = this.sessionSignal.asReadonly();
  readonly player = computed(() => this.validSession()?.player ?? null);
  readonly token = computed(() => this.validSession()?.token ?? null);
  readonly isAuthenticated = computed(() => this.validSession() !== null);

  startSession(response: VerifyCodeResponse): AuthSession {
    const session: AuthSession = {
      token: response.token,
      expiresAt: response.expiresAt,
      player: response.player
    };

    this.tokenStorage.write(session);
    this.sessionSignal.set(session);

    return session;
  }

  logout(): void {
    this.invalidateCredentials();
  }

  invalidateCredentials(): void {
    try {
      this.tokenStorage.clear();
    } catch {
      // In-memory credentials must still be invalidated when storage is unavailable.
    } finally {
      this.sessionSignal.set(null);
    }
  }

  private validSession(): AuthSession | null {
    const session = this.sessionSignal();
    if (!session) {
      return null;
    }

    if (Date.parse(session.expiresAt) <= Date.now()) {
      return null;
    }

    return session;
  }
}
