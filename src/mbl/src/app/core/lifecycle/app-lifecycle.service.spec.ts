import { TestBed } from '@angular/core/testing';
import type { AppState } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';

import {
  APP_LIFECYCLE_PLUGIN,
  AppLifecycleService,
  type AppLifecyclePlugin
} from './app-lifecycle.service';

describe('AppLifecycleService', () => {
  let stateListener: ((state: AppState) => void) | undefined;
  let remove: ReturnType<typeof vi.fn<() => Promise<void>>>;
  let addListener: ReturnType<typeof vi.fn<AppLifecyclePlugin['addListener']>>;

  beforeEach(() => {
    remove = vi.fn<() => Promise<void>>(() => Promise.resolve());
    addListener = vi.fn((_eventName, listener) => {
      stateListener = listener;
      return Promise.resolve({ remove } satisfies PluginListenerHandle);
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: APP_LIFECYCLE_PLUGIN, useValue: { addListener } satisfies AppLifecyclePlugin }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('registers one listener and translates foreground and background states', async () => {
    const service = TestBed.inject(AppLifecycleService);
    const events: string[] = [];
    service.events$.subscribe((event) => events.push(event));

    stateListener?.({ isActive: false });
    stateListener?.({ isActive: true });
    await Promise.resolve();

    expect(addListener).toHaveBeenCalledOnce();
    expect(addListener).toHaveBeenCalledWith('appStateChange', expect.any(Function));
    expect(events).toEqual(['background', 'foreground']);
  });

  it('shares one service and native listener across consumers', () => {
    const first = TestBed.inject(AppLifecycleService);
    const second = TestBed.inject(AppLifecycleService);

    first.background$.subscribe();
    second.foreground$.subscribe();

    expect(second).toBe(first);
    expect(addListener).toHaveBeenCalledOnce();
  });

  it('removes its listener during teardown without leaving events active', async () => {
    const service = TestBed.inject(AppLifecycleService);
    const background = vi.fn();
    service.background$.subscribe(background);
    await Promise.resolve();

    service.ngOnDestroy();
    stateListener?.({ isActive: false });
    await Promise.resolve();

    expect(remove).toHaveBeenCalledOnce();
    expect(background).not.toHaveBeenCalled();
  });

  it('tolerates an unavailable browser plugin bridge', async () => {
    addListener.mockRejectedValueOnce(new Error('plugin unavailable'));

    expect(() => TestBed.inject(AppLifecycleService)).not.toThrow();
    await Promise.resolve();

    expect(addListener).toHaveBeenCalledOnce();
  });
});
