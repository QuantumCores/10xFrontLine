import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { API_BASE_URL } from '../api/api-base-url';
import { AuthRecoveryService } from './auth-recovery.service';
import { AuthStateService } from './auth-state.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authState = inject(AuthStateService);
  const authRecovery = inject(AuthRecoveryService);
  const apiBaseUrl = inject(API_BASE_URL);
  const token = authState.token();

  if (!token || !isApiRequest(request.url, apiBaseUrl)) {
    return next(request);
  }

  const authenticatedRequest = request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse &&
          error.status === 401 &&
          !isAuthEndpoint(request.url, apiBaseUrl)) {
        authRecovery.reportUnauthorized('/play');
      }

      return throwError(() => error);
    })
  );
};

function isApiRequest(url: string, apiBaseUrl: string): boolean {
  return url.startsWith(apiBaseUrl) || url.startsWith('/api/');
}

function isAuthEndpoint(url: string, apiBaseUrl: string): boolean {
  const path = url.split(/[?#]/, 1)[0].replace(/\/+$/, '');
  const base = apiBaseUrl.replace(/\/+$/, '');
  return path === `${base}/auth/request-code` ||
    path === `${base}/auth/verify-code` ||
    path === '/api/auth/request-code' ||
    path === '/api/auth/verify-code';
}
