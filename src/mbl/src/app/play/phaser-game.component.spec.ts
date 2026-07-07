import { ComponentFixture, TestBed } from '@angular/core/testing';
import type Phaser from 'phaser';

import type { CompletedMatchSummary } from './match-types';
import { PHASER_GAME_FACTORY, PhaserGameComponent, type PhaserGameFactory } from './phaser-game.component';

describe('PhaserGameComponent', () => {
  let fixture: ComponentFixture<PhaserGameComponent>;
  let createGame: ReturnType<typeof vi.fn<PhaserGameFactory>>;
  let destroyGame: ReturnType<typeof vi.fn>;
  let updateBounds: ReturnType<typeof vi.fn>;
  let onComplete: ((summary: CompletedMatchSummary) => void) | undefined;

  beforeEach(async () => {
    destroyGame = vi.fn();
    updateBounds = vi.fn();
    onComplete = undefined;
    createGame = vi.fn((parent, callback) => {
      onComplete = callback;
      return {
        parent,
        destroy: destroyGame,
        scale: {
          updateBounds
        }
      } as unknown as Phaser.Game;
    });

    await TestBed.configureTestingModule({
      imports: [PhaserGameComponent],
      providers: [
        { provide: PHASER_GAME_FACTORY, useValue: createGame }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PhaserGameComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('creates one Phaser game for the host element', () => {
    const host = fixture.nativeElement.querySelector('.game-host') as HTMLElement;

    expect(createGame).toHaveBeenCalledWith(host, expect.any(Function));
    expect(createGame).toHaveBeenCalledTimes(1);
  });

  it('emits one completed match summary from the mocked scene callback', () => {
    const summaries: CompletedMatchSummary[] = [];
    const summary: CompletedMatchSummary = {
      outcome: 'Victory',
      durationSeconds: 91,
      completedAt: '2026-07-07T10:00:00.000Z',
      finalScore: 12,
      finalFrontlinePosition: 100
    };

    fixture.componentInstance.matchCompleted.subscribe((completed) => summaries.push(completed));

    onComplete?.(summary);
    onComplete?.({ ...summary, outcome: 'Defeat' });

    expect(summaries).toEqual([summary]);
  });

  it('destroys the Phaser game when the Angular host is destroyed', () => {
    fixture.destroy();

    expect(destroyGame).toHaveBeenCalledWith(true, false);
  });
});
