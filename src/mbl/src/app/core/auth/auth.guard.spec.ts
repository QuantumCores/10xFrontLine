import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot } from '@angular/router';

import { PersistentMemoryStorage } from '../../../testing/persistent-memory-storage';
import { authGuard } from './auth.guard';
import { AuthStateService } from './auth-state.service';
import { AUTH_STORAGE, StorageLike } from './token-storage.service';

@Component({
  template: ''
})
class TestRouteComponent {}

describe('authGuard', () => {
  function configure(storage: StorageLike): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'sign-in', component: TestRouteComponent },
          { path: 'play', component: TestRouteComponent }
        ]),
        AuthStateService,
        { provide: AUTH_STORAGE, useValue: storage }
      ]
    });
  }

  it('redirects anonymous players to sign-in', () => {
    configure(new PersistentMemoryStorage());
    const router = TestBed.inject(Router);

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/play' } as RouterStateSnapshot)
    );

    expect(result).not.toBe(true);
    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe('/sign-in?returnUrl=%2Fplay');
  });

  it('allows players with a valid session', () => {
    const storage = new PersistentMemoryStorage();
    storage.seed('frontLine.authSession', {
      token: 'jwt-token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      player: {
        id: 'player-1',
        email: 'player@example.com'
      }
    });
    configure(storage);

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/play' } as RouterStateSnapshot)
    );

    expect(result).toBe(true);
  });
});
