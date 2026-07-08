import Phaser from 'phaser';

import { MATCH_CONFIG, MATCH_UNIT_TYPES } from './match-config';
import { MatchEngine } from './match-engine';
import type { CompletedMatchSummary, MatchSnapshot, UnitType } from './match-types';

export interface FrontlineMatchSceneOptions {
  onComplete: (summary: CompletedMatchSummary) => void;
}

interface UnitControlView {
  card: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  meta: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  progressFill: Phaser.GameObjects.Rectangle;
  heldBadge: Phaser.GameObjects.Rectangle;
}

const GAME_WIDTH = 390;
const GAME_HEIGHT = 844;
const LANE_TOP = 104;
const LANE_BOTTOM = 522;
const LANE_HEIGHT = LANE_BOTTOM - LANE_TOP;
const CONTROL_TOP = 586;

export class FrontlineMatchScene extends Phaser.Scene {
  private readonly onComplete: (summary: CompletedMatchSummary) => void;
  private readonly engine = new MatchEngine();
  private readonly unitControls = new Map<UnitType, UnitControlView>();
  private completionEmitted = false;
  private laneGraphics?: Phaser.GameObjects.Graphics;
  private frontlineMarker?: Phaser.GameObjects.Rectangle;
  private frontlineText?: Phaser.GameObjects.Text;
  private pressureText?: Phaser.GameObjects.Text;
  private buildText?: Phaser.GameObjects.Text;
  private messageText?: Phaser.GameObjects.Text;
  private overlay?: Phaser.GameObjects.Container;

  constructor(options: FrontlineMatchSceneOptions) {
    super({ key: 'FrontlineMatchScene' });
    this.onComplete = options.onComplete;
  }

  create(): void {
    this.scale.updateBounds();
    this.createStaticLayout();
    this.createUnitControls();
    this.render(this.engine.getSnapshot());
  }

  override update(_time: number, delta: number): void {
    const snapshot = this.engine.getCompletion()
      ? this.engine.getSnapshot()
      : this.engine.step(Math.min(delta, 100));

    this.render(snapshot);

    if (snapshot.completion && !this.completionEmitted) {
      this.completionEmitted = true;
      this.showCompletion(snapshot.completion);
      this.onComplete(snapshot.completion);
    }
  }

  private createStaticLayout(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0d1a17);

    this.add.text(20, 24, 'Front Line', {
      color: '#f4fbf6',
      fontFamily: 'Arial, sans-serif',
      fontSize: '30px',
      fontStyle: '700'
    });

    this.pressureText = this.add.text(20, 62, '', {
      color: '#c8d8d1',
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px'
    });

    this.laneGraphics = this.add.graphics();
    this.frontlineMarker = this.add.rectangle(GAME_WIDTH / 2, 0, 304, 8, 0xf5f0dc);
    this.frontlineText = this.add.text(0, 0, '', {
      align: 'center',
      color: '#f4fbf6',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      fontStyle: '700'
    }).setOrigin(0.5);

    this.add.text(24, LANE_TOP - 26, 'NPC boundary', {
      color: '#ffb0a4',
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px'
    });
    this.add.text(24, LANE_BOTTOM + 12, 'Player boundary', {
      color: '#9fd6ff',
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px'
    });

    this.buildText = this.add.text(20, 548, '', {
      color: '#f4fbf6',
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      fontStyle: '700'
    });
    this.messageText = this.add.text(20, 806, 'Build a unit. Hold one completed unit per type. Tap held units to send.', {
      color: '#c8d8d1',
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      wordWrap: { width: 350 }
    });
  }

  private createUnitControls(): void {
    MATCH_UNIT_TYPES.forEach((unitType, index) => {
      const unit = MATCH_CONFIG.units[unitType];
      const x = 66 + index * 129;
      const card = this.add.rectangle(x, CONTROL_TOP + 70, 112, 136, 0x19352f)
        .setStrokeStyle(2, 0x4f7f70)
        .setInteractive({ useHandCursor: true });
      const title = this.add.text(x, CONTROL_TOP + 16, unit.label, {
        align: 'center',
        color: '#f4fbf6',
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        fontStyle: '700'
      }).setOrigin(0.5);
      const meta = this.add.text(x, CONTROL_TOP + 42, `STR ${unit.strength}\n${unit.buildTimeMs / 1000}s`, {
        align: 'center',
        color: '#c8d8d1',
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        lineSpacing: 3
      }).setOrigin(0.5, 0);
      this.add.rectangle(x, CONTROL_TOP + 96, 82, 9, 0x0d1a17).setOrigin(0.5);
      const progressFill = this.add.rectangle(x - 41, CONTROL_TOP + 96, 0, 9, 0x75c986).setOrigin(0, 0.5);
      const heldBadge = this.add.rectangle(x, CONTROL_TOP + 115, 72, 20, 0x375a84).setOrigin(0.5).setVisible(false);
      const status = this.add.text(x, CONTROL_TOP + 108, '', {
        align: 'center',
        color: '#f4fbf6',
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        fontStyle: '700'
      }).setOrigin(0.5, 0);

      card.on('pointerdown', () => this.handleUnitTap(unitType));
      heldBadge.setInteractive({ useHandCursor: true });
      heldBadge.on('pointerdown', () => this.handleUnitTap(unitType));

      this.unitControls.set(unitType, {
        card,
        title,
        meta,
        status,
        progressFill,
        heldBadge
      });
    });
  }

  private handleUnitTap(unitType: UnitType): void {
    const snapshot = this.engine.getSnapshot();
    if (snapshot.completion) {
      return;
    }

    if (snapshot.heldUnits[unitType]) {
      const result = this.engine.sendHeldUnit(unitType);
      this.setMessage(result.accepted ? `${MATCH_CONFIG.units[unitType].label} sent.` : 'No unit ready to send.');
      this.render(this.engine.getSnapshot());
      return;
    }

    const result = this.engine.startBuild(unitType);
    if (result.accepted) {
      this.setMessage(`${MATCH_CONFIG.units[unitType].label} building.`);
      this.render(this.engine.getSnapshot());
      return;
    }

    const messages: Record<NonNullable<typeof result.reason>, string> = {
      'already-building': 'Finish the active build before starting another.',
      'held-slot-occupied': 'Send the held unit before building another of that type.',
      'match-complete': 'The match is complete.',
      'unknown-unit': 'Unknown unit.'
    };
    this.setMessage(messages[result.reason ?? 'unknown-unit']);
  }

  private render(snapshot: MatchSnapshot): void {
    this.renderLane(snapshot);
    this.renderHud(snapshot);
    this.renderUnitControls(snapshot);
  }

  private renderLane(snapshot: MatchSnapshot): void {
    const markerY = this.frontlineY(snapshot.frontlinePosition);
    const laneLeft = 52;
    const laneWidth = 286;

    this.laneGraphics?.clear();
    this.laneGraphics?.fillStyle(0x341c1c, 1);
    this.laneGraphics?.fillRoundedRect(laneLeft, LANE_TOP, laneWidth, markerY - LANE_TOP, 12);
    this.laneGraphics?.fillStyle(0x122b3d, 1);
    this.laneGraphics?.fillRoundedRect(laneLeft, markerY, laneWidth, LANE_BOTTOM - markerY, 12);
    this.laneGraphics?.lineStyle(2, 0x4f7f70, 1);
    this.laneGraphics?.strokeRoundedRect(laneLeft, LANE_TOP, laneWidth, LANE_HEIGHT, 12);
    this.laneGraphics?.lineStyle(1, 0xc8d8d1, 0.35);
    this.laneGraphics?.lineBetween(laneLeft, LANE_TOP + LANE_HEIGHT / 2, laneLeft + laneWidth, LANE_TOP + LANE_HEIGHT / 2);

    this.frontlineMarker?.setY(markerY);
    this.frontlineText?.setPosition(GAME_WIDTH / 2, markerY - 24);
    this.frontlineText?.setText(`Frontline ${Math.round(snapshot.frontlinePosition)}%`);
  }

  private renderHud(snapshot: MatchSnapshot): void {
    this.pressureText?.setText(
      `Pressure ${snapshot.pressure} | Player ${snapshot.playerPressure} vs NPC ${snapshot.npcPressure}`
    );

    if (snapshot.playerActiveBuild) {
      const unit = MATCH_CONFIG.units[snapshot.playerActiveBuild.unitType];
      this.buildText?.setText(`Building ${unit.label}: ${Math.round(snapshot.playerActiveBuild.progress * 100)}%`);
      return;
    }

    this.buildText?.setText('No active build');
  }

  private renderUnitControls(snapshot: MatchSnapshot): void {
    MATCH_UNIT_TYPES.forEach((unitType) => {
      const control = this.unitControls.get(unitType);
      if (!control) {
        return;
      }

      const isBuilding = snapshot.playerActiveBuild?.unitType === unitType;
      const held = snapshot.heldUnits[unitType];
      const progress = isBuilding ? snapshot.playerActiveBuild?.progress ?? 0 : held ? 1 : 0;

      control.progressFill.setDisplaySize(82 * progress, 9);
      control.heldBadge.setVisible(Boolean(held));
      control.card.setFillStyle(held ? 0x23588a : isBuilding ? 0x23593a : 0x19352f);
      control.title.setColor(snapshot.completion ? '#91a39a' : '#f4fbf6');
      control.meta.setColor(snapshot.completion ? '#91a39a' : '#c8d8d1');
      control.status.setText(held ? 'SEND' : isBuilding ? 'BUILDING' : 'BUILD');
    });
  }

  private showCompletion(summary: CompletedMatchSummary): void {
    if (this.overlay) {
      return;
    }

    const tint = summary.outcome === 'Victory' ? 0x17452f : 0x4a1d1d;
    const panel = this.add.rectangle(GAME_WIDTH / 2, 342, 320, 188, tint, 0.94)
      .setStrokeStyle(2, 0xf4fbf6);
    const title = this.add.text(GAME_WIDTH / 2, 292, summary.outcome, {
      align: 'center',
      color: '#f4fbf6',
      fontFamily: 'Arial, sans-serif',
      fontSize: '34px',
      fontStyle: '700'
    }).setOrigin(0.5);
    const detail = this.add.text(
      GAME_WIDTH / 2,
      344,
      `Duration ${summary.durationSeconds}s\nScore ${summary.finalScore}\nResult complete`,
      {
        align: 'center',
        color: '#f4fbf6',
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        lineSpacing: 8
      }
    ).setOrigin(0.5);

    this.overlay = this.add.container(0, 0, [panel, title, detail]);
    this.setMessage('Match complete. The Angular page will handle result saving.');
  }

  private setMessage(message: string): void {
    this.messageText?.setText(message);
  }

  private frontlineY(position: number): number {
    const normalized = Phaser.Math.Clamp(position, 0, 100) / 100;
    return LANE_BOTTOM - normalized * LANE_HEIGHT;
  }
}
