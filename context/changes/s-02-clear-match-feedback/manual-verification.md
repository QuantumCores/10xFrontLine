# S-02 Manual Verification

Date: 2026-07-24
Change: `s-02-clear-match-feedback`
Verifier: human manual verification

## Environment

- Browser and viewport: mobile-sized browser viewport; exact dimensions not provided
- Android device or emulator: Android emulator; exact model not provided; initial failure captured in `.debug/Screenshot 2026-07-24 225440.png` at 676x1536 pixels
- Android version: not provided
- Angular build output: `src/mbl/dist/front-line/browser`
- Capacitor platform: `src/mbl/android`

## Commands

Automated commands for the phase gate:

- `cd src/mbl; npm run build` - passed on 2026-07-24; rerun after the Android viewport fix passed with a 288.67 kB initial bundle and the existing Phaser CommonJS optimization warning
- `cd src/mbl; npm test -- --watch=false` - passed on 2026-07-24; 10 test files and 28 tests
- `cd src/mbl; npx cap sync android` - passed on 2026-07-24; rerun after the Android viewport fix completed in 0.729s

Manual browser and Android verification was performed by the human verifier after each synced build.

## Manual Observations

- Pressure marker uses blue for positive pressure, white for neutral pressure, and red for negative pressure: passed by human browser verification
- Unit cards clearly distinguish buildable, building, unavailable, ready, and sendable states: passed by human browser verification
- Active build progress remains readable inside the stable progress bar: passed as part of the human unit-card verification
- NPC active build unit is visible without progress, elapsed time, or remaining time: passed by human browser verification
- Browser mobile-portrait layout is readable and touch targets remain aligned: passed by human verification
- Android portrait layout and touch alignment: passed after the viewport-sizing and scene-spacing refinements
- Match building, sending, completion, and result-saving behavior shows no regression: passed by human verification

## Follow-Up Issues

- Initial Android verification exposed clipping at the bottom of the player unit cards.
- The game host now consumes the viewport height remaining below the Angular header, allowing Phaser `FIT` scaling to constrain the canvas by both available width and height.
- Follow-up Android review confirmed the full canvas was visible but showed excessive space below the player controls; the player-control band was moved down 32 logical pixels in two refinements, retaining a 24-pixel bottom margin.
- The battlefield was extended 48 logical pixels downward after Android review, leaving a compact 26-pixel lane-to-card separation.
- Final human Android verification confirmed the layout looks good; no S-02 follow-up issue remains.
