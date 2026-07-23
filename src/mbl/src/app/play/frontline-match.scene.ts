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
  progressLabel: Phaser.GameObjects.Text;
  heldBadge: Phaser.GameObjects.Rectangle;
}

const GAME_WIDTH = 390;
const GAME_HEIGHT = 844;
const LANE_TOP = 76;
const LANE_BOTTOM = 610;
const LANE_HEIGHT = LANE_BOTTOM - LANE_TOP;
const CONTROL_TOP = 650;

export class FrontlineMatchScene extends Phaser.Scene {
  private readonly onComplete: (summary: CompletedMatchSummary) => void;
  private readonly engine = new MatchEngine();
  private readonly unitControls = new Map<UnitType, UnitControlView>();
  private completionEmitted = false;
  private laneGraphics?: Phaser.GameObjects.Graphics;
  private frontlineMarker?: Phaser.GameObjects.Rectangle;
  private frontlineText?: Phaser.GameObjects.Text;
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

    this.laneGraphics = this.add.graphics();
    this.frontlineMarker = this.add.rectangle(GAME_WIDTH / 2, 0, 304, 8, 0xf5f0dc);
    this.frontlineText = this.add.text(0, 0, '', {
      align: 'center',
      color: '#f4fbf6',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      fontStyle: '700'
    }).setOrigin(0.5);

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
      this.add.rectangle(x, CONTROL_TOP + 96, 82, 18, 0x0d1a17).setOrigin(0.5);
      const progressFill = this.add.rectangle(x - 41, CONTROL_TOP + 96, 82, 18, 0x75c986)
        .setOrigin(0, 0.5)
        .setScale(0, 1);
      const progressLabel = this.add.text(x, CONTROL_TOP + 96, '', {
        align: 'center',
        color: '#f4fbf6',
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
        fontStyle: '700'
      }).setOrigin(0.5);
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
        progressLabel,
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
      this.engine.sendHeldUnit(unitType);
      this.render(this.engine.getSnapshot());
      return;
    }

    const result = this.engine.startBuild(unitType);
    if (result.accepted) {
      this.render(this.engine.getSnapshot());
      return;
    }
  }

  private render(snapshot: MatchSnapshot): void {
    this.renderLane(snapshot);
    this.renderUnitControls(snapshot);
  }

  private renderLane(snapshot: MatchSnapshot): void {
    const markerY = this.frontlineY(snapshot.frontlinePosition);
    const laneLeft = 52;
    const laneWidth = 286;
    const pressureColor = this.getPressureColor(snapshot.pressure);
    const labelY = Phaser.Math.Clamp(markerY - 24, LANE_TOP + 20, LANE_BOTTOM - 20);

    this.laneGraphics?.clear();
    this.laneGraphics?.fillStyle(0x341c1c, 1);
    this.laneGraphics?.fillRoundedRect(laneLeft, LANE_TOP, laneWidth, markerY - LANE_TOP, 12);
    this.laneGraphics?.fillStyle(0x122b3d, 1);
    this.laneGraphics?.fillRoundedRect(laneLeft, markerY, laneWidth, LANE_BOTTOM - markerY, 12);
    this.laneGraphics?.lineStyle(2, 0x4f7f70, 1);
    this.laneGraphics?.strokeRoundedRect(laneLeft, LANE_TOP, laneWidth, LANE_HEIGHT, 12);
    this.laneGraphics?.lineStyle(1, 0xc8d8d1, 0.35);
    this.laneGraphics?.lineBetween(laneLeft, LANE_TOP + LANE_HEIGHT / 2, laneLeft + laneWidth, LANE_TOP + LANE_HEIGHT / 2);

    this.frontlineMarker?.setY(markerY).setFillStyle(pressureColor);
    this.frontlineText?.setPosition(GAME_WIDTH / 2, labelY);
    this.frontlineText?.setColor('#f4fbf6');
    this.frontlineText?.setText(
      `Pressure ${snapshot.pressure} | Frontline ${Math.round(snapshot.frontlinePosition)}%`
    );
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

      control.progressFill.setScale(progress, 1);
      control.progressLabel.setText(isBuilding ? `${Math.round(progress * 100)}%` : '');
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
  }

  private frontlineY(position: number): number {
    const normalized = Phaser.Math.Clamp(position, 0, 100) / 100;
    return LANE_BOTTOM - normalized * LANE_HEIGHT;
  }

  private getPressureColor(pressure: number): number {
    if (pressure > 0) {
      return 0x63b3ff;
    }

    if (pressure < 0) {
      return 0xff756b;
    }

    return 0xf4fbf6;
  }
}
