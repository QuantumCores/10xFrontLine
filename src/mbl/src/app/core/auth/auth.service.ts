import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { AuthApiClient, RequestCodeResponse } from '../api/auth-api.client';
import { AuthSession } from './token-storage.service';
import { AuthStateService } from './auth-state.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly authApi = inject(AuthApiClient);
  private readonly authState = inject(AuthStateService);

  requestCode(email: string): Observable<RequestCodeResponse> {
    return this.authApi.requestCode({ email });
  }

  verifyCode(email: string, code: string): Observable<AuthSession> {
    return this.authApi.verifyCode({ email, code }).pipe(
      map((response) => this.authState.startSession(response))
    );
  }

  logout(): void {
    this.authState.logout();
  }
}
