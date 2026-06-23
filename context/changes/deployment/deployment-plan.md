# OVH Integration and Deployment Plan

## Summary

Deploy the ASP.NET Core API and SQL Server Express to a clean OVHcloud Ubuntu VPS. GitHub Actions builds immutable releases and a manually approved workflow promotes them over restricted SSH.

The MVP uses:

- OVHcloud for the VPS and DNS.
- Google Play Console for Android app setup, testing tracks, review, and production distribution.
- The existing Google account for transactional email through Gmail SMTP.
- Local SQL Server backups, with a manual copy to the developer's Windows computer after releases. No OVH Object Storage is required.
- An independent external uptime monitor for HTTPS and certificate-expiry checks.

This document is both the execution checklist and the beginner-oriented runbook. Check a phase only after its verification steps pass. Record dates, commands run, unexpected results, and recovery actions under the relevant phase. Never place passwords, App Passwords, private keys, connection strings, or recovery keys in this file.

## How to Use This Manual

- Commands marked **Windows PowerShell** run on the developer's Windows computer.
- Commands marked **Ubuntu VPS** run after connecting to the server through SSH.
- Google Play Console steps are browser UI steps. Confirm the current Google Play requirements during execution because account verification, target API level, and review requirements change over time.
- Replace values in angle brackets, such as `<VPS_IP>` or `<DOMAIN>`, with real values. Do not type the angle brackets.
- Run one command block at a time. Read its output before continuing.
- `sudo` means “run as administrator.” Ubuntu asks for the current Linux user's password; typed passwords are not displayed.
- To edit a file with Nano, run `sudo nano <file>`. Save with `Ctrl+O`, press `Enter`, and exit with `Ctrl+X`.
- Do not close the current SSH session after changing SSH or firewall settings. Open a second session and verify access first.
- If a command fails, stop at that step. Do not compensate with unrelated commands copied from forums.

## Implementation Phases

### Phase 1 — Confirm Compatibility and Collect Inputs

- [ ] Open the current Microsoft SQL Server on Linux support matrix and confirm which Ubuntu LTS release supports SQL Server Express.
- [ ] Open the current SQL Server Ubuntu installation guide and record the supported SQL Server repository/version.
- [ ] Confirm the API remains `net10.0` and will be published as self-contained `linux-x64`; the VPS therefore does not need a separately installed .NET runtime.
- [ ] Confirm the Android app will be distributed through Google Play as an Android App Bundle produced from the Angular app through Capacitor.
- [ ] Confirm the permanent Android package ID before creating the Play Console app. Recommended pattern: `com.<DOMAIN_WITHOUT_TLD>.frontline` or another stable reverse-DNS identifier owned by the developer. This ID cannot be reused for a different app later.
- [ ] Confirm the Google Play developer account owner, account type, legal developer name, support email, and whether the account is Personal or Organization.
- [ ] If the Play Console account is a Personal account created after 2023-11-13, recruit at least 12 closed-testers before the production timeline is committed because the closed-test waiting period can block release.
- [ ] Collect Play listing inputs: app name, short description, full description, app icon, feature graphic, phone screenshots, game category, tags, support email, privacy policy URL, target countries, pricing, intended audience, content-rating answers, and app-access review instructions.
- [ ] Decide where the public privacy policy and account/data deletion instructions will live. This can be a small static page served by Nginx on the VPS; it is not Angular web hosting.
- [ ] Provision a clean OVH VPS with the confirmed Ubuntu release, at least 2 vCPU, 4 GB RAM, and 80 GB SSD in an EU region.
- [ ] Record these non-secret values locally: VPS IPv4 address, Ubuntu version, OVH VPS name, SSH username, domain, intended `api.<DOMAIN>` hostname, and Google sender address.
- [ ] Create an `A` record in OVH DNS: host `api`, target `<VPS_IP>`, default TTL.
- [ ] Wait for DNS propagation and verify it from Windows PowerShell:

```powershell
Resolve-DnsName api.<DOMAIN>
```

Expected result: the returned IPv4 address equals the VPS address.

Stop conditions:

- If Microsoft does not support a native SQL Server edition on the available Ubuntu image, do not improvise with another repository. Re-plan the database installation or use Azure SQL.
- If the VPS has less than 4 GB RAM, resize before installing SQL Server.
- If DNS points somewhere else, fix DNS before requesting a certificate.
- If the Android package ID, Play account ownership, or privacy policy URL is undecided, do not create the Play Console app yet.

### Phase 2 — First Login and Basic Ubuntu Safety

- [ ] On Windows, create a dedicated deployment SSH key. Accept the default location or choose a clearly named file; do not add an empty passphrase.

```powershell
ssh-keygen -t ed25519 -C "frontline-deploy"
```

- [ ] Use the initial credentials supplied by OVH to connect:

```powershell
ssh <INITIAL_USER>@<VPS_IP>
```

- [ ] On the Ubuntu VPS, show the OS and available resources:

```bash
cat /etc/os-release
free -h
df -h
```

- [ ] Update installed packages and reboot:

```bash
sudo apt update
sudo apt upgrade -y
sudo reboot
```

- [ ] Wait approximately one minute and reconnect from Windows.
- [ ] Create a non-root deployment account if OVH did not already provide one:

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
```

- [ ] Copy the public key from Windows:

```powershell
Get-Content $HOME\.ssh\id_ed25519.pub
```

- [ ] While logged into Ubuntu, install that single public-key line for the deployment user:

```bash
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
sudo nano /home/deploy/.ssh/authorized_keys
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

- [ ] From a second Windows PowerShell window, verify `ssh deploy@<VPS_IP>` works before continuing.
- [ ] Install the firewall and intrusion protection:

```bash
sudo apt install -y ufw fail2ban curl wget unzip nginx certbot python3-certbot-nginx
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status verbose
sudo systemctl enable --now fail2ban nginx
```

- [ ] Only after the second SSH login succeeds, edit `/etc/ssh/sshd_config` and set:

```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

- [ ] Validate and reload SSH without ending the current session:

```bash
sudo sshd -t
sudo systemctl reload ssh
```

- [ ] Open a third SSH connection and confirm key-based access still works.
- [ ] Enable automatic security updates:

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

Verification:

```bash
sudo systemctl status nginx --no-pager
sudo systemctl status fail2ban --no-pager
sudo ufw status verbose
```

### Phase 3 — Install and Secure SQL Server Express

- [ ] Follow the Microsoft Ubuntu installation page for the exact OS and SQL Server version confirmed in Phase 1. Copy repository setup commands only from `learn.microsoft.com` or `packages.microsoft.com`.
- [ ] Install `mssql-server`, then run the Microsoft setup command:

```bash
sudo /opt/mssql/bin/mssql-conf setup
```

- [ ] Select the **Express** edition, accept the licence, choose a strong `sa` password, and store it in the password manager. Do not place it in shell history or this repository.
- [ ] Install the matching `mssql-tools`/`sqlcmd` package using the same Microsoft guide.
- [ ] Verify SQL Server is active:

```bash
sudo systemctl status mssql-server --no-pager
sudo ss -lntp | grep 1433
```

Expected result: SQL Server is running and port 1433 is listening locally. UFW must not expose port 1433 publicly.

- [ ] Connect locally with `sqlcmd`, create a `FrontLine` database, create a dedicated application login/user, and grant only the permissions required by EF Core migrations and normal API operation. Do not use `sa` in the application connection string.
- [ ] Create the native backup directory and allow SQL Server to write there:

```bash
sudo install -d -m 700 -o mssql -g mssql /var/opt/mssql/backups
```

- [ ] Make a first native `.bak` backup with `sqlcmd`, list the file, and verify it using `RESTORE VERIFYONLY`.
- [ ] Configure a daily local backup with a root-owned script and systemd timer. Keep seven daily files and alert when no successful backup exists within 26 hours.
- [ ] After each production deployment, copy the newest backup to Windows:

```powershell
scp deploy@<VPS_IP>:/var/opt/mssql/backups/<BACKUP_FILE>.bak D:\Backups\FrontLine\
```

The deployment script must first copy the selected backup into a temporary file readable by `deploy`, then remove that temporary copy after transfer. Do not make the SQL backup directory world-readable.

- [ ] Retain at least the three newest off-VPS backup files on Windows.
- [ ] Perform a test restore into a separate database before accepting users.

Accepted MVP limitation: local VPS backups and manual workstation copies are less reliable than automated off-site storage. Missing the post-deployment copy is an operational failure and must block release completion.

### Phase 4 — Prepare the API for Production

- [ ] Add `GET /health/live` for process health and `GET /health/ready` for SQL Server connectivity. Return minimal status data and no exception details.
- [ ] Add structured logging, correlation IDs, forwarded-header handling, production error handling, and explicit CORS origins for the Capacitor application.
- [ ] Add a Gmail-backed email sender behind an application-owned interface. Use authenticated SMTP with STARTTLS; configure the server, port, username, App Password, and sender through environment variables.
- [ ] Handle Gmail timeout, authentication failure, throttling, and rejection. Authentication endpoints must return a generic response that does not reveal whether an account exists.
- [ ] Add bounded retries only for transient SMTP errors. Never log login codes, App Passwords, message bodies, or complete recipient addresses.
- [ ] Add EF Core migrations and produce a migration bundle during CI. Migrations must remain backward-compatible with the previous API release.
- [ ] Configure the mobile production API base URL as `https://api.<DOMAIN>`.
- [ ] From the repository root on Windows, verify the release build:

```powershell
dotnet restore src/api/frontLineApi.csproj
dotnet build src/api/frontLineApi.csproj -c Release --no-restore
dotnet publish src/api/frontLineApi.csproj -c Release -r linux-x64 --self-contained true -o artifacts/api
```

### Phase 5 — Configure the Existing Google Account

- [ ] Confirm two-step verification is enabled on the Google account.
- [ ] Create a dedicated Google App Password named `Front Line VPS`. Use an App Password, never the normal Google password.
- [ ] If App Passwords are unavailable because of Workspace policy, Advanced Protection, or account security settings, stop and configure Google Workspace SMTP relay or choose another transactional provider. Do not weaken the Google account.
- [ ] Use these application settings, confirming them against current Google documentation before deployment:
  - Host: `smtp.gmail.com`
  - Port: `587`
  - Security: STARTTLS
  - Username: the complete Google email address
  - Password: the dedicated App Password
  - From: the same account or a Google-verified alias
- [ ] From Ubuntu, verify the VPS can reach Gmail SMTP without sending credentials:

```bash
openssl s_client -starttls smtp -connect smtp.gmail.com:587 -crlf
```

Expected result: a successful TLS connection and certificate verification. Exit with `Ctrl+C`.

- [ ] Send a test login code through the application to a separate mailbox and check delivery, spam placement, and redacted application logs.
- [ ] Record Google's current sending limits for this account type. Treat Gmail as an MVP dependency; if limits or delivery quality become insufficient, replace only the email adapter.

### Phase 6 — Create Production Directories, Secrets, and systemd Service

- [ ] Create the application directories and service account:

```bash
sudo adduser --system --group --home /opt/frontline frontline
sudo install -d -m 755 -o frontline -g frontline /opt/frontline/releases
sudo install -d -m 755 -o frontline -g frontline /opt/frontline/shared
sudo install -d -m 750 -o root -g frontline /etc/frontline
```

- [ ] Create `/etc/frontline/api.env` with `sudo nano`. Put one `NAME=value` setting per line. Include:

```text
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://127.0.0.1:5000
ConnectionStrings__FrontLine=<APPLICATION_CONNECTION_STRING>
Authentication__SigningKey=<LONG_RANDOM_SECRET>
Email__Host=smtp.gmail.com
Email__Port=587
Email__UseStartTls=true
Email__Username=<GOOGLE_EMAIL>
Email__Password=<GOOGLE_APP_PASSWORD>
Email__From=<GOOGLE_EMAIL_OR_VERIFIED_ALIAS>
Cors__AllowedOrigins__0=https://localhost
PublicUrl=https://api.<DOMAIN>
```

- [ ] Protect the file:

```bash
sudo chown root:frontline /etc/frontline/api.env
sudo chmod 640 /etc/frontline/api.env
```

- [ ] Add `/etc/systemd/system/frontline-api.service` with `User=frontline`, `Group=frontline`, `WorkingDirectory=/opt/frontline/current`, `ExecStart=/opt/frontline/current/frontLineApi`, `EnvironmentFile=/etc/frontline/api.env`, automatic restart on failure, and system hardening options.
- [ ] Validate and load the unit:

```bash
sudo systemd-analyze verify /etc/systemd/system/frontline-api.service
sudo systemctl daemon-reload
sudo systemctl enable frontline-api
```

Do not start it until the first release directory exists.

### Phase 7 — Configure Nginx, DNS, and HTTPS

- [ ] Create `/etc/nginx/sites-available/frontline-api` to proxy `api.<DOMAIN>` to `http://127.0.0.1:5000`. Include forwarded headers, reasonable request/time-out limits, and rate limiting for authentication endpoints.
- [ ] Enable the site and disable the default site:

```bash
sudo ln -s /etc/nginx/sites-available/frontline-api /etc/nginx/sites-enabled/frontline-api
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

- [ ] Confirm `Resolve-DnsName api.<DOMAIN>` still returns the VPS IP.
- [ ] Request the certificate:

```bash
sudo certbot --nginx -d api.<DOMAIN>
```

- [ ] Test automatic renewal:

```bash
sudo certbot renew --dry-run
```

- [ ] Verify the timer:

```bash
systemctl list-timers | grep certbot
```

### Phase 8 — Configure GitHub Actions and First Deployment

- [ ] Add CI that restores, builds, and tests the API; runs `npm ci`, Angular build, and tests; validates deployment scripts; and publishes a self-contained `linux-x64` artifact named by commit SHA.
- [ ] Add a manually dispatched production workflow using the GitHub `production` environment.
- [ ] Put only these transport values in GitHub environment secrets: SSH private key, host, port, username, and pinned host fingerprint. Application, SQL, and Gmail secrets stay only in `/etc/frontline/api.env`.
- [ ] Restrict the deployment account's `sudo` access to the reviewed release/rollback scripts and `frontline-api` restart. It must not receive unrestricted passwordless sudo.
- [ ] For every deployment, the workflow must:
  1. Download the exact CI artifact for the selected commit.
  2. Verify its checksum.
  3. Upload it into `/opt/frontline/releases/<COMMIT_SHA>`.
  4. Set ownership to `frontline:frontline`.
  5. Create and verify a SQL backup.
  6. Run the explicitly approved migration bundle.
  7. Atomically switch `/opt/frontline/current` to the new directory.
  8. Restart `frontline-api`.
  9. Poll `/health/ready` through HTTPS.
  10. Restore the previous symlink automatically if readiness fails and the schema remains compatible.
- [ ] After the first release, inspect Ubuntu logs:

```bash
sudo systemctl status frontline-api --no-pager
sudo journalctl -u frontline-api --since "15 minutes ago" --no-pager
sudo tail -n 100 /var/log/nginx/error.log
```

- [ ] From Windows, verify:

```powershell
curl.exe -i https://api.<DOMAIN>/health/live
curl.exe -i https://api.<DOMAIN>/health/ready
```

- [ ] Download the verified post-deployment SQL backup to Windows before marking the deployment complete.

### Phase 9 — Monitoring, Rollback, and Final Acceptance

- [ ] Configure an independent external monitor for `https://api.<DOMAIN>/health/live` and TLS expiry. Send alerts to an address checked regularly.
- [ ] Keep at least five immutable API release directories.
- [ ] Rehearse binary rollback by repointing `/opt/frontline/current`, restarting the service, and verifying readiness.
- [ ] Rehearse database restore into a separate database; do not overwrite production during the test.
- [ ] Test from an Android build: login-code delivery, authentication, authenticated API access, match-result save, temporary offline storage, and later synchronization.
- [ ] Reboot the VPS and confirm SQL Server, Nginx, fail2ban, and the API return automatically.

```bash
sudo reboot
```

- [ ] After reconnecting, verify services:

```bash
sudo systemctl --failed
sudo systemctl status mssql-server nginx fail2ban frontline-api --no-pager
```

### Phase 10 — Initialize Capacitor and Produce an Android Release Build

- [ ] Add Capacitor to the Angular app. This repository currently has Angular only; Capacitor must be installed and initialized before Google Play can receive an Android build.

```powershell
cd src\mbl
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Front Line" "<ANDROID_PACKAGE_ID>" --web-dir dist/front-line/browser
```

- [ ] If the Angular build output path differs from `dist/front-line/browser`, update `capacitor.config.*` to the actual folder that contains `index.html`.
- [ ] Add the Android project:

```powershell
npm run build
npx cap add android
npx cap sync android
```

- [ ] Configure the production API base URL in the Angular build as `https://api.<DOMAIN>`. The production Android build must not point at localhost, a LAN IP, or a temporary tunnel.
- [ ] Set the Android app name, icon, splash screen, supported orientation, package ID, minimum SDK, target SDK, and requested permissions. Remove any permission not needed by the MVP.
- [ ] Verify the app works on a physical Android device before creating a release bundle:

```powershell
npm run build
npx cap sync android
npx cap run android
```

- [ ] Generate a dedicated upload keystore for Google Play. Store the keystore file and password in the password manager and offline backup. Do not commit the keystore, passwords, `key.properties`, or signing environment files.

```powershell
keytool -genkeypair -v -keystore upload-keystore.jks -alias frontline-upload -keyalg RSA -keysize 2048 -validity 10000
```

- [ ] Configure Android release signing to use the upload key. Prefer local `android/key.properties` or CI secrets; never hard-code signing material in Gradle files.
- [ ] Accept Play App Signing in Play Console. For the MVP, use a Google-managed app signing key and keep only the upload key under developer control.
- [ ] Set `versionCode` and `versionName` for the first release. Increment `versionCode` for every Play upload, including internal-test-only builds.
- [ ] Build the release Android App Bundle:

```powershell
cd src\mbl\android
.\gradlew.bat clean bundleRelease
```

Expected artifact: `src/mbl/android/app/build/outputs/bundle/release/app-release.aab`.

- [ ] Archive the exact `.aab`, commit SHA, versionCode, versionName, signing-key alias, and build command in the deployment notes. Do not archive signing secrets.

Stop conditions:

- If Capacitor cannot produce a working local Android build, do not create a Play release.
- If the app requests unexpected Android permissions, remove them and rebuild before upload.
- If the upload key is lost before the first Play upload, generate a new key. If it is lost after enrollment, follow Google's upload-key reset process.

### Phase 11 — Configure Google Play Console and Testing Tracks

- [ ] Register or verify the Play Console developer account. Complete account type selection, developer identity verification, payment profile, and any required Android-device verification.
- [ ] Create the app in Play Console as a game, choose free or paid before release, set the default language, add the support email, accept the required declarations, and accept Play App Signing.
- [ ] Complete the app dashboard setup:
  - Main store listing: app name, descriptions, icon, feature graphic, screenshots, category, tags, and contact details.
  - Privacy policy URL and account/data deletion instructions.
  - App access instructions for review. For passwordless login, provide a stable reviewer path such as a dedicated test email inbox or demo account flow that can receive codes during review.
  - Data safety form based on the real implementation. Include account email, authentication identifiers, gameplay/progress data, diagnostics, analytics, crash reporting, and any sharing with Gmail/Google or other processors if present.
  - Content rating questionnaire, target audience, ads declaration, sensitive permissions declarations, and any required policy forms.
  - Target API level check against the current Google Play requirement.
- [ ] Upload the first `.aab` to Internal testing. Run Play pre-launch checks and fix crashes, blocked startup, certificate/API connectivity issues, policy warnings, and Data safety mismatches.
- [ ] Test the internal build from Google Play on a physical Android device: install from the Play testing link, request a login code, authenticate, play a match, save a result, go offline, return online, and confirm synchronization through `https://api.<DOMAIN>`.
- [ ] If the developer account is subject to the new Personal-account requirement, create a Closed testing track with at least 12 opted-in testers for 14 continuous days before applying for production access. Keep a feedback log because Play Console asks for testing and readiness answers.
- [ ] Apply for production access when the closed-test requirement is satisfied, if required for this account.
- [ ] Promote the tested bundle to Production only after backend monitoring, SQL backups, privacy policy, app-access instructions, Data safety, content rating, and store listing are complete.
- [ ] Use managed publishing or staged rollout for the first production release. Do not publish automatically from CI until a manual Play Console release has succeeded.
- [ ] After production approval, verify install from the public Play Store page on a device not enrolled in testing.

Accepted MVP limitation: Google Play release is partly manual. CI may build and archive the `.aab`, but Play Console app creation, policy declarations, production-access approval, and final rollout remain human-approved tasks.

### Phase 12 — Optional Google Play Release Automation

- [ ] After the first manual production release succeeds, decide whether Play uploads are worth automating.
- [ ] If automation is useful, configure Google Play Developer API access and a least-privilege service account for upload/promote operations only.
- [ ] Store the Play service-account JSON only as a GitHub production environment secret. Do not place it in the repository or local deployment notes.
- [ ] Keep production rollout manual even if `.aab` upload is automated. A human must approve track promotion and rollout percentage changes.
- [ ] Update the GitHub Actions workflow so Android release jobs run only after Angular checks pass and only for explicitly selected commits.

## Public Interfaces and Configuration

- New unauthenticated endpoints: `GET /health/live` and `GET /health/ready`.
- New application abstraction: a transactional email sender implemented with Gmail SMTP for the MVP.
- Android distribution artifact: signed Android App Bundle (`.aab`) generated from the Capacitor Android project.
- Production configuration namespaces:
  - `ConnectionStrings__FrontLine`
  - `Authentication__*`
  - `Email__Host`, `Email__Port`, `Email__UseStartTls`, `Email__Username`, `Email__Password`, `Email__From`
  - `Cors__AllowedOrigins`
  - `PublicUrl`
- GitHub stores deployment transport credentials only.
- If CI builds Android release bundles, GitHub may also store Android upload-key material and optional Play Developer API credentials in the protected production environment. These secrets are separate from VPS transport credentials.

## Edge-Case Support

- [ ] **SSH no longer works:** use the OVH KVM/console, inspect `/var/log/auth.log`, validate `sshd_config`, restore key access, and only then close the console.
- [ ] **Firewall blocks the server:** use the OVH console and run `sudo ufw status numbered`; remove only the incorrect rule and preserve SSH/HTTPS access.
- [ ] **API does not start:** run `systemctl status` and `journalctl`; verify the release executable, ownership, environment-file syntax, port availability, and database connectivity.
- [ ] **Nginx returns 502:** verify `frontline-api` is running and listening on `127.0.0.1:5000`, then inspect Nginx and API logs.
- [ ] **SQL Server fails or exhausts resources:** stop deployment, check `free -h`, `df -h`, SQL logs, and backup availability; resize the VPS or move to Azure SQL rather than disabling safety controls.
- [ ] **Migration succeeds but the API fails:** preserve both releases, assess schema compatibility, and restore the verified pre-deployment backup only through the recovery procedure.
- [ ] **Gmail rejects authentication:** confirm two-step verification, App Password validity, complete email username, STARTTLS/port 587, Google security alerts, and account policy. Never substitute the normal password.
- [ ] **Gmail throttles or blocks mail:** stop repeated retries, inspect redacted errors and current account limits, wait for the documented recovery interval, and switch the email adapter if the limitation persists.
- [ ] **Certificate renewal fails:** run the dry-run command, verify DNS, ports 80/443, system time, and Certbot logs; renew manually before expiry and retest Android trust.
- [ ] **Local backup fails:** block deployment, check disk space and SQL permissions, create and verify a new backup, then download it to Windows.
- [ ] **GitHub deployment is interrupted:** leave `current` unchanged until validation completes. Investigate and remove an incomplete release only after confirming it is not active.
- [ ] **Deployment key is exposed:** remove it from `authorized_keys`, rotate the GitHub secret, audit GitHub runs and `/var/log/auth.log`, and redeploy only from a verified commit.
- [ ] **Android build cannot reach the API:** verify the production base URL, HTTPS certificate chain, Android network security config, CORS/auth settings, and Nginx/API logs.
- [ ] **Play Console rejects the bundle:** check package ID, signing certificate/upload key, versionCode increment, target API level, app size, permissions, and policy warnings.
- [ ] **Play review cannot log in:** verify the reviewer instructions, test mailbox, code delivery, rate limits, and generic authentication responses. Do not expose real user accounts.
- [ ] **Data Safety or privacy policy is inaccurate:** block release, update the policy and Play declarations to match the app behavior, then resubmit.
- [ ] **Closed testing requirement blocks production:** keep the app in closed testing, recruit replacement testers if needed, and wait until the required tester count has been opted in continuously for the required period.

## Acceptance Criteria

- [ ] CI succeeds from a clean checkout with locked dependencies.
- [ ] Kestrel and SQL Server are unreachable from the public internet.
- [ ] Secrets do not appear in artifacts, logs, repository history, shell history, or workflow output.
- [ ] Production promotion requires a human action and deploys the exact tested commit.
- [ ] Gmail sends passwordless codes using a dedicated App Password and generic authentication responses.
- [ ] HTTPS, certificate renewal, local SQL backup, off-VPS workstation copy, test restore, and binary rollback are demonstrated.
- [ ] External monitoring detects API failure and certificate-expiry risk.
- [ ] The Android build authenticates and synchronizes a pending result through the production hostname.
- [ ] Capacitor is installed and the Android project builds a signed release `.aab`.
- [ ] The Play Console app is created with the permanent package ID, Play App Signing, privacy policy, app access instructions, Data Safety, content rating, target audience, and store listing completed.
- [ ] Internal testing installs from Google Play and passes the login, gameplay, offline, and synchronization smoke test.
- [ ] If the account requires closed testing, production access is approved after the required tester period.
- [ ] The first production Play release is manually approved, reviewed by Google Play, and installable from the public listing.

## Assumptions and Accepted Risks

- A new OVH VPS and an OVH-managed domain are available.
- The existing Google account permits App Passwords and its current sending limits cover MVP traffic.
- No OVH Object Storage or other automated remote backup service will be used for the MVP.
- SQL backups remain on the VPS and are copied manually to the Windows development machine after deployments. This creates a deliberate recovery and human-error risk.
- Production-only deployment is sufficient; pull requests use CI rather than a persistent staging server.
- The Play Console developer account can be created or already exists, identity verification can be completed, and the one-time registration fee can be paid.
- Google Play policy declarations are treated as release-blocking work, not paperwork after the build is done.
- Personal Play Console accounts created after 2023-11-13 may require at least 12 closed-testers opted in for 14 continuous days before production access.
- App review and production-access review can take days and may exceed the backend deployment timeline.
- Version-sensitive Ubuntu, Microsoft repository, SQL Server, and Google security instructions must be checked against official documentation during execution.
- Version-sensitive Google Play requirements, including target API level, account verification, testing tracks, Data Safety, and app review rules, must be checked against official Google documentation during execution.

## Official References Checked

- Google Play Console account setup: https://support.google.com/googleplay/android-developer/answer/6112435
- Create and set up a Play Console app: https://support.google.com/googleplay/android-developer/answer/9859152
- Play App Signing and upload keys: https://developer.android.com/studio/publish/app-signing
- Internal, closed, and open testing tracks: https://support.google.com/googleplay/android-developer/answer/9845334
- Personal-account testing requirements: https://support.google.com/googleplay/android-developer/answer/14151465
- Data Safety form: https://support.google.com/googleplay/android-developer/answer/10787469
- Target API level requirements: https://support.google.com/googleplay/android-developer/answer/11926878
