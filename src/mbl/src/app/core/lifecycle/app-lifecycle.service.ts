import { Injectable, InjectionToken, OnDestroy, inject } from '@angular/core';
import { App, type AppState } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { Subject, filter, map, share } from 'rxjs';

export interface AppLifecyclePlugin {
  addListener(
    eventName: 'appStateChange',
    listener: (state: AppState) => void
  ): Promise<PluginListenerHandle>;
}

export type AppLifecycleEvent = 'foreground' | 'background';

export const APP_LIFECYCLE_PLUGIN = new InjectionToken<AppLifecyclePlugin>('APP_LIFECYCLE_PLUGIN', {
  providedIn: 'root',
  factory: () => App
});

@Injectable({ providedIn: 'root' })
export class AppLifecycleService implements OnDestroy {
  private readonly plugin = inject(APP_LIFECYCLE_PLUGIN);
  private readonly eventSubject = new Subject<AppLifecycleEvent>();
  private listener?: PluginListenerHandle;
  private destroyed = false;

  readonly events$ = this.eventSubject.asObservable().pipe(share());
  readonly background$ = this.events$.pipe(
    filter((event) => event === 'background'),
    map(() => undefined)
  );
  readonly foreground$ = this.events$.pipe(
    filter((event) => event === 'foreground'),
    map(() => undefined)
  );

  constructor() {
    this.registerListener();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.eventSubject.complete();
    void this.listener?.remove().catch(() => undefined);
    this.listener = undefined;
  }

  private registerListener(): void {
    try {
      void this.plugin.addListener('appStateChange', (state) => {
        if (!this.destroyed) {
          this.eventSubject.next(state.isActive ? 'foreground' : 'background');
        }
      }).then((listener) => {
        if (this.destroyed) {
          return listener.remove().catch(() => undefined);
        }

        this.listener = listener;
        return undefined;
      }).catch(() => undefined);
    } catch {
      // Browser and test environments may not expose a native plugin bridge.
    }
  }
}
