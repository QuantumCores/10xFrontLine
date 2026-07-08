# S-01 Android Verification

Date: 2026-07-08
Change: `s-01-first-saved-frontline-match`
Verifier: human manual verification

## Environment

- Device or emulator: Android Emulator `sdk_gphone16k_x86_64` (`emulator-5554`)
- Android version: 17
- API base URL: local development API, normally `http://localhost:5178/api`
- Angular build output: `src/mbl/dist/front-line/browser`
- Capacitor platform: `src/mbl/android`

## Commands

Automated commands for the phase gate:

- `cd src/mbl; npm test` - passed on 2026-07-07, 10 test files and 27 tests
- `cd src/mbl; npm run build` - passed on 2026-07-07; initial bundle 288.56 kB, with Phaser CommonJS optimization warning
- `cd src/mbl; npx cap sync android` - passed on 2026-07-07; sync finished in 0.529s
- `dotnet build src/api/frontLineApi.slnx` - passed on 2026-07-07; `NU1903` warning for `Microsoft.OpenApi` 2.0.0
- `dotnet test src/api/frontLineApi.slnx` - passed on 2026-07-07, 13 tests; `NU1903` warning for `Microsoft.OpenApi` 2.0.0

Manual Android commands:

- `cd src/mbl; npx cap run android` - blocked on 2026-07-07 before device launch with `ERR_SDK_NOT_FOUND: No valid Android SDK root found`
- Local SDK probe on 2026-07-07 found no `ANDROID_HOME`, no `ANDROID_SDK_ROOT`, no SDK at the usual Windows paths, and no `adb`/`emulator`/`sdkmanager` on `PATH`
- `adb -s emulator-5554 shell getprop ro.product.model` - confirmed emulator model `sdk_gphone16k_x86_64` on 2026-07-08
- `adb -s emulator-5554 shell getprop ro.build.version.release` - confirmed Android version `17` on 2026-07-08
- `adb -s emulator-5554 shell pm list packages dev.tenxfrontline` - confirmed app package `dev.tenxfrontline.app` installed on 2026-07-08
- Human verifier ran the app in the emulator, signed in, played matches, and confirmed saved matches on 2026-07-08
- `cd src/mbl; npm test -- --include src/app/play/play-page.component.spec.ts` - passed on 2026-07-08 after retry-status visibility fix, 5 tests
- `cd src/mbl; npm test` - passed on 2026-07-08 after retry-status visibility fix, 10 test files and 28 tests
- `cd src/mbl; npm run build` - passed on 2026-07-08 after retry-status visibility fix; initial bundle 288.56 kB, with Phaser CommonJS optimization warning
- `cd src/mbl; npx cap sync android` - passed on 2026-07-08 after retry-status visibility fix; sync finished in 0.498s

## Manual Observations

- Portrait match layout and canvas alignment: passed by human emulator verification
- Build/send touch target alignment: passed by human emulator verification
- Full Victory or Defeat result overlay: passed by human emulator verification
- Save success with local API reachable: passed by human emulator verification; login worked and completed matches were saved
- Save failure and retry after stopping or blocking the API: passed after retry-status visibility fix; human verifier stopped the API before winning a match, saw the retry path after completion, restarted the API, retried, and confirmed the result saved

## Follow-Up Issues

- None for the S-01 Android manual gate.
