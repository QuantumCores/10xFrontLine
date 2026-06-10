---
project: "Front Line"
context_type: greenfield
created: 2026-06-07
updated: 2026-06-10
product_type: mobile
target_scale:
  users: medium
  qps: null
  data_volume: null
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-07-05
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "context type"
      decision: "greenfield"
    - topic: "primary persona"
      decision: "Mobile strategy players seeking short sessions"
    - topic: "core product insight"
      decision: "One push-and-pull frontline can create meaningful decisions without complex systems"
    - topic: "primary pain category"
      decision: "Decision paralysis from excessive complexity"
    - topic: "authentication strategy"
      decision: "Passwordless email login code"
    - topic: "role separation"
      decision: "One flat player role; no admin, guest, or privileged roles"
    - topic: "MVP primary flow"
      decision: "Complete a match using three unit types against an automated NPC, with unit strength driving score and frontline movement until a clear win or loss"
    - topic: "secondary MVP outcomes"
      decision: "Restart flow and saved match-result persistence"
    - topic: "MVP timeline"
      decision: "Three weeks of after-hours work"
    - topic: "product type"
      decision: "Mobile app"
    - topic: "target scale"
      decision: "Dozens to a hundred users; gameplay rule does not change at 100x scale"
    - topic: "hard deadline"
      decision: "2026-07-05"
  frs_drafted: 11
  quality_check_status: accepted
---

# Front Line Shape Notes

## Seed Idea

Source: `idea-notes.md`

## Vision & Problem Statement

Mobile strategy players seeking short sessions often face excessive complexity and decision paralysis when they only have a few minutes for a tactical experience. Existing strategy games require learning large systems or sacrifice meaningful tactical tension.

A single push-and-pull frontline can create meaningful decisions without complex systems, providing a short, focused, and easy-to-understand strategy match.

## User & Persona

The primary persona is a mobile strategy player seeking short sessions. They reach for Front Line when they have a few minutes available and want an easy-to-understand tactical battle that still creates tension and meaningful decisions.

## Access Control

Players register and sign in using a passwordless code sent by email. Authentication is required to play and view saved match history. The MVP has one flat player role with no admin, guest, or privileged roles.

## Success Criteria

### Primary

- A player completes a match using three unit types against an automated NPC, with unit strength driving the score and frontline movement until a clear win or loss.

### Secondary

- A player can restart after a completed match.

### Guardrails

- Frontline movement must always be clear to the player.

## User Stories

### US-01: Player completes a frontline match

- **Given** an authenticated player starts a match
- **When** they build and send units while the NPC does the same
- **Then** unit strengths move the frontline until the game declares a clear win or loss and saves the result

#### Acceptance Criteria

- The player can choose among three unit types with different strength and build times.
- Only one player unit can be built at a time.
- The player can see build progress and send a completed unit.
- The NPC automatically builds and sends units.
- Unit strengths determine the frontline score and movement.
- Reaching either boundary produces a clear win or loss.
- A completed match result is saved.

## Functional Requirements

### Access

- FR-001: Player can sign in using a passwordless email code. Priority: must-have
  > Socrates: Counter-argument considered: authentication delays the core gameplay proof and could be postponed. Resolution: kept; passwordless sign-in remains required for the MVP.

### Gameplay

- FR-002: Player can see the frontline. Priority: must-have
  > Socrates: Counter-argument considered: a score alone could communicate match state with less UI work. Resolution: kept; the frontline is the central subject and identity of the game.
- FR-003: Player can choose among three unit types with different strength and build times. Priority: must-have
  > Socrates: Counter-argument considered: two unit types may be enough to prove meaningful tradeoffs. Resolution: kept; two units would not provide enough meaningful gameplay or diversity.
- FR-004: Player can build one unit at a time and see its progress. Priority: must-have
  > Socrates: Counter-argument considered: immediate deployment could test the frontline mechanic with less scope. Resolution: kept; build time creates time pressure and emotion as the frontline approaches the player.
- FR-005: Player can send a completed unit. Priority: must-have
  > Socrates: Counter-argument considered: automatically sending completed units could preserve the core loop with fewer player actions. Resolution: kept; choosing when to send a completed unit remains a player action.
- FR-006: NPC can automatically build and send units. Priority: must-have
  > Socrates: Counter-argument considered: a scripted sequence could prove gameplay more predictably than an autonomous opponent. Resolution: kept; scripting may support testing, but a learned script would make player-facing matches boring.
- FR-007: Game calculates the frontline score from unit strengths. Priority: must-have
  > Socrates: Counter-argument considered: counting units equally could prove frontline movement with less balancing work. Resolution: kept; equal unit values would remove the core strategic tradeoff between strength and build time.
- FR-008: Frontline moves according to the current score. Priority: must-have
  > Socrates: Counter-argument considered: updating the frontline only after each deployment could be clearer than continuous movement. Resolution: kept; smooth movement is more readable and provides a better player experience.
- FR-009: Game declares a win or loss when the frontline reaches a boundary. Priority: must-have
  > Socrates: Counter-argument considered: a fixed match timer and final score could make short-session duration more predictable. Resolution: kept; time pressure may be interesting, but reaching a frontline boundary is the defining match outcome.
- FR-011: Player can restart a completed match. Priority: nice-to-have
  > Socrates: Counter-argument considered: restart may distract from completing the must-have flow. Resolution: kept as a nice-to-have.

### Match Results

- FR-010: Game saves completed match results for future level progression. Priority: must-have
  > Socrates: Counter-argument considered: saving results adds backend scope before level progression exists. Resolution: kept; it is simple and CRUD functionality is a non-negotiable project requirement.

## Non-Functional Requirements

- A typical match lasts around 2 minutes, with duration varying according to player decisions, unit timing, and NPC pressure.
- Starting to build a unit and sending a completed unit produce immediate visible feedback.
- When a unit reaches the frontline, its movement changes smoothly and immediately to clearly show which side is winning.
- Temporary network unavailability must not cause a completed match result or match history to be lost; pending results synchronize when connectivity returns.

## Business Logic

Deployed player units add their strength to the frontline score, deployed NPC units subtract their strength, and the score's direction and magnitude determine frontline movement toward victory or defeat.

Positive pressure causes the blue player line to push upward, while negative pressure causes the red NPC line to push downward. Larger score differences produce faster frontline movement. A match ends when the frontline reaches either the NPC or player boundary.

## Non-Goals

- No real-time multiplayer, social features, or leaderboard; the MVP proves a focused single-player match.
- No complex AI, pathfinding, physics-based combat, or backend-authoritative simulation; these are unnecessary for proving the core frontline rule.
- No campaign, progression, economy, upgrades, inventory, or many additional unit types; the MVP remains limited to the first playable match flow.
- No monetization, ads, push notifications, or iOS support; these do not contribute to validating the Android gameplay loop.
- No advanced animation, visual effects, soundtrack, or advanced sound design; gameplay clarity takes priority over production polish.

## Quality cross-check

- Access Control: present.
- Business Logic: present.
- Project artifacts: present.
- Timeline-cost acknowledgment: present; MVP estimate is 3 weeks.
- Non-Goals: present.
- Preserved behavior: not applicable for greenfield.
