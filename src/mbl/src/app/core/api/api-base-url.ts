import { InjectionToken } from '@angular/core';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => normalizeApiBaseUrl(FRONTLINE_API_BASE_URL)
});

export function normalizeApiBaseUrl(value: string): string {
  const url = new URL(value);

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/api' ||
    value.endsWith('/')
  ) {
    throw new Error('The compiled API base URL must be an absolute HTTP(S) URL ending in /api.');
  }

  return url.toString().replace(/\/$/, '');
}
