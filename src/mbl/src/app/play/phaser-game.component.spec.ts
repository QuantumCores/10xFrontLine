import { ComponentFixture, TestBed } from '@angular/core/testing';
import type Phaser from 'phaser';

import { MatchEngine } from './match-engine';
import type { CompletedMatchSummary, MatchEngineCheckpoint } from './match-types';
import { PHASER_GAME_FACTORY, PhaserGameComponent, type PhaserGameFactory } from './phaser-game.component';

describe('PhaserGameComponent', () => {
  let fixture: ComponentFixture<PhaserGameComponent>;
  let createGame: ReturnType<typeof vi.fn<PhaserGameFactory>>;
  let destroyGame: ReturnType<typeof vi.fn>;
  let updateBounds: ReturnType<typeof vi.fn>;
  let requestCheckpoint: ReturnType<typeof vi.fn<() => void>>;
  let onComplete: ((summary: CompletedMatchSummary) => void) | undefined;
  let onCheckpoint: ((checkpoint: MatchEngineCheckpoint) => void) | undefined;
  let initialCheckpoint: MatchEngineCheckpoint;

  beforeEach(async () => {
    destroyGame = vi.fn();
    updateBounds = vi.fn();
    requestCheckpoint = vi.fn<() => void>();
    onComplete = undefined;
    onCheckpoint = undefined;
    initialCheckpoint = new MatchEngine({ seed: 42 }).getCheckpoint();
    createGame = vi.fn((parent, checkpoint, complete, checkpointed, registerRequest) => {
      onComplete = complete;
      onCheckpoint = checkpointed;
      registerRequest(requestCheckpoint);
      return {
        parent,
        checkpoint,
        destroy: destroyGame,
        scale: { updateBounds }
      } as unknown as Phaser.Game;
    });

    await TestBed.configureTestingModule({
      imports: [PhaserGameComponent],
      providers: [{ provide: PHASER_GAME_FACTORY, useValue: createGame }]
    }).compileComponents();

    fixture = TestBed.createComponent(PhaserGameComponent);
    fixture.componentRef.setInput('initialCheckpoint', initialCheckpoint);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('creates one Phaser game and forwards restored input to the host', () => {
    const host = fixture.nativeElement.querySelector('.game-host') as HTMLElement;

    expect(createGame).toHaveBeenCalledWith(
      host,
      initialCheckpoint,
      expect.any(Function),
      expect.any(Function),
      expect.any(Function)
    );
    expect(createGame).toHaveBeenCalledTimes(1);
  });

  it('propagates authoritative checkpoints without recreating the game', () => {
    const checkpoints: MatchEngineCheckpoint[] = [];
    const nextCheckpoint = new MatchEngine({ seed: 7 }).getCheckpoint();
    fixture.componentInstance.matchCheckpoint.subscribe((checkpoint) => checkpoints.push(checkpoint));

    onCheckpoint?.(nextCheckpoint);

    expect(checkpoints).toEqual([nextCheckpoint]);
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

  it('requests a final checkpoint before destroying the Phaser game', () => {
    const checkpoints: MatchEngineCheckpoint[] = [];
    fixture.componentInstance.matchCheckpoint.subscribe((checkpoint) => checkpoints.push(checkpoint));
    requestCheckpoint.mockImplementation(() => onCheckpoint?.(initialCheckpoint));

    fixture.destroy();

    expect(requestCheckpoint).toHaveBeenCalledOnce();
    expect(checkpoints).toEqual([initialCheckpoint]);
    expect(destroyGame).toHaveBeenCalledWith(true, false);
    expect(requestCheckpoint.mock.invocationCallOrder[0]).toBeLessThan(
      destroyGame.mock.invocationCallOrder[0]
    );
  });

  it('destroys a game that resolves after its Angular host was destroyed', async () => {
    const lateDestroy = vi.fn();
    let resolveGame!: (game: Phaser.Game) => void;
    const lateGame = new Promise<Phaser.Game>((resolve) => {
      resolveGame = resolve;
    });
    createGame.mockReturnValueOnce(lateGame);

    fixture.destroy();
    const lateFixture = TestBed.createComponent(PhaserGameComponent);
    lateFixture.componentRef.setInput('initialCheckpoint', initialCheckpoint);
    lateFixture.detectChanges();
    lateFixture.destroy();
    resolveGame({ destroy: lateDestroy } as unknown as Phaser.Game);
    await lateGame;
    await Promise.resolve();

    expect(lateDestroy).toHaveBeenCalledWith(true, false);
  });
});
