import { normalizeApiBaseUrl } from './api-base-url';

describe('normalizeApiBaseUrl', () => {
  it('accepts the local, smoke, and Android endpoint shapes', () => {
    expect(normalizeApiBaseUrl('http://localhost:5178/api')).toBe('http://localhost:5178/api');
    expect(normalizeApiBaseUrl('http://192.0.2.10/api')).toBe('http://192.0.2.10/api');
    expect(normalizeApiBaseUrl('https://api.example.com/api')).toBe('https://api.example.com/api');
  });

  it.each([
    'ftp://api.example.com/api',
    'https://api.example.com/api/',
    'https://api.example.com/other',
    'https://user:password@api.example.com/api',
    'https://api.example.com/api?token=secret'
  ])('rejects unsafe or malformed API base URL %s', (value) => {
    expect(() => normalizeApiBaseUrl(value)).toThrow();
  });
});
