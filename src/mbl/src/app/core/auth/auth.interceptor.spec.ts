import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { PersistentMemoryStorage } from '../../../testing/persistent-memory-storage';
import { MatchEngine } from '../../play/match-engine';
import { API_BASE_URL } from '../api/api-base-url';
import { MATCH_SESSION_STORAGE, MatchSessionStore } from '../session/match-session.store';
import { AuthStateService } from './auth-state.service';
import { authInterceptor } from './auth.interceptor';
import { AUTH_STORAGE } from './token-storage.service';

describe('authInterceptor recovery', () => {
  let httpTesting: HttpTestingController;
  let authState: AuthStateService;
  let matchSessions: MatchSessionStore;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    const authStorage = new PersistentMemoryStorage();
    authStorage.seed('frontLine.authSession', {
      token: 'jwt-token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      player: { id: 'player-1', email: 'player@example.com' }
    });

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'https://api.test/api' },
        { provide: AUTH_STORAGE, useValue: authStorage },
        { provide: MATCH_SESSION_STORAGE, useValue: new PersistentMemoryStorage() }
      ]
    });

    httpTesting = TestBed.inject(HttpTestingController);
    authState = TestBed.inject(AuthStateService);
    matchSessions = TestBed.inject(MatchSessionStore);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    matchSessions.saveActive({
      ownerPlayerId: 'player-1',
      clientMatchId: 'match-1',
      checkpointedAt: '2026-08-01T10:00:00.000Z',
      checkpoint: new MatchEngine({ seed: 123 }).getCheckpoint()
    });
  });

  afterEach(() => httpTesting.verify());

  it('reports concurrent protected API 401s once while propagating both errors', () => {
    const http = TestBed.inject(HttpClient);
    const errors: number[] = [];

    http.get('https://api.test/api/results').subscribe({
      error: (error: HttpErrorResponse) => errors.push(error.status)
    });
    http.get('https://api.test/api/profile').subscribe({
      error: (error: HttpErrorResponse) => errors.push(error.status)
    });

    const requests = httpTesting.match((request) => request.url.startsWith('https://api.test/api/'));
    expect(requests).toHaveLength(2);
    expect(requests.every((request) => request.request.headers.get('Authorization') === 'Bearer jwt-token')).toBe(true);
    requests.forEach((request) => request.flush({}, { status: 401, statusText: 'Unauthorized' }));

    expect(errors).toEqual([401, 401]);
    expect(navigate).toHaveBeenCalledOnce();
    expect(authState.token()).toBeNull();
    expect(matchSessions.readForPlayer('player-1')).not.toBeNull();
  });

  it('does not recover for auth endpoints, external URLs, or non-401 failures', () => {
    const http = TestBed.inject(HttpClient);
    const statuses: number[] = [];

    http.post('https://api.test/api/auth/verify-code', {}).subscribe({
      error: (error: HttpErrorResponse) => statuses.push(error.status)
    });
    http.get('https://external.test/resource').subscribe({
      error: (error: HttpErrorResponse) => statuses.push(error.status)
    });
    http.get('https://api.test/api/results').subscribe({
      error: (error: HttpErrorResponse) => statuses.push(error.status)
    });

    httpTesting.expectOne('https://api.test/api/auth/verify-code')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    httpTesting.expectOne('https://external.test/resource')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    httpTesting.expectOne('https://api.test/api/results')
      .flush({}, { status: 503, statusText: 'Unavailable' });

    expect(statuses).toEqual([401, 401, 503]);
    expect(navigate).not.toHaveBeenCalled();
    expect(authState.token()).toBe('jwt-token');
  });
});
