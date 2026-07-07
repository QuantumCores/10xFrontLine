import type { CompletedResultRequest, MatchOutcome } from '../core/api/results-api.client';

export const UNIT_TYPES = ['infantry', 'tank', 'artillery'] as const;

export type UnitType = (typeof UNIT_TYPES)[number];

export interface UnitDefinition {
  type: UnitType;
  label: string;
  strength: number;
  buildTimeMs: number;
}

export type HeldUnitSlots = Record<UnitType, HeldUnit | null>;

export interface HeldUnit {
  unitType: UnitType;
  strength: number;
  completedAtMs: number;
}

export interface ActiveBuildState {
  unitType: UnitType;
  startedAtMs: number;
  elapsedMs: number;
  durationMs: number;
  progress: number;
}

export interface NpcDecisionContext {
  pressure: number;
  frontlinePosition: number;
  elapsedMs: number;
}

export interface NpcState {
  activeBuild: ActiveBuildState | null;
  nextBuildAtMs: number;
  sentUnits: number;
}

export interface MatchSnapshot {
  elapsedMs: number;
  frontlinePosition: number;
  pressure: number;
  playerPressure: number;
  npcPressure: number;
  playerActiveBuild: ActiveBuildState | null;
  heldUnits: HeldUnitSlots;
  npc: NpcState;
  completion: CompletedMatchSummary | null;
}

export interface CompletedMatchSummary {
  outcome: MatchOutcome;
  durationSeconds: number;
  completedAt: string;
  finalScore: number;
  finalFrontlinePosition: number;
}

export interface StartBuildResult {
  accepted: boolean;
  reason?: 'match-complete' | 'already-building' | 'held-slot-occupied' | 'unknown-unit';
}

export interface SendHeldUnitResult {
  accepted: boolean;
  reason?: 'match-complete' | 'empty-slot' | 'unknown-unit';
}

export type CompletedMatchPayload = CompletedResultRequest;
