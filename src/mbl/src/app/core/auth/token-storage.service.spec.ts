import { TestBed } from '@angular/core/testing';

import { PersistentMemoryStorage } from '../../../testing/persistent-memory-storage';
import { AUTH_STORAGE, AuthSession, TokenStorageService } from './token-storage.service';

describe('TokenStorageService', () => {
  let storage: PersistentMemoryStorage;
  let service: TokenStorageService;

  beforeEach(() => {
    storage = new PersistentMemoryStorage();
    TestBed.configureTestingModule({
      providers: [
        { provide: AUTH_STORAGE, useValue: storage }
      ]
    });
    service = TestBed.inject(TokenStorageService);
  });

  it('stores and reads an auth session', () => {
    const session: AuthSession = {
      token: 'jwt-token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      player: {
        id: 'player-1',
        email: 'player@example.com'
      }
    };

    service.write(session);

    expect(service.read()).toEqual(session);
  });

  it('clears stored sessions', () => {
    service.write({
      token: 'jwt-token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      player: {
        id: 'player-1',
        email: 'player@example.com'
      }
    });

    service.clear();

    expect(service.read()).toBeNull();
  });

  it('drops malformed stored sessions', () => {
    storage.setItem('frontLine.authSession', '{"token":""}');

    expect(service.read()).toBeNull();
  });
});
