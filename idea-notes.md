# Front Line

## Idea description

Front Line is a simple 2D single-player strategy game for Android. The player builds different types of units from the bottom section of the screen and sends completed units to the front line. Each unit has a build time and strength value. Stronger units take longer to build, while weaker units can be deployed faster.

The NPC opponent builds and sends its own units from the opposite side. Player units increase the front line score, while NPC units decrease it. If the score is positive, the front line moves toward the NPC side. If the score is negative, the front line moves toward the player side. The player wins when the front line reaches the top of the screen and loses when it reaches the bottom.

## MVP

The MVP should include the minimum functionality needed to prove the core gameplay loop and satisfy the technical project requirements.

Core gameplay:

Main game screen with a visible front line.
At least 3 player unit types with different strength and build time values.
Ability for the player to start building one unit at a time.
Build progress/timer for each unit.
Ability to send a completed unit to the front line.
Front line score calculation.
Front line movement based on current score.
NPC that automatically builds and sends units.
Win condition when the front line reaches the NPC side.
Lose condition when the front line reaches the player side.
Basic game restart flow.

Application functionality:

User registration and login.
Authenticated access to the game.
Save completed match results.
Display user match history.
Basic CRUD for unit definitions or level definitions.
GitHub repository.
CI/CD pipeline that builds the frontend and backend.
Android build using Capacitor.

## Non-MVP — things that should not be included in MVP

Real-time multiplayer.
Complex AI.
Pathfinding.
Physics-based combat.
Advanced animations.
Large campaign mode.
Many unit types.
In-game economy or resource system.
Player progression system.
Unit upgrades.
Inventory.
Online leaderboard.
Push notifications.
In-app purchases.
Ads.
Soundtrack and advanced sound design.
Complex visual effects.
Custom account recovery flow.
Social login, unless auth provider makes it trivial.
Backend-side authoritative game simulation.
Anti-cheat system.
iOS support.
Success criteria

## Success criteria

The game can be launched on Android.
A user can register, log in, and access the game.
The player can build and send units (one at a time).
The NPC can build and send units automatically (also one at a time).
The front line moves correctly based on player and NPC unit strength.
The game ends with a clear win or loss result.
Match results are saved to the backend.
The user can view previous match results.
At least one meaningful entity supports CRUD, for example unit definitions or level definitions.
The repository contains a working CI/CD pipeline.
The codebase has a clear separation between Angular/Phaser frontend and ASP.NET Core backend.
The MVP is simple but playable from start to finish.
The project can be demonstrated within one month.