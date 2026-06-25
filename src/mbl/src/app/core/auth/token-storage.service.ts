import { inject, Injectable, InjectionToken } from '@angular/core';

import { AuthPlayerResponse } from '../api/auth-api.client';

export interface AuthSession {
  token: string;
  expiresAt: string;
  player: AuthPlayerResponse;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const AUTH_STORAGE = new InjectionToken<StorageLike | null>('AUTH_STORAGE', {
  providedIn: 'root',
  factory: () => getBrowserStorage()
});

const SessionStorageKey = 'frontLine.authSession';

@Injectable({
  providedIn: 'root'
})
export class TokenStorageService {
  private readonly storage = inject(AUTH_STORAGE);

  read(): AuthSession | null {
    const rawSession = this.storage?.getItem(SessionStorageKey);
    if (!rawSession) {
      return null;
    }

    try {
      const session = JSON.parse(rawSession) as Partial<AuthSession>;
      if (!isAuthSession(session)) {
        this.clear();
        return null;
      }

      return session;
    } catch {
      this.clear();
      return null;
    }
  }

  write(session: AuthSession): void {
    this.storage?.setItem(SessionStorageKey, JSON.stringify(session));
  }

  clear(): void {
    this.storage?.removeItem(SessionStorageKey);
  }
}

function getBrowserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function isAuthSession(session: Partial<AuthSession>): session is AuthSession {
  return typeof session.token === 'string' &&
    session.token.length > 0 &&
    typeof session.expiresAt === 'string' &&
    Number.isFinite(Date.parse(session.expiresAt)) &&
    typeof session.player?.id === 'string' &&
    typeof session.player.email === 'string';
}
