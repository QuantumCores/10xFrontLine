import { MATCH_CONFIG, type MatchConfig } from './match-config';
import { MatchEngine } from './match-engine';
import { MatchRandom } from './match-random';
import { createCompletedResultRequest } from './match-result-mapper';

describe('MatchEngine', () => {
  it('tracks unit build progress and blocks a second active build', () => {
    const engine = new MatchEngine({ clock: fixedClock });

    expect(engine.startBuild('infantry')).toEqual({ accepted: true });
    expect(engine.startBuild('tank')).toEqual({ accepted: false, reason: 'already-building' });

    const midway = engine.step(MATCH_CONFIG.units.infantry.buildTimeMs / 2);
    expect(midway.playerActiveBuild?.unitType).toBe('infantry');
    expect(midway.playerActiveBuild?.progress).toBeCloseTo(0.5);
    expect(midway.heldUnits.infantry).toBeNull();

    const completed = engine.step(MATCH_CONFIG.units.infantry.buildTimeMs / 2);
    expect(completed.playerActiveBuild).toBeNull();
    expect(completed.heldUnits.infantry).toEqual({
      unitType: 'infantry',
      strength: MATCH_CONFIG.units.infantry.strength,
      completedAtMs: MATCH_CONFIG.units.infantry.buildTimeMs
    });
  });

  it('keeps one held slot per unit type and blocks duplicate held units', () => {
    const engine = new MatchEngine({ clock: fixedClock });

    engine.startBuild('infantry');
    engine.step(MATCH_CONFIG.units.infantry.buildTimeMs);

    expect(engine.startBuild('infantry')).toEqual({ accepted: false, reason: 'held-slot-occupied' });
    expect(engine.startBuild('tank')).toEqual({ accepted: true });

    const completed = engine.step(MATCH_CONFIG.units.tank.buildTimeMs);
    expect(completed.heldUnits.infantry?.unitType).toBe('infantry');
    expect(completed.heldUnits.tank?.unitType).toBe('tank');
    expect(completed.heldUnits.artillery).toBeNull();
  });

  it('sends held units and applies their strength to player pressure', () => {
    const engine = new MatchEngine({ clock: fixedClock });

    expect(engine.sendHeldUnit('infantry')).toEqual({ accepted: false, reason: 'empty-slot' });

    engine.startBuild('infantry');
    engine.step(MATCH_CONFIG.units.infantry.buildTimeMs);

    expect(engine.sendHeldUnit('infantry')).toEqual({ accepted: true });
    const snapshot = engine.getSnapshot();
    expect(snapshot.heldUnits.infantry).toBeNull();
    expect(snapshot.playerPressure).toBe(MATCH_CONFIG.units.infantry.strength);
    expect(snapshot.pressure).toBe(MATCH_CONFIG.units.infantry.strength);
  });

  it('chooses pressure-reactive NPC units when the player is pushing', () => {
    const config = createConfig({
      npcBehindPressureThreshold: 1
    });
    const engine = new MatchEngine({ config, clock: fixedClock, random: () => 0 });

    engine.startBuild('infantry');
    engine.step(config.units.infantry.buildTimeMs);
    engine.sendHeldUnit('infantry');

    const snapshot = engine.step(config.npcCadenceMs - config.units.infantry.buildTimeMs);
    expect(snapshot.pressure).toBe(config.units.infantry.strength);
    expect(snapshot.npc.activeBuild?.unitType).toBe('artillery');
  });

  it('moves the frontline to Victory when player pressure reaches the NPC boundary', () => {
    const config = createConfig({
      npcCadenceMs: 120_000,
      pressureToFrontlinePerSecond: 10
    });
    const engine = new MatchEngine({ config, clock: fixedClock });

    engine.startBuild('artillery');
    engine.step(config.units.artillery.buildTimeMs);
    engine.sendHeldUnit('artillery');
    const snapshot = engine.step(1_000);

    expect(snapshot.frontlinePosition).toBe(100);
    expect(snapshot.completion).toEqual({
      outcome: 'Victory',
      durationSeconds: 9,
      completedAt: '2026-07-07T10:00:00.000Z',
      finalScore: config.units.artillery.strength,
      finalFrontlinePosition: 100
    });
  });

  it('moves the frontline to Defeat when NPC pressure reaches the player boundary', () => {
    const config = createConfig({
      npcCadenceMs: 1,
      pressureToFrontlinePerSecond: 10
    });
    const engine = new MatchEngine({
      config,
      clock: fixedClock,
      chooseNpcUnit: () => 'artillery'
    });

    engine.step(1);
    engine.step(config.units.artillery.buildTimeMs);
    const snapshot = engine.step(1_000);

    expect(snapshot.frontlinePosition).toBe(0);
    expect(snapshot.completion?.outcome).toBe('Defeat');
    expect(snapshot.completion?.finalScore).toBe(-config.units.artillery.strength);
    expect(snapshot.completion?.finalFrontlinePosition).toBe(0);
  });

  it('maps completion to a stable completed-result payload for retry', () => {
    const summary = {
      outcome: 'Victory' as const,
      durationSeconds: 120.4,
      completedAt: '2026-07-07T10:00:00.000Z',
      finalScore: 10_500,
      finalFrontlinePosition: 125
    };

    const firstPayload = createCompletedResultRequest(summary, {
      clientMatchId: 'client-match-1',
      completedAt: '2026-07-07T10:01:00.000Z'
    });
    const retryPayload = createCompletedResultRequest(summary, {
      clientMatchId: 'client-match-1',
      completedAt: '2026-07-07T10:01:00.000Z'
    });

    expect(retryPayload).toEqual(firstPayload);
    expect(firstPayload).toEqual({
      clientMatchId: 'client-match-1',
      outcome: 'Victory',
      durationSeconds: 120,
      completedAt: '2026-07-07T10:01:00.000Z',
      finalScore: 10_000,
      finalFrontlinePosition: 100
    });
  });

  it('hydrates a checkpoint and continues with equivalent future behavior', () => {
    const uninterrupted = new MatchEngine({ seed: 123_456, clock: fixedClock });
    uninterrupted.startBuild('artillery');
    uninterrupted.step(MATCH_CONFIG.npcCadenceMs);
    uninterrupted.step(900);

    const checkpoint = uninterrupted.getCheckpoint();
    const restored = MatchEngine.hydrate(checkpoint, { clock: fixedClock });

    expect(restored.getSnapshot()).toEqual(uninterrupted.getSnapshot());
    expect(restored.getCheckpoint()).toEqual(checkpoint);

    checkpoint.heldUnits.infantry = {
      unitType: 'infantry',
      completedAtMs: 0
    };
    expect(restored.getSnapshot().heldUnits.infantry).toBeNull();

    const deltas = [1_200, 3_200, 4_800, 3_200, 7_200];
    for (const delta of deltas) {
      expect(restored.step(delta)).toEqual(uninterrupted.step(delta));
    }
    expect(restored.getCheckpoint()).toEqual(uninterrupted.getCheckpoint());
  });

  it('resumes the seeded random sequence from serialized continuation state', () => {
    const original = MatchRandom.create(987_654_321);
    original.next();
    original.next();
    const resumed = new MatchRandom(original.getState());

    expect(resumed.next()).toBe(original.next());
    expect(resumed.next()).toBe(original.next());
  });

  it('rejects invalid seeded random continuation state', () => {
    expect(() => new MatchRandom({ algorithm: 'mulberry32', state: -1 })).toThrowError(
      'Invalid match random state.'
    );
    expect(() => new MatchRandom({ algorithm: 'mulberry32', state: 0x1_0000_0000 })).toThrowError(
      'Invalid match random state.'
    );
  });

  it('rejects invalid checkpoint invariants and config versions', () => {
    const engine = new MatchEngine({ seed: 42, clock: fixedClock });
    engine.step(500);
    const checkpoint = engine.getCheckpoint();

    expect(() => MatchEngine.hydrate({
      ...checkpoint,
      matchConfigVersion: checkpoint.matchConfigVersion + 1
    })).toThrowError('Invalid match engine checkpoint.');
    expect(() => MatchEngine.hydrate({
      ...checkpoint,
      frontlinePosition: MATCH_CONFIG.maximumFrontlinePosition + 1
    })).toThrowError('Invalid match engine checkpoint.');
    expect(() => MatchEngine.hydrate({
      ...checkpoint,
      nextNpcBuildAtMs: -1
    })).toThrowError('Invalid match engine checkpoint.');
  });

  it('does not pretend an external random override has serializable continuation state', () => {
    const engine = new MatchEngine({ random: () => 0.5, clock: fixedClock });

    expect(() => engine.getCheckpoint()).toThrowError(
      'A match using an external random source cannot be checkpointed.'
    );
  });
});

function fixedClock(): Date {
  return new Date('2026-07-07T10:00:00.000Z');
}

function createConfig(overrides: Partial<MatchConfig>): MatchConfig {
  return {
    ...MATCH_CONFIG,
    ...overrides,
    units: MATCH_CONFIG.units
  };
}
