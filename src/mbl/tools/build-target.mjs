import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const target = process.argv[2];
const rawApiBaseUrl = process.env.FRONTLINE_API_BASE_URL;
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (target !== 'smoke' && target !== 'android') {
  fail('Target must be either "smoke" or "android".');
}

if (!rawApiBaseUrl) {
  fail('FRONTLINE_API_BASE_URL is required for target builds.');
}

let apiBaseUrl;
try {
  apiBaseUrl = new URL(rawApiBaseUrl);
} catch {
  fail('FRONTLINE_API_BASE_URL must be an absolute URL.');
}

if (apiBaseUrl.username || apiBaseUrl.password || apiBaseUrl.search || apiBaseUrl.hash) {
  fail('FRONTLINE_API_BASE_URL must not contain credentials, a query, or a fragment.');
}

if (apiBaseUrl.pathname !== '/api' || rawApiBaseUrl.endsWith('/')) {
  fail('FRONTLINE_API_BASE_URL must end with /api and must not have a trailing slash.');
}

if (target === 'smoke') {
  if (apiBaseUrl.protocol !== 'http:' || !isIpv4(apiBaseUrl.hostname)) {
    fail('The smoke target requires http://<VPS_IP>/api with an IPv4 host.');
  }
} else if (
  apiBaseUrl.protocol !== 'https:' ||
  isIpv4(apiBaseUrl.hostname) ||
  apiBaseUrl.hostname === 'localhost' ||
  !apiBaseUrl.hostname.startsWith('api.')
) {
  fail('The Android target requires https://api.<DOMAIN>/api with the API DNS hostname.');
}

const angularCli = path.join(workspaceRoot, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
const result = spawnSync(
  process.execPath,
  [
    angularCli,
    'build',
    '--configuration',
    'production',
    '--define',
    `FRONTLINE_API_BASE_URL=${JSON.stringify(rawApiBaseUrl)}`
  ],
  { cwd: workspaceRoot, stdio: 'inherit' }
);

if (result.error) {
  fail(result.error.message);
}

process.exit(result.status ?? 1);

function isIpv4(hostname) {
  const parts = hostname.split('.');
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function fail(message) {
  console.error(`Target build configuration error: ${message}`);
  process.exit(1);
}
