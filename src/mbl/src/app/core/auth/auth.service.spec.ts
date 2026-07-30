import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PersistentMemoryStorage } from '../../../testing/persistent-memory-storage';
import { AuthApiClient, VerifyCodeResponse } from '../api/auth-api.client';
import { AuthService } from './auth.service';
import { AuthStateService } from './auth-state.service';
import { AUTH_STORAGE } from './token-storage.service';

describe('AuthService', () => {
  let authApi: Pick<AuthApiClient, 'requestCode' | 'verifyCode'>;
  let authService: AuthService;
  let authState: AuthStateService;

  beforeEach(() => {
    authApi = {
      requestCode: vi.fn().mockReturnValue(of({ message: 'ok' })),
      verifyCode: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthApiClient, useValue: authApi },
        { provide: AUTH_STORAGE, useValue: new PersistentMemoryStorage() }
      ]
    });

    authService = TestBed.inject(AuthService);
    authState = TestBed.inject(AuthStateService);
  });

  it('delegates request-code calls to the API client', () => {
    authService.requestCode('player@example.com').subscribe();

    expect(authApi.requestCode).toHaveBeenCalledWith({ email: 'player@example.com' });
  });

  it('stores the JWT session after code verification succeeds', () => {
    const response: VerifyCodeResponse = {
      token: 'jwt-token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      player: {
        id: 'player-1',
        email: 'player@example.com'
      }
    };
    vi.mocked(authApi.verifyCode).mockReturnValue(of(response));

    authService.verifyCode('player@example.com', '123456').subscribe((session) => {
      expect(session.token).toBe('jwt-token');
    });

    expect(authApi.verifyCode).toHaveBeenCalledWith({
      email: 'player@example.com',
      code: '123456'
    });
    expect(authState.isAuthenticated()).toBe(true);
    expect(authState.token()).toBe('jwt-token');
  });

  it('clears auth state on logout', () => {
    const response: VerifyCodeResponse = {
      token: 'jwt-token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      player: {
        id: 'player-1',
        email: 'player@example.com'
      }
    };
    vi.mocked(authApi.verifyCode).mockReturnValue(of(response));
    authService.verifyCode('player@example.com', '123456').subscribe();

    authService.logout();

    expect(authState.isAuthenticated()).toBe(false);
    expect(authState.token()).toBeNull();
  });
});
