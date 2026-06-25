import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from './api-base-url';
import { AuthApiClient } from './auth-api.client';

describe('AuthApiClient', () => {
  let client: AuthApiClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:5178/api' }
      ]
    });

    client = TestBed.inject(AuthApiClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('posts request-code calls to the local API base URL', () => {
    client.requestCode({ email: 'player@example.com' }).subscribe();

    const request = httpTesting.expectOne('http://localhost:5178/api/auth/request-code');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'player@example.com' });

    request.flush({ message: 'If the email can access Front Line, a sign-in code will be sent.' });
  });

  it('posts verify-code calls to the local API base URL', () => {
    client.verifyCode({ email: 'player@example.com', code: '123456' }).subscribe();

    const request = httpTesting.expectOne('http://localhost:5178/api/auth/verify-code');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'player@example.com',
      code: '123456'
    });

    request.flush({
      token: 'jwt-token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      player: {
        id: 'player-1',
        email: 'player@example.com'
      }
    });
  });
});
