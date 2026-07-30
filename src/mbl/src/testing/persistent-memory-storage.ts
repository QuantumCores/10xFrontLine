import type { StorageLike } from '../app/core/auth/token-storage.service';

export type StorageOperation = 'get' | 'set' | 'remove';

export class PersistentMemoryStorage implements StorageLike {
  readonly values: Map<string, string>;
  setCalls = 0;
  private failingOperation: StorageOperation | null = null;

  constructor(values = new Map<string, string>()) {
    this.values = values;
  }

  getItem(key: string): string | null {
    this.throwIfRequested('get');
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.throwIfRequested('set');
    this.setCalls += 1;
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.throwIfRequested('remove');
    this.values.delete(key);
  }

  seed(key: string, value: unknown): void {
    this.values.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  inspect(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  failNext(operation: StorageOperation): void {
    this.failingOperation = operation;
  }

  private throwIfRequested(operation: StorageOperation): void {
    if (this.failingOperation !== operation) {
      return;
    }

    this.failingOperation = null;
    throw new Error(`Injected ${operation} failure.`);
  }
}
