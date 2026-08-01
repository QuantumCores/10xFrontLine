import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { AuthApiClient, RequestCodeResponse } from '../api/auth-api.client';
import { MatchSessionStore } from '../session/match-session.store';
import { AuthRecoveryService } from './auth-recovery.service';
import { AuthSession } from './token-storage.service';
import { AuthStateService } from './auth-state.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly authApi = inject(AuthApiClient);
  private readonly authState = inject(AuthStateService);
  private readonly authRecovery = inject(AuthRecoveryService);
  private readonly matchSessions = inject(MatchSessionStore);

  requestCode(email: string): Observable<RequestCodeResponse> {
    return this.authApi.requestCode({ email });
  }

  verifyCode(email: string, code: string): Observable<AuthSession> {
    return this.authApi.verifyCode({ email, code }).pipe(
      map((response) => {
        const session = this.authState.startSession(response);
        this.authRecovery.completeVerification(session.player.id);
        return session;
      })
    );
  }

  logout(): void {
    this.matchSessions.clearAll();
    this.authState.logout();
    this.authRecovery.recordExplicitLogout();
  }
}
