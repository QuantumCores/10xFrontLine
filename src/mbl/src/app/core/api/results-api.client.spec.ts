import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PersistentMemoryStorage } from '../../../testing/persistent-memory-storage';
import { authInterceptor } from '../auth/auth.interceptor';
import { AUTH_STORAGE } from '../auth/token-storage.service';
import { API_BASE_URL } from './api-base-url';
import { ResultsApiClient } from './results-api.client';

describe('ResultsApiClient', () => {
  it('posts the completed result with the stored JWT', () => {
    const storage = new PersistentMemoryStorage();
    storage.seed('frontLine.authSession', {
      token: 'jwt-token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      player: {
        id: 'player-1',
        email: 'player@example.com'
      }
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'https://api.test/api' },
        {
          provide: AUTH_STORAGE,
          useValue: storage
        }
      ]
    });

    const client = TestBed.inject(ResultsApiClient);
    const httpTesting = TestBed.inject(HttpTestingController);
    const request = {
      clientMatchId: 'client-match-1',
      outcome: 'Victory' as const,
      durationSeconds: 120,
      completedAt: '2026-06-25T10:00:00.000Z',
      finalScore: 4,
      finalFrontlinePosition: 70
    };

    client.saveCompletedResult(request).subscribe((response) => {
      expect(response.clientMatchId).toBe('client-match-1');
    });

    const resultRequest = httpTesting.expectOne('https://api.test/api/results');
    expect(resultRequest.request.method).toBe('POST');
    expect(resultRequest.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    expect(resultRequest.request.body).toEqual(request);

    resultRequest.flush({
      resultId: 'result-1',
      clientMatchId: 'client-match-1',
      outcome: 'Victory',
      savedAt: '2026-06-25T10:01:00.000Z'
    });
    httpTesting.verify();
  });
});
