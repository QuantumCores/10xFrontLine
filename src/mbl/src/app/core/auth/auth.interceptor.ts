import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { API_BASE_URL } from '../api/api-base-url';
import { AuthStateService } from './auth-state.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authState = inject(AuthStateService);
  const apiBaseUrl = inject(API_BASE_URL);
  const token = authState.token();

  if (!token || !isApiRequest(request.url, apiBaseUrl)) {
    return next(request);
  }

  return next(request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  }));
};

function isApiRequest(url: string, apiBaseUrl: string): boolean {
  return url.startsWith(apiBaseUrl) || url.startsWith('/api/');
}
