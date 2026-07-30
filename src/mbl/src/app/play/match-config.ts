import { UNIT_TYPES, type UnitDefinition, type UnitType } from './match-types';

export const MATCH_CONFIG_VERSION = 1;

export interface MatchConfig {
  initialFrontlinePosition: number;
  minimumFrontlinePosition: number;
  maximumFrontlinePosition: number;
  pressureToFrontlinePerSecond: number;
  targetMatchDurationSeconds: number;
  npcCadenceMs: number;
  npcBehindPressureThreshold: number;
  npcAheadPressureThreshold: number;
  units: Record<UnitType, UnitDefinition>;
}

export const MATCH_CONFIG: MatchConfig = {
  initialFrontlinePosition: 50,
  minimumFrontlinePosition: 0,
  maximumFrontlinePosition: 100,
  pressureToFrontlinePerSecond: 0.08,
  targetMatchDurationSeconds: 120,
  npcCadenceMs: 3_200,
  npcBehindPressureThreshold: 8,
  npcAheadPressureThreshold: -8,
  units: {
    infantry: {
      type: 'infantry',
      label: 'Infantry',
      strength: 3,
      buildTimeMs: 2_400
    },
    tank: {
      type: 'tank',
      label: 'Tank',
      strength: 6,
      buildTimeMs: 4_800
    },
    artillery: {
      type: 'artillery',
      label: 'Artillery',
      strength: 9,
      buildTimeMs: 7_200
    }
  }
};

export const MATCH_UNIT_TYPES: readonly UnitType[] = UNIT_TYPES;
