import { MATCH_CONFIG, type MatchConfig } from './match-config';
import {
  type ActiveBuildState,
  type CompletedMatchSummary,
  type HeldUnit,
  type HeldUnitSlots,
  type MatchSnapshot,
  type NpcDecisionContext,
  type NpcState,
  type SendHeldUnitResult,
  type StartBuildResult,
  UNIT_TYPES,
  type UnitType
} from './match-types';

export interface MatchEngineOptions {
  config?: MatchConfig;
  random?: () => number;
  chooseNpcUnit?: (context: NpcDecisionContext) => UnitType;
  clock?: () => Date;
}

export class MatchEngine {
  private readonly config: MatchConfig;
  private readonly random: () => number;
  private readonly chooseNpcUnitOverride?: (context: NpcDecisionContext) => UnitType;
  private readonly clock: () => Date;
  private elapsedMs = 0;
  private frontlinePosition: number;
  private playerPressure = 0;
  private npcPressure = 0;
  private playerActiveBuild: ActiveBuildState | null = null;
  private readonly heldUnits: HeldUnitSlots = createEmptyHeldUnitSlots();
  private npcActiveBuild: ActiveBuildState | null = null;
  private nextNpcBuildAtMs: number;
  private npcSentUnits = 0;
  private completion: CompletedMatchSummary | null = null;

  constructor(options: MatchEngineOptions = {}) {
    this.config = options.config ?? MATCH_CONFIG;
    this.random = options.random ?? Math.random;
    this.chooseNpcUnitOverride = options.chooseNpcUnit;
    this.clock = options.clock ?? (() => new Date());
    this.frontlinePosition = this.config.initialFrontlinePosition;
    this.nextNpcBuildAtMs = this.config.npcCadenceMs;
  }

  startBuild(unitType: UnitType): StartBuildResult {
    if (this.completion) {
      return { accepted: false, reason: 'match-complete' };
    }

    if (!this.isKnownUnit(unitType)) {
      return { accepted: false, reason: 'unknown-unit' };
    }

    if (this.playerActiveBuild) {
      return { accepted: false, reason: 'already-building' };
    }

    if (this.heldUnits[unitType]) {
      return { accepted: false, reason: 'held-slot-occupied' };
    }

    this.playerActiveBuild = this.createBuild(unitType);
    return { accepted: true };
  }

  sendHeldUnit(unitType: UnitType): SendHeldUnitResult {
    if (this.completion) {
      return { accepted: false, reason: 'match-complete' };
    }

    if (!this.isKnownUnit(unitType)) {
      return { accepted: false, reason: 'unknown-unit' };
    }

    const heldUnit = this.heldUnits[unitType];
    if (!heldUnit) {
      return { accepted: false, reason: 'empty-slot' };
    }

    this.playerPressure += heldUnit.strength;
    this.heldUnits[unitType] = null;
    return { accepted: true };
  }

  step(deltaMs: number): MatchSnapshot {
    if (this.completion || deltaMs <= 0) {
      return this.getSnapshot();
    }

    this.elapsedMs += deltaMs;
    this.moveFrontline(deltaMs);
    this.advancePlayerBuild(deltaMs);
    this.advanceNpcBuild(deltaMs);
    this.startNpcBuildIfReady();
    this.checkCompletion();

    return this.getSnapshot();
  }

  getSnapshot(): MatchSnapshot {
    return {
      elapsedMs: this.elapsedMs,
      frontlinePosition: this.frontlinePosition,
      pressure: this.getPressure(),
      playerPressure: this.playerPressure,
      npcPressure: this.npcPressure,
      playerActiveBuild: cloneBuild(this.playerActiveBuild),
      heldUnits: cloneHeldUnitSlots(this.heldUnits),
      npc: this.getNpcSnapshot(),
      completion: this.completion ? { ...this.completion } : null
    };
  }

  getCompletion(): CompletedMatchSummary | null {
    return this.completion ? { ...this.completion } : null;
  }

  private advancePlayerBuild(deltaMs: number): void {
    if (!this.playerActiveBuild) {
      return;
    }

    this.playerActiveBuild = advanceBuild(this.playerActiveBuild, deltaMs);
    if (this.playerActiveBuild.progress < 1) {
      return;
    }

    const unitType = this.playerActiveBuild.unitType;
    this.heldUnits[unitType] = {
      unitType,
      strength: this.config.units[unitType].strength,
      completedAtMs: this.elapsedMs
    };
    this.playerActiveBuild = null;
  }

  private advanceNpcBuild(deltaMs: number): void {
    if (!this.npcActiveBuild) {
      return;
    }

    this.npcActiveBuild = advanceBuild(this.npcActiveBuild, deltaMs);
    if (this.npcActiveBuild.progress < 1) {
      return;
    }

    this.npcPressure += this.config.units[this.npcActiveBuild.unitType].strength;
    this.npcSentUnits += 1;
    this.npcActiveBuild = null;
    this.nextNpcBuildAtMs = this.elapsedMs + this.config.npcCadenceMs;
  }

  private startNpcBuildIfReady(): void {
    if (this.npcActiveBuild || this.elapsedMs < this.nextNpcBuildAtMs) {
      return;
    }

    const context: NpcDecisionContext = {
      pressure: this.getPressure(),
      frontlinePosition: this.frontlinePosition,
      elapsedMs: this.elapsedMs
    };
    this.npcActiveBuild = this.createBuild(this.chooseNpcUnit(context));
  }

  private chooseNpcUnit(context: NpcDecisionContext): UnitType {
    if (this.chooseNpcUnitOverride) {
      return this.chooseNpcUnitOverride(context);
    }

    if (context.pressure >= this.config.npcBehindPressureThreshold) {
      return 'artillery';
    }

    if (context.pressure <= this.config.npcAheadPressureThreshold) {
      return 'infantry';
    }

    const roll = this.random();
    if (roll < 0.45) {
      return 'infantry';
    }

    if (roll < 0.8) {
      return 'tank';
    }

    return 'artillery';
  }

  private createBuild(unitType: UnitType): ActiveBuildState {
    return {
      unitType,
      startedAtMs: this.elapsedMs,
      elapsedMs: 0,
      durationMs: this.config.units[unitType].buildTimeMs,
      progress: 0
    };
  }

  private moveFrontline(deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;
    const movement = this.getPressure() * this.config.pressureToFrontlinePerSecond * deltaSeconds;
    this.frontlinePosition = clamp(
      this.frontlinePosition + movement,
      this.config.minimumFrontlinePosition,
      this.config.maximumFrontlinePosition
    );
  }

  private checkCompletion(): void {
    if (this.frontlinePosition >= this.config.maximumFrontlinePosition) {
      this.complete('Victory', this.config.maximumFrontlinePosition);
      return;
    }

    if (this.frontlinePosition <= this.config.minimumFrontlinePosition) {
      this.complete('Defeat', this.config.minimumFrontlinePosition);
    }
  }

  private complete(outcome: CompletedMatchSummary['outcome'], finalFrontlinePosition: number): void {
    if (this.completion) {
      return;
    }

    this.frontlinePosition = finalFrontlinePosition;
    this.completion = {
      outcome,
      durationSeconds: Math.max(1, Math.ceil(this.elapsedMs / 1000)),
      completedAt: this.clock().toISOString(),
      finalScore: clamp(Math.round(this.getPressure()), -10_000, 10_000),
      finalFrontlinePosition: clamp(
        Number(finalFrontlinePosition.toFixed(2)),
        this.config.minimumFrontlinePosition,
        this.config.maximumFrontlinePosition
      )
    };
    this.playerActiveBuild = null;
    this.npcActiveBuild = null;
  }

  private getNpcSnapshot(): NpcState {
    return {
      activeBuild: cloneBuild(this.npcActiveBuild),
      nextBuildAtMs: this.nextNpcBuildAtMs,
      sentUnits: this.npcSentUnits
    };
  }

  private getPressure(): number {
    return this.playerPressure - this.npcPressure;
  }

  private isKnownUnit(unitType: UnitType): boolean {
    return UNIT_TYPES.includes(unitType);
  }
}

function advanceBuild(build: ActiveBuildState, deltaMs: number): ActiveBuildState {
  const elapsedMs = Math.min(build.durationMs, build.elapsedMs + deltaMs);
  return {
    ...build,
    elapsedMs,
    progress: elapsedMs / build.durationMs
  };
}

function cloneBuild(build: ActiveBuildState | null): ActiveBuildState | null {
  return build ? { ...build } : null;
}

function cloneHeldUnitSlots(slots: HeldUnitSlots): HeldUnitSlots {
  return {
    infantry: cloneHeldUnit(slots.infantry),
    tank: cloneHeldUnit(slots.tank),
    artillery: cloneHeldUnit(slots.artillery)
  };
}

function cloneHeldUnit(unit: HeldUnit | null): HeldUnit | null {
  return unit ? { ...unit } : null;
}

function createEmptyHeldUnitSlots(): HeldUnitSlots {
  return {
    infantry: null,
    tank: null,
    artillery: null
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
