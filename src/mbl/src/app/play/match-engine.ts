import { MATCH_CONFIG, MATCH_CONFIG_VERSION, type MatchConfig } from './match-config';
import { MatchRandom, type MatchRandomState } from './match-random';
import {
  type ActiveBuildState,
  type ActiveBuildCheckpoint,
  type CompletedMatchSummary,
  type HeldUnit,
  type HeldUnitCheckpoint,
  type HeldUnitSlots,
  type MatchEngineCheckpoint,
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
  seed?: number;
  chooseNpcUnit?: (context: NpcDecisionContext) => UnitType;
  clock?: () => Date;
}

export type MatchEngineHydrationOptions = Omit<MatchEngineOptions, 'random' | 'seed'>;

export class MatchEngine {
  private readonly config: MatchConfig;
  private readonly random: () => number;
  private readonly matchRandom: MatchRandom | null;
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
    if (options.random && options.seed !== undefined) {
      throw new Error('Provide either a random override or a seed, not both.');
    }

    this.matchRandom = options.random ? null : MatchRandom.create(options.seed);
    this.random = options.random ?? (() => this.matchRandom!.next());
    this.chooseNpcUnitOverride = options.chooseNpcUnit;
    this.clock = options.clock ?? (() => new Date());
    this.frontlinePosition = this.config.initialFrontlinePosition;
    this.nextNpcBuildAtMs = this.config.npcCadenceMs;
  }

  static hydrate(
    checkpoint: MatchEngineCheckpoint,
    options: MatchEngineHydrationOptions = {}
  ): MatchEngine {
    const config = options.config ?? MATCH_CONFIG;
    assertValidCheckpoint(checkpoint, config);

    const engine = new MatchEngine({
      ...options,
      seed: checkpoint.randomState.state
    });
    engine.restoreCheckpoint(checkpoint);
    return engine;
  }

  static isCheckpointValid(
    checkpoint: unknown,
    config: MatchConfig = MATCH_CONFIG
  ): checkpoint is MatchEngineCheckpoint {
    try {
      assertValidCheckpoint(checkpoint, config);
      return true;
    } catch {
      return false;
    }
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

  getCheckpoint(): MatchEngineCheckpoint {
    if (!this.matchRandom) {
      throw new Error('A match using an external random source cannot be checkpointed.');
    }

    return {
      matchConfigVersion: MATCH_CONFIG_VERSION,
      elapsedMs: this.elapsedMs,
      frontlinePosition: this.frontlinePosition,
      playerPressure: this.playerPressure,
      npcPressure: this.npcPressure,
      playerActiveBuild: toBuildCheckpoint(this.playerActiveBuild),
      heldUnits: {
        infantry: toHeldUnitCheckpoint(this.heldUnits.infantry),
        tank: toHeldUnitCheckpoint(this.heldUnits.tank),
        artillery: toHeldUnitCheckpoint(this.heldUnits.artillery)
      },
      npcActiveBuild: toBuildCheckpoint(this.npcActiveBuild),
      nextNpcBuildAtMs: this.nextNpcBuildAtMs,
      npcSentUnits: this.npcSentUnits,
      completion: this.completion ? { ...this.completion } : null,
      randomState: this.matchRandom.getState()
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

  private restoreCheckpoint(checkpoint: MatchEngineCheckpoint): void {
    this.elapsedMs = checkpoint.elapsedMs;
    this.frontlinePosition = checkpoint.frontlinePosition;
    this.playerPressure = checkpoint.playerPressure;
    this.npcPressure = checkpoint.npcPressure;
    this.playerActiveBuild = fromBuildCheckpoint(checkpoint.playerActiveBuild, this.config);
    for (const unitType of UNIT_TYPES) {
      this.heldUnits[unitType] = fromHeldUnitCheckpoint(checkpoint.heldUnits[unitType], this.config);
    }
    this.npcActiveBuild = fromBuildCheckpoint(checkpoint.npcActiveBuild, this.config);
    this.nextNpcBuildAtMs = checkpoint.nextNpcBuildAtMs;
    this.npcSentUnits = checkpoint.npcSentUnits;
    this.completion = checkpoint.completion ? { ...checkpoint.completion } : null;
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

function toBuildCheckpoint(build: ActiveBuildState | null): ActiveBuildCheckpoint | null {
  if (!build) {
    return null;
  }

  return {
    unitType: build.unitType,
    startedAtMs: build.startedAtMs,
    elapsedMs: build.elapsedMs
  };
}

function fromBuildCheckpoint(
  build: ActiveBuildCheckpoint | null,
  config: MatchConfig
): ActiveBuildState | null {
  if (!build) {
    return null;
  }

  const durationMs = config.units[build.unitType].buildTimeMs;
  return {
    ...build,
    durationMs,
    progress: build.elapsedMs / durationMs
  };
}

function toHeldUnitCheckpoint(unit: HeldUnit | null): HeldUnitCheckpoint | null {
  return unit ? { unitType: unit.unitType, completedAtMs: unit.completedAtMs } : null;
}

function fromHeldUnitCheckpoint(
  unit: HeldUnitCheckpoint | null,
  config: MatchConfig
): HeldUnit | null {
  return unit ? { ...unit, strength: config.units[unit.unitType].strength } : null;
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

function assertValidCheckpoint(value: unknown, config: MatchConfig): asserts value is MatchEngineCheckpoint {
  if (!isRecord(value) ||
      value['matchConfigVersion'] !== MATCH_CONFIG_VERSION ||
      !isFiniteNumberInRange(value['elapsedMs'], 0) ||
      !isFiniteNumberInRange(
        value['frontlinePosition'],
        config.minimumFrontlinePosition,
        config.maximumFrontlinePosition
      ) ||
      !isFiniteNumberInRange(value['playerPressure'], 0) ||
      !isFiniteNumberInRange(value['npcPressure'], 0) ||
      !isBuildCheckpoint(value['playerActiveBuild'], value['elapsedMs'], config) ||
      !isHeldUnitSlotsCheckpoint(value['heldUnits'], value['elapsedMs']) ||
      !isBuildCheckpoint(value['npcActiveBuild'], value['elapsedMs'], config) ||
      !isFiniteNumberInRange(value['nextNpcBuildAtMs'], 0) ||
      !Number.isInteger(value['npcSentUnits']) ||
      Number(value['npcSentUnits']) < 0 ||
      !isCompletion(value['completion'], config) ||
      !isRandomState(value['randomState'])) {
    throw new Error('Invalid match engine checkpoint.');
  }

  if (value['completion'] !== null &&
      (value['playerActiveBuild'] !== null || value['npcActiveBuild'] !== null)) {
    throw new Error('A completed match cannot contain active builds.');
  }

  if (value['completion'] !== null &&
      value['frontlinePosition'] !== value['completion'].finalFrontlinePosition) {
    throw new Error('A completed match must remain at its final boundary.');
  }
}

function isBuildCheckpoint(
  value: unknown,
  matchElapsedMs: unknown,
  config: MatchConfig
): value is ActiveBuildCheckpoint | null {
  if (value === null) {
    return true;
  }

  if (!isRecord(value) || !isUnitType(value['unitType'])) {
    return false;
  }

  const durationMs = config.units[value['unitType']].buildTimeMs;
  return isFiniteNumberInRange(value['startedAtMs'], 0, Number(matchElapsedMs)) &&
    isFiniteNumberInRange(value['elapsedMs'], 0, durationMs) &&
    Number(value['elapsedMs']) < durationMs &&
    Number(value['startedAtMs']) + Number(value['elapsedMs']) <= Number(matchElapsedMs);
}

function isHeldUnitSlotsCheckpoint(value: unknown, matchElapsedMs: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return UNIT_TYPES.every((unitType) => {
    const unit = value[unitType];
    return unit === null || (
      isRecord(unit) &&
      unit['unitType'] === unitType &&
      isFiniteNumberInRange(unit['completedAtMs'], 0, Number(matchElapsedMs))
    );
  });
}

function isCompletion(value: unknown, config: MatchConfig): value is CompletedMatchSummary | null {
  if (value === null) {
    return true;
  }

  if (!isRecord(value) ||
      (value['outcome'] !== 'Victory' && value['outcome'] !== 'Defeat') ||
      !Number.isInteger(value['durationSeconds']) ||
      Number(value['durationSeconds']) < 1 ||
      typeof value['completedAt'] !== 'string' ||
      !Number.isFinite(Date.parse(value['completedAt'])) ||
      !isFiniteNumberInRange(value['finalScore'], -10_000, 10_000) ||
      !isFiniteNumberInRange(
        value['finalFrontlinePosition'],
        config.minimumFrontlinePosition,
        config.maximumFrontlinePosition
      )) {
    return false;
  }

  const expectedBoundary = value['outcome'] === 'Victory'
    ? config.maximumFrontlinePosition
    : config.minimumFrontlinePosition;
  return value['finalFrontlinePosition'] === expectedBoundary;
}

function isRandomState(value: unknown): value is MatchRandomState {
  return isRecord(value) &&
    value['algorithm'] === 'mulberry32' &&
    Number.isInteger(value['state']) &&
    Number(value['state']) >= 0 &&
    Number(value['state']) <= 0xffff_ffff;
}

function isFiniteNumberInRange(value: unknown, min: number, max = Number.POSITIVE_INFINITY): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isUnitType(value: unknown): value is UnitType {
  return typeof value === 'string' && UNIT_TYPES.includes(value as UnitType);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
