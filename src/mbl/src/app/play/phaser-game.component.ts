import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  InjectionToken,
  NgZone,
  OnDestroy,
  Output,
  ViewChild,
  inject
} from '@angular/core';
import type Phaser from 'phaser';

import type { CompletedMatchSummary } from './match-types';

export type PhaserGameFactory = (
  parent: HTMLElement,
  onComplete: (summary: CompletedMatchSummary) => void
) => Phaser.Game | Promise<Phaser.Game>;

export const PHASER_GAME_FACTORY = new InjectionToken<PhaserGameFactory>('PHASER_GAME_FACTORY', {
  providedIn: 'root',
  factory: () => async (parent, onComplete) => {
    const [{ default: PhaserModule }, { createFrontlineGameConfig }] = await Promise.all([
      import('phaser'),
      import('./frontline-game.config')
    ]);

    return new PhaserModule.Game(createFrontlineGameConfig(parent, onComplete));
  }
});

@Component({
  selector: 'app-phaser-game',
  templateUrl: './phaser-game.component.html',
  styleUrl: './phaser-game.component.scss'
})
export class PhaserGameComponent implements AfterViewInit, OnDestroy {
  @Output() readonly matchCompleted = new EventEmitter<CompletedMatchSummary>();
  @ViewChild('gameHost', { static: true }) private readonly gameHost?: ElementRef<HTMLElement>;

  private readonly ngZone = inject(NgZone);
  private readonly createGame = inject(PHASER_GAME_FACTORY);
  private game?: Phaser.Game;
  private emittedCompletion = false;
  private boundsTimer?: number;
  private destroyed = false;

  ngAfterViewInit(): void {
    const parent = this.gameHost?.nativeElement;
    if (!parent || this.game) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      const game = this.createGame(parent, (summary) => this.emitCompletion(summary));
      if (isPromiseLike(game)) {
        void game.then((resolvedGame) => this.attachGame(resolvedGame));
        return;
      }

      this.attachGame(game);
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.boundsTimer !== undefined) {
      window.clearTimeout(this.boundsTimer);
    }

    this.game?.destroy(true, false);
    this.game = undefined;
  }

  private emitCompletion(summary: CompletedMatchSummary): void {
    if (this.emittedCompletion) {
      return;
    }

    this.emittedCompletion = true;
    this.ngZone.run(() => this.matchCompleted.emit(summary));
  }

  private attachGame(game: Phaser.Game): void {
    if (this.destroyed) {
      game.destroy(true, false);
      return;
    }

    this.game = game;
    this.boundsTimer = window.setTimeout(() => this.game?.scale.updateBounds(), 0);
  }
}

function isPromiseLike(game: Phaser.Game | Promise<Phaser.Game>): game is Promise<Phaser.Game> {
  return typeof (game as Promise<Phaser.Game>).then === 'function';
}
