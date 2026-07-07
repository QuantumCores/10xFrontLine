import Phaser from 'phaser';

import { FrontlineMatchScene } from './frontline-match.scene';
import type { CompletedMatchSummary } from './match-types';

export const FRONTLINE_GAME_WIDTH = 390;
export const FRONTLINE_GAME_HEIGHT = 844;

export function createFrontlineGameConfig(
  parent: HTMLElement,
  onComplete: (summary: CompletedMatchSummary) => void
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0d1a17',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: FRONTLINE_GAME_WIDTH,
      height: FRONTLINE_GAME_HEIGHT
    },
    scene: [new FrontlineMatchScene({ onComplete })]
  };
}
