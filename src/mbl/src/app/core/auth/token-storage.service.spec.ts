import { TestBed } from '@angular/core/testing';

import { AUTH_STORAGE, AuthSession, StorageLike, TokenStorageService } from './token-storage.service';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('TokenStorageService', () => {
  let storage: MemoryStorage;
  let service: TokenStorageService;

  beforeEach(() => {
    storage = new MemoryStorage();
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
