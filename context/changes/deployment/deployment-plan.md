# OVH Integration and Deployment Plan

## Summary

Deploy the ASP.NET Core API and SQL Server Express to a clean OVHcloud Ubuntu VPS. GitHub Actions builds immutable releases and a manually approved workflow promotes them over restricted SSH.

The MVP uses two network tracks:

- **Track A — web/API smoke testing now:** temporary HTTP access through the VPS public IPv4 address. This track is only for health checks and non-sensitive synthetic requests. Authentication, email codes, bearer tokens, personal data, Android testing, and real users are forbidden over this track.
- **Track B — Android and real production later:** trusted HTTPS at `https://api.<DOMAIN>` using a free Let's Encrypt domain certificate with automatic renewal. The domain points to the same VPS, while the IP-only Track A endpoint remains available for restricted smoke testing.

The deployment also uses:

- OVHcloud for the VPS and stable public IPv4 address. Track A needs no domain; Track B requires a domain you control and one DNS `A` record for `api.<DOMAIN>`.
- Google Play Console for Android app setup, testing tracks, review, and production distribution.
- The existing Google account for transactional email through Gmail SMTP.
- Local SQL Server backups, with a manual copy to the developer's Windows computer after releases. No OVH Object Storage is required.
- An independent external uptime monitor for optional IP/HTTP smoke availability and required domain/HTTPS production availability and certificate expiry.

This document is both the execution checklist and the beginner-oriented runbook. Check a phase only after its verification steps pass. Record dates, commands run, unexpected results, and recovery actions under the relevant phase. Never place passwords, App Passwords, private keys, connection strings, or recovery keys in this file.

## How to Use This Manual

- Commands marked **Windows PowerShell** run on the developer's Windows computer.
- Commands marked **Ubuntu VPS** run after connecting to the server through SSH.
- Google Play Console steps are browser UI steps. Confirm the current Google Play requirements during execution because account verification, target API level, and review requirements change over time.
- Replace values in angle brackets with real values; never type the angle brackets. `<VPS_IP>` means the public IPv4 address. `<DOMAIN>` means the base domain you control, such as `example.com`; the API hostname is then `api.example.com`.
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
- [ ] Confirm the permanent Android package ID before creating the Play Console app. It is a stable reverse-DNS-style identifier and does not require purchasing the matching domain. The repository currently uses `dev.tenxfrontline.app`; confirm that value before the first Play upload because the ID cannot later be reused for a different app.
- [ ] Confirm the Google Play developer account owner, account type, legal developer name, support email, and whether the account is Personal or Organization.
- [ ] If the Play Console account is a Personal account created after 2023-11-13, recruit at least 12 closed-testers before the production timeline is committed because the closed-test waiting period can block release.
- [ ] Collect Play listing inputs: app name, short description, full description, app icon, feature graphic, phone screenshots, game category, tags, support email, privacy policy URL, target countries, pricing, intended audience, content-rating answers, and app-access review instructions.
- [ ] Decide where the public privacy policy and account/data deletion instructions will live. This can be a small static page served by Nginx on the VPS; it is not Angular web hosting.
- [x] Provision a clean OVH VPS with the confirmed Ubuntu release, at least 2 vCPU, 4 GB RAM, and 80 GB SSD in an EU region.
- [x] Record these non-secret values locally: stable VPS IPv4 address, Ubuntu version, OVH VPS name, SSH username, and Google sender address.
- [ ] Before Track B, choose a domain you control and record the API hostname `api.<DOMAIN>`. Track A can be completed without it.
- [ ] Confirm the public IPv4 address from Windows PowerShell:

```powershell
Test-NetConnection <VPS_IP> -Port 22
```

Expected result: `TcpTestSucceeded : True`. If OVH later changes the public IPv4 address, update the IP smoke configuration and the domain's DNS `A` record. Android can keep the same domain URL and normally does not require a rebuild.

- [ ] Before Track B, create this DNS record with the company where the domain is managed:

```text
Type: A
Name/Host: api
Value/Target: <VPS_IP>
```

Do not create an `AAAA` record unless this VPS has deliberately configured, publicly reachable IPv6 on ports 80 and 443. Remove a stale `AAAA` record because Let's Encrypt may prefer IPv6 during validation.

- [ ] On **Windows PowerShell**, verify DNS before requesting a certificate:

```powershell
Resolve-DnsName api.<DOMAIN> -Type A
Resolve-DnsName api.<DOMAIN> -Type AAAA -ErrorAction SilentlyContinue
```

The `A` answer must contain exactly `<VPS_IP>`. The `AAAA` command should return no record unless working VPS IPv6 was intentionally configured. DNS changes can take time; stop until these results are correct.

Stop conditions:

- If Microsoft does not support a native SQL Server edition on the available Ubuntu image, do not improvise with another repository. Re-plan the database installation or use Azure SQL.
- If the VPS has less than 4 GB RAM, resize before installing SQL Server.
- If the VPS does not have a stable public IPv4 address, stop before configuring DNS and deployment.
- If you do not yet control a domain, complete only Track A. Do not build or test the Android production client until Track B is complete.
- If the Android package ID, Play account ownership, or privacy policy URL is undecided, do not create the Play Console app yet.

### Phase 2 — First Login and Basic Ubuntu Safety

- [ ] On Windows, create a dedicated deployment SSH key. Accept the default location or choose a clearly named file; do not add an empty passphrase.

```powershell
ssh-keygen -t ed25519 -C "frontline-deploy"
```
#### RESULT:
---
key was created

- [x] Use the initial credentials supplied by OVH to connect:

```powershell
ssh <INITIAL_USER>@<VPS_IP>
```
#### RESULT:
---
I was able to connect to VPS via powershell command line
---
- [x] On the Ubuntu VPS, show the OS and available resources:

```bash
cat /etc/os-release
free -h
df -h
```
#### RESULT:
---
PRETTY_NAME="Ubuntu 24.04.4 LTS"
---
               total        used        free      shared  buff/cache   available
Mem:           7.6Gi       389Mi       6.7Gi       1.0Mi       694Mi       7.2Gi
Swap:             0B          0B          0B
---
Filesystem      Size  Used Avail Use% Mounted on
tmpfs           776M  1.1M  775M   1% /run
/dev/sda1        72G  2.1G   70G   3% /
tmpfs           3.8G     0  3.8G   0% /dev/shm
tmpfs           5.0M     0  5.0M   0% /run/lock
/dev/sda16      881M   64M  756M   8% /boot
/dev/sda15      105M  6.2M   99M   6% /boot/efi
tmpfs           776M   12K  776M   1% /run/user/1000

- [x] Update installed packages and reboot:

```bash
sudo apt update
sudo apt upgrade -y
sudo reboot
```
#### RESULT:
---
Fetched 10.8 MB in 2s (4610 kB/s)
Reading package lists... Done
Building dependency tree... Done
Reading state information... Done
---

User sessions running outdated binaries:
 ubuntu @ session #5: login[1230]
 ubuntu @ session #7: apt[2078], sshd[1549,1608]
 ubuntu @ user manager service: systemd[1338]

No VM guests are running outdated hypervisor (qemu) binaries on this host.
---
The system will reboot now!

- [x] Wait approximately one minute and reconnect from Windows.
- [x] Create a non-root deployment account if OVH did not already provide one:

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
```
If `deploy` can't run `sudo` commands call from `ubuntu` user session and recoonect `deploy` user
```
sudo usermod -aG sudo deploy
id deploy
```

The command makes the deploy user an administrator who can run commands with sudo:
`sudo usermod -aG sudo deploy`

Each part means:
  - sudo: execute this command as administrator.
  - usermod: modify an existing user.
  - -G sudo: add the user to the supplementary group named sudo.
  - -a: append the group without removing the user’s existing groups.
  - deploy: the account being modified.

#### RESULT:
---
info: Adding new user `deploy' to supplemental / extra groups `users' ...
info: Adding user `deploy' to group `users' ...
---
I was able to connect as `deploy` from another console

- [x] Copy the public key from Windows:

```powershell
Get-Content $HOME\.ssh\id_ed25519.pub
```
#### RESULT:
---
I run `Get-Content -LiteralPath <path to name.pub>`

- [x] While logged into Ubuntu as `deploy`, install that single public-key line for the deployment user:

```bash
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
sudo nano /home/deploy/.ssh/authorized_keys
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```
On ubuntu as `deploy`
```bash
ls -la ~/.ssh
ssh-keygen -lf ~/.ssh/authorized_keys
```

Check permissions:
```bash
stat -c '%A %a %U:%G %n' ~/.ssh ~/.ssh/authorized_keys
```
Should show
```bash
drwx------ 700 deploy:deploy /home/deploy/.ssh
  -rw------- 600 deploy:deploy /home/deploy/.ssh/authorized_keys
```
If necessary, repair them:
```bash
  chmod 700 ~/.ssh
  chmod 600 ~/.ssh/authorized_keys
```
On Windows, display the fingerprint of your public key:
```powershell
  ssh-keygen -lf "C:\actual\path\frontline_deploy.pub"
```
It should match the fingerprint shown on Ubuntu.


- [x] From a second Windows PowerShell window, verify `ssh deploy@<VPS_IP>` works before continuing.
- [x] Install the firewall and intrusion protection:

```bash
sudo apt install -y ufw fail2ban curl wget unzip nginx certbot python3-certbot-nginx

sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```
When UFW warns that enabling it may disrupt SSH connections, answer:  y
Because OpenSSH was allowed first, port 22 should remain accessible. Verify:
```bash
sudo ufw status verbose
sudo systemctl enable --now fail2ban nginx
sudo systemctl status nginx --no-pager
sudo systemctl status fail2ban --no-pager
```

- [x] Create backup

```bash
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.before-frontline
```

- [x] Only after the second SSH login succeeds, edit `/etc/ssh/sshd_config` and set:

```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```
with
```bash
sudo nano /etc/ssh/sshd_config
```
Uncomment and change the lines as above.
Validate the syntax before reloading:
```bash
sudo sshd -t
```
No output means the syntax is valid. Next, inspect the effective configuration:
```bash
sudo sshd -T | grep -E 'permitrootlogin|passwordauthentication|pubkeyauthentication'
```
Expected:
```bash
permitrootlogin no
pubkeyauthentication yes
passwordauthentication no
```
If any value differs, **do not reload SSH**. This is probably due to another setting is overriding ours
```bash
sudo grep -RniE '^[[:space:]]*(PermitRootLogin|PasswordAuthentication|PubkeyAuthentication)[[:space:]]+' \
    /etc/ssh/sshd_config /etc/ssh/sshd_config.d
```

It will probably show something like:
```bash
/etc/ssh/sshd_config.d/50-cloud-init.conf:PasswordAuthentication yes
```
Create an earlier hardening snippet:
```bash
sudo nano /etc/ssh/sshd_config.d/00-frontline-hardening.conf
```
Add:
```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```
Save and exit, then validate:
```bash
sudo sshd -t
sudo sshd -T | grep -E 'permitrootlogin|passwordauthentication|pubkeyauthentication'
```

- [x] Validate and reload SSH without ending the current session:

```bash
sudo sshd -t
sudo systemctl reload ssh
```

- [x] Open a third SSH connection and confirm key-based access still works.
Keep the current connection open and test from a new PowerShell window:
```powershell
ssh -o PreferredAuthentications=publickey -o PasswordAuthentication=no `
  -i "C:\actual\path\frontline_deploy" deploy@<VPS_IP>
```

- [x] Enable automatic security updates:

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```
When the configuration screen asks whether to automatically download and install stable updates, select Yes.

Verification:
```bash
cat /etc/apt/apt.conf.d/20auto-upgrades
```
Expected settings include:
```
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
```
Check the service and timers:
```bash
sudo systemctl status unattended-upgrades --no-pager
systemctl list-timers 'apt-daily*'
```
And
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
- [ ] Add structured logging, correlation IDs, trusted forwarded-header handling, production error handling, and explicit CORS origins. Nginx owns public HTTP-to-HTTPS redirects; make the application's current unconditional `UseHttpsRedirection()` conditional so Track A can serve HTTP without redirecting to unavailable TLS.
- [ ] Add a Gmail-backed email sender behind an application-owned interface. Use authenticated SMTP with STARTTLS; configure the server, port, username, App Password, and sender through environment variables.
- [ ] Handle Gmail timeout, authentication failure, throttling, and rejection. Authentication endpoints must return a generic response that does not reveal whether an account exists.
- [ ] Add bounded retries only for transient SMTP errors. Never log login codes, App Passwords, message bodies, or complete recipient addresses.
- [ ] Add EF Core migrations and produce a migration bundle during CI. Migrations must remain backward-compatible with the previous API release.
- [ ] Implement target-aware client API configuration; changing `/etc/frontline/api.env` cannot change the compiled Angular bundle. Keep local development on `http://localhost:5178/api`, use `http://<VPS_IP>/api` for the temporary browser test build, and use `https://api.<DOMAIN>/api` for the Android production build. Do not set Capacitor `server.url` to the API.
- [ ] From the repository root on Windows, verify the release build:

```powershell
dotnet restore src/api/frontLineApi.csproj
dotnet build src/api/frontLineApi.csproj -c Release --no-restore
dotnet restore src/api/frontLineApi.csproj -r linux-x64
dotnet publish src/api/frontLineApi.csproj -c Release -r linux-x64 --self-contained true -p:UseAppHost=true --no-restore -o artifacts/api
```

The publish output must contain the Linux executable `artifacts/api/frontLineApi`. The explicit `UseAppHost=true` override is required while the project file contains `UseAppHost=false`.

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

- [ ] Send a test login code through the application to a separate mailbox and check delivery, spam placement, and redacted application logs. Run this locally over trusted loopback or after Track B HTTPS is complete; never send login codes through public Track A HTTP.
- [ ] Record Google's current sending limits for this account type. Treat Gmail as an MVP dependency; if limits or delivery quality become insufficient, replace only the email adapter.

### Phase 6 — Create Production Directories, Secrets, and systemd Service

- [x] Create the application directories and service account:

```bash
sudo adduser --system --group --home /opt/frontline frontline
id frontline
sudo -u frontline whoami
sudo install -d -m 755 -o frontline -g frontline /opt/frontline/releases
sudo install -d -m 755 -o frontline -g frontline /opt/frontline/shared
sudo install -d -m 750 -o root -g frontline /etc/frontline
```

- [ ] Create `/etc/frontline/api.env` with `sudo nano`. Put one `NAME=value` setting per line. Include:

```bash
sudo nano /etc/frontline/api.env
```
```text
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://127.0.0.1:5000
ConnectionStrings__FrontLine=<APPLICATION_CONNECTION_STRING>
Authentication__SigningKey=<LONG_RANDOM_SECRET>
Passwordless__CodePepper=<DIFFERENT_LONG_RANDOM_SECRET>
Email__Host=smtp.gmail.com
Email__Port=587
Email__UseStartTls=true
Email__Username=<GOOGLE_EMAIL>
Email__Password=<GOOGLE_APP_PASSWORD>
Email__From=<GOOGLE_EMAIL_OR_VERIFIED_ALIAS>
Cors__AllowedOrigins__0=https://localhost
Cors__AllowedOrigins__1=http://localhost:4200
PublicUrl=http://<VPS_IP>
```

`https://localhost` is the normal packaged Capacitor origin. It remains the CORS origin even though Android calls `https://api.<DOMAIN>/api`. `http://localhost:4200` is the local Angular development origin. Curl and PowerShell requests do not use CORS. `PublicUrl` is the Track A value; after Track B HTTPS is working, change it to `https://api.<DOMAIN>` and restart the service. The current code does not yet consume `PublicUrl`, so Phase 4 must either wire it to a real option or remove it before relying on it.

- [x] Protect the file:

```bash
sudo chown root:frontline /etc/frontline/api.env
sudo chmod 640 /etc/frontline/api.env
```

Verify permissions without displaying its secrets:
```bash
sudo stat -c '%A %a %U:%G %n' /etc/frontline/api.env
```

Expected:
```bash
-rw-r----- 640 root:frontline /etc/frontline/api.env
```

- [x] Add `/etc/systemd/system/frontline-api.service` with `User=frontline`, `Group=frontline`, `WorkingDirectory=/opt/frontline/current`, `ExecStart=/opt/frontline/current/frontLineApi`, `EnvironmentFile=/etc/frontline/api.env`, automatic restart on failure, and system hardening options.

```bash
 sudo nano /etc/systemd/system/frontline-api.service
```

With content
```
[Unit]
Description=Front Line ASP.NET Core API
Wants=network-online.target
After=network-online.target mssql-server.service

[Service]
Type=simple
User=frontline
Group=frontline
WorkingDirectory=/opt/frontline/current
ExecStart=/opt/frontline/current/frontLineApi
EnvironmentFile=/etc/frontline/api.env

Restart=on-failure
RestartSec=5
TimeoutStopSec=30
SyslogIdentifier=frontline-api

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ReadWritePaths=/opt/frontline/shared
UMask=0027

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl cat frontline-api
```

- [x] Validate and load the unit:

```bash
sudo systemd-analyze verify /etc/systemd/system/frontline-api.service
```
outputs
```
frontline-api.service: Command /opt/frontline/current/frontLineApi is not executable: No such file or directory
```
That warning is expected at this point. The service file now parses correctly, but Phase 8 has not yet created `/opt/frontline/current/frontLineApi`
For now, load and enable the service without starting it:
```bash
sudo systemctl daemon-reload
sudo systemctl enable frontline-api
```
outputs
```
Created symlink /etc/systemd/system/multi-user.target.wants/frontline-api.service → /etc/systemd/system/frontline-api.service.
```
```bash
systemctl is-enabled frontline-api
```
outputs
```
enabled
```

Do not start it until the first release directory exists.

### Phase 7 — Configure Web HTTP by IP and Android HTTPS by Domain

- [ ] Read this whole phase before running commands. Replace `<VPS_IP>` with the public IPv4 address and `<DOMAIN>` with the base domain you control. Never type the angle brackets.

What this phase does:

- Track A configures Nginx to receive temporary HTTP requests on port 80 at `http://<VPS_IP>`.
- Track A blocks authentication and result routes; it is only for health checks and non-sensitive smoke tests.
- Track B later adds a separate virtual host at `https://api.<DOMAIN>` for Android and real users. It does not replace or redirect the IP endpoint.
- Nginx forwards requests to the API on private address `127.0.0.1:5000`.
- Port 5000 and SQL Server port 1433 remain closed to the internet.

The API has not been deployed yet. A `502 Bad Gateway` response during Track A is therefore expected: it proves that the request reaches Nginx, but there is no API process behind it yet. Phase 8 replaces the 502 with a successful health response.

Track A is not production security. Never send a real email address, login code, JWT, cookie, password, personal data, or gameplay data over public HTTP. Do not use Track A for Android or Google Play testing.

“Web” in Track A means direct tools such as Curl/Postman or the Angular development server running locally and calling the VPS API. This phase does not publish the Angular static files on Nginx.

#### 7.1 — Check Track A application and server prerequisites

- [ ] Before deploying the first API artifact, confirm Phase 4 has added trusted forwarded-header handling and made application-level HTTPS redirection conditional. Nginx headers alone are not sufficient. During Track A, the API must not redirect HTTP requests to unavailable HTTPS. During Track B, Nginx performs the HTTP-to-HTTPS redirect.

- [ ] On **Windows PowerShell**, verify that SSH still reaches the public IP:

```powershell
Test-NetConnection <VPS_IP> -Port 22
```

Expected result: `TcpTestSucceeded : True`.

- [ ] On the **Ubuntu VPS**, verify the existing services and firewall:

```bash
sudo nginx -t
systemctl is-active nginx
sudo ufw status verbose
```

Expected results:

- Nginx reports `syntax is ok` and `test is successful`.
- `systemctl is-active nginx` prints `active`.
- UFW shows `Nginx Full` and `OpenSSH` as allowed.

Stop if any check fails. Certbot is not required for Track A.

#### 7.2 — Back up the current Nginx configuration

- [ ] Check that the backup name is unused:

```bash
sudo test ! -e /etc/nginx.before-frontline-phase7
echo $?
```

Expected result: `0`. If it prints a different number, the backup already exists. Do not overwrite it; inspect it or choose a new dated backup name.

- [ ] Create the backup:

```bash
sudo cp -a /etc/nginx /etc/nginx.before-frontline-phase7
sudo test -f /etc/nginx.before-frontline-phase7/nginx.conf && echo "Nginx backup OK"
```

Expected result: `Nginx backup OK`.

#### 7.3 — Add authentication rate-limit zones

- [ ] Create the rate-limit configuration:

```bash
sudo nano /etc/nginx/conf.d/frontline-rate-limit.conf
```

Paste exactly:

```nginx
limit_req_zone $binary_remote_addr zone=frontline_request_code:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=frontline_verify_code:10m rate=30r/m;
```

Save with `Ctrl+O`, press `Enter`, and exit with `Ctrl+X`.

These are conservative MVP limits per public IP address. Shared networks can cause several users to share a limit. Monitor HTTP 429 responses and adjust deliberately; do not test the limit by sending many real emails.

#### 7.4 — Create the shared proxy settings

- [ ] Create the proxy snippet:

```bash
sudo nano /etc/nginx/snippets/frontline-proxy.conf
```

Paste exactly:

```nginx
proxy_pass http://127.0.0.1:5000;
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_connect_timeout 5s;
proxy_send_timeout 30s;
proxy_read_timeout 30s;
```

Save and exit Nano.

#### 7.5 — Create and enable the API site

- [ ] Create the webroot that the domain in Track B will later use for automatic certificate validation:

```bash
sudo install -d -m 755 -o root -g root /var/www/frontline-acme/.well-known/acme-challenge
```

- [ ] Create the site file:

```bash
sudo nano /etc/nginx/sites-available/frontline-api
```

Paste the following, replacing `<VPS_IP>` with the real public IPv4 address:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name <VPS_IP>;

    client_max_body_size 1m;
    client_header_timeout 10s;
    client_body_timeout 10s;
    send_timeout 30s;

    # Track A safety: never expose authentication or user data over HTTP.
    location ^~ /api/auth/ {
        return 403;
    }

    location ^~ /api/results {
        return 403;
    }

    location / {
        include snippets/frontline-proxy.conf;
    }
}
```

- [ ] Check whether the enablement link already exists:

```bash
ls -l /etc/nginx/sites-enabled/frontline-api
```

`No such file or directory` is expected the first time. If a link is displayed, confirm it points to `/etc/nginx/sites-available/frontline-api` and do not create a duplicate.

- [ ] If the link did not exist, enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/frontline-api /etc/nginx/sites-enabled/frontline-api
```

- [ ] Validate before changing the running server:

```bash
sudo nginx -t
```

Continue only when both `syntax is ok` and `test is successful` appear. If validation fails, do not reload Nginx. Read the filename and line number in the error, correct that file, and run the test again.

#### 7.6 — Replace the Ubuntu default site safely

- [ ] Inspect the two relevant enablement links:

```bash
ls -l /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/reject-default
```

On the first run, `default` should exist and `reject-default` should report `No such file or directory`. If the state is different, do not run the removal block blindly; inspect the existing links and keep whichever configuration currently passes `sudo nginx -t`.

- [ ] Create a default site that rejects requests with unknown `Host` headers:

```bash
sudo nano /etc/nginx/sites-available/reject-default
```

Paste exactly:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 444;
}
```

- [ ] Enable the reject site, remove only the default-site link, validate, and reload:

```bash
sudo ln -s /etc/nginx/sites-available/reject-default /etc/nginx/sites-enabled/reject-default
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
```

If the test fails, **do not reload**. Restore the default link and remove only the new reject link:

```bash
sudo rm /etc/nginx/sites-enabled/reject-default
sudo ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
sudo nginx -t
```

If the first test succeeded, apply the configuration:

```bash
sudo systemctl reload nginx
systemctl is-active nginx
```

Expected result: `active`.

#### 7.7 — Complete Track A: verify web/API HTTP by IP

- [ ] From **Windows PowerShell**, run:

```powershell
curl.exe -I http://<VPS_IP>/
curl.exe -i http://<VPS_IP>/api/auth/request-code
curl.exe -i http://<VPS_IP>/api/results
```

Expected results:

- Before the API is deployed, `/` returns `502 Bad Gateway`. This is acceptable here.
- Both `/api/auth/request-code` and `/api/results` return `403 Forbidden`, proving that sensitive routes are blocked on Track A.

Stop if the response is an Nginx welcome page, comes from a different server, or cannot connect at all.

Track A is now ready for Phase 8 infrastructure deployment and health checks. It is not ready for authentication, Android, real users, or production acceptance.

#### 7.8 — Enable Track B later: add domain HTTPS for Android

Do this subsection only when you control the domain and are ready to configure Android or accept real authentication/user traffic. Track A remains at `http://<VPS_IP>`; only `http://api.<DOMAIN>` redirects to HTTPS.

- [ ] On **Windows PowerShell**, repeat the DNS checks from Phase 1:

```powershell
Resolve-DnsName api.<DOMAIN> -Type A
Resolve-DnsName api.<DOMAIN> -Type AAAA -ErrorAction SilentlyContinue
Test-NetConnection api.<DOMAIN> -Port 80
```

The `A` answer must be `<VPS_IP>`, `AAAA` must be absent unless working IPv6 was deliberately configured, and port 80 must be reachable. Stop if any result is wrong.

- [ ] On the **Ubuntu VPS**, check the Certbot installation already added in Phase 2:

```bash
command -v certbot
certbot --version
```

Any working Certbot version supplied by the supported Ubuntu release can perform domain webroot validation. Do not install a second Certbot with Snap on top of the existing apt package.

- [ ] Add a separate port-80 server for the domain. Back up the working Track A file first:

```bash
sudo test ! -e /etc/nginx/sites-available/frontline-api.track-a
echo $?
```

The `test` result must be `0`. If the backup exists, stop and choose a unique dated backup name rather than overwriting it. Only after result `0`, run:

```bash
sudo cp /etc/nginx/sites-available/frontline-api /etc/nginx/sites-available/frontline-api.track-a
sudo nano /etc/nginx/sites-available/frontline-api
```

Keep the existing IP `server` block unchanged and append this second block, replacing `<DOMAIN>`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.<DOMAIN>;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/frontline-acme;
        default_type text/plain;
        try_files $uri =404;
    }

    location / {
        return 404;
    }
}
```

Do not redirect yet because HTTPS does not exist. Validate first:

```bash
sudo nginx -t
```

Only when the output says both `syntax is ok` and `test is successful`, reload and check Nginx:

```bash
sudo systemctl reload nginx
systemctl is-active nginx
```

- [ ] Prove public domain validation. On the **Ubuntu VPS**:

```bash
echo "frontline-acme-ok" | sudo tee /var/www/frontline-acme/.well-known/acme-challenge/probe.txt
```

From **Windows PowerShell**:

```powershell
curl.exe --fail-with-body http://api.<DOMAIN>/.well-known/acme-challenge/probe.txt
```

Expected body: `frontline-acme-ok`. Then remove only the probe on Ubuntu:

```bash
sudo rm /var/www/frontline-acme/.well-known/acme-challenge/probe.txt
```

- [ ] Test issuance without creating a trusted certificate:

```bash
sudo certbot certonly --dry-run \
  --webroot \
  --webroot-path /var/www/frontline-acme \
  -d api.<DOMAIN>
```

Certbot may ask for a recovery email and agreement to the terms. If the dry run fails, do not retry repeatedly. Recheck DNS, stale `AAAA`, public port 80, the webroot probe, UFW, and `sudo tail -n 100 /var/log/nginx/error.log`.

- [ ] Request the trusted certificate once:

```bash
sudo certbot certonly \
  --webroot \
  --webroot-path /var/www/frontline-acme \
  -d api.<DOMAIN> \
  --cert-name frontline-api
```

Only after issuance succeeds, inspect it:

```bash
sudo certbot certificates
```

Expected paths:

```text
/etc/letsencrypt/live/frontline-api/fullchain.pem
/etc/letsencrypt/live/frontline-api/privkey.pem
```

- [ ] Back up the default-reject file before adding TLS:

```bash
sudo test ! -e /etc/nginx/sites-available/reject-default.track-a
echo $?
```

Again, the test result must be `0`; never overwrite an existing backup. Only after result `0`, run:

```bash
sudo cp /etc/nginx/sites-available/reject-default /etc/nginx/sites-available/reject-default.track-a
```

- [ ] Edit `/etc/nginx/sites-available/frontline-api`. Leave the original IP HTTP block unchanged. Replace the temporary domain HTTP block with these two domain blocks:

```bash
sudo nano /etc/nginx/sites-available/frontline-api
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.<DOMAIN>;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/frontline-acme;
        default_type text/plain;
        try_files $uri =404;
    }

    location / {
        return 308 https://api.<DOMAIN>$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name api.<DOMAIN>;

    ssl_certificate /etc/letsencrypt/live/frontline-api/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/frontline-api/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    client_max_body_size 1m;
    client_header_timeout 10s;
    client_body_timeout 10s;
    send_timeout 30s;

    location = /api/auth/request-code {
        limit_req zone=frontline_request_code burst=3 nodelay;
        limit_req_status 429;
        include snippets/frontline-proxy.conf;
    }

    location = /api/auth/verify-code {
        limit_req zone=frontline_verify_code burst=5 nodelay;
        limit_req_status 429;
        include snippets/frontline-proxy.conf;
    }

    location / {
        include snippets/frontline-proxy.conf;
    }
}
```

- [ ] Add a default TLS server so HTTPS requests by IP or an unknown name cannot reach the production API:

```bash
sudo nano /etc/nginx/sites-available/reject-default
```

Keep its existing port-80 block and append:

```nginx
server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    ssl_reject_handshake on;
}
```

- [ ] Validate before reload:

```bash
sudo nginx -t
```

If validation fails, do not reload. Restore both known-good files, validate, and reload only after validation succeeds:

```bash
sudo cp /etc/nginx/sites-available/frontline-api.track-a /etc/nginx/sites-available/frontline-api
sudo cp /etc/nginx/sites-available/reject-default.track-a /etc/nginx/sites-available/reject-default
sudo nginx -t
```

Only if that restored configuration passes validation, run:

```bash
sudo systemctl reload nginx
```

- [ ] When validation succeeds, apply and inspect the domain certificate:

```bash
sudo systemctl reload nginx
systemctl is-active nginx
echo | openssl s_client -connect api.<DOMAIN>:443 -servername api.<DOMAIN> 2>/dev/null | openssl x509 -noout -issuer -dates -ext subjectAltName
```

Expected results: Nginx is `active`, the issuer is Let's Encrypt, and `subjectAltName` contains `DNS:api.<DOMAIN>`.

- [ ] From **Windows PowerShell**, verify both endpoints. Never use `-k` or `--insecure`:

```powershell
curl.exe -I http://api.<DOMAIN>/
curl.exe -I https://api.<DOMAIN>/
curl.exe -I http://<VPS_IP>/
curl.exe -i http://<VPS_IP>/api/auth/request-code
```

Expected results before the first API deployment:

- Domain HTTP returns `308` to `https://api.<DOMAIN>/`.
- Domain HTTPS returns `502 Bad Gateway` without a certificate warning.
- IP HTTP still returns `502`; it is not redirected to the domain.
- The IP authentication route still returns `403 Forbidden`.

- [ ] Update `/etc/frontline/api.env`:

```bash
sudo nano /etc/frontline/api.env
```

Change only:

```text
PublicUrl=https://api.<DOMAIN>
```

Do not start/restart `frontline-api` until a release exists. After Phase 8 deploys the API, this setting is loaded on service start.

#### 7.9 — Test certificate renewal

- [ ] Create a deploy hook so Nginx loads every renewed certificate:

```bash
sudo install -d -m 755 -o root -g root /etc/letsencrypt/renewal-hooks/deploy
sudo nano /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
```

Paste exactly:

```sh
#!/bin/sh
/usr/sbin/nginx -t && /usr/bin/systemctl reload nginx
```

Protect it:

```bash
sudo chown root:root /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
```

- [ ] Test renewal and ask successful dry-run renewals to exercise the deploy hook:

```bash
sudo certbot renew --dry-run --run-deploy-hooks
systemctl list-timers --all | grep certbot
sudo nginx -t
systemctl is-active nginx
```

Expected results:

- Certbot reports that all simulated renewals succeeded.
- A Certbot renewal timer is listed with a future run time. Apt and Snap installations use different timer names, so inspect the returned row instead of assuming one unit name.
- Nginx still passes validation and is `active` after the deploy hook.

Stop if no unattended renewal timer is present. Do not add `--force-renewal` to a timer; Certbot decides when renewal is due.

Stop conditions and safety rules:

- Never open public firewall ports 5000 or 1433.
- Never reload Nginx after a failed `sudo nginx -t`.
- Track A may proceed to Phase 8 only for health/non-sensitive smoke deployment after Phase 4 prerequisites are complete and Nginx blocks sensitive routes.
- Do not enable Android, authentication, Gmail delivery, real users, or production acceptance until Track B trusted HTTPS and automated renewal pass.
- Keep public port 80 open for domain HTTP-01 renewal. Only the domain redirects; the restricted IP endpoint remains HTTP.
- Keep `/etc/nginx.before-frontline-phase7` until HTTPS and the first deployment are verified.

### Phase 8 — Configure GitHub Actions, Run Web Smoke Deployment, Then Enable Android Production

This phase has two kinds of work:

1. A coding task in this repository: implement and review the production artifact, migration bundle, release/rollback scripts, and workflows.
2. An operator task: install the reviewed scripts, configure GitHub, and run the first deployment.

Do not invent deployment scripts directly on the VPS with Nano. They perform privileged backup, migration, symlink, and service operations and must be committed, reviewed, and tested first.

Phase 8 can deploy an infrastructure-smoke release through Track A, but that release is not production-ready and Nginx must continue blocking authentication/result routes. Track B is required before enabling the complete API or Android client.

#### 8.1 — Mandatory stop gate: verify that earlier implementation exists

- [ ] On **Windows PowerShell**, from the repository root, run the existing automated checks:

```powershell
dotnet restore src/api/frontLineApi.slnx
dotnet build src/api/frontLineApi.slnx --configuration Release --no-restore
dotnet test src/api/frontLineApi.slnx --configuration Release --no-build

Push-Location src/mbl
npm ci
npm run lint
npm run build
npm test -- --no-progress
Pop-Location
```

All commands must exit successfully.

- [ ] Confirm all of the following repository features exist before doing any more Phase 8 work:

  - `GET /health/live` returns success when the API process is alive.
  - `GET /health/ready` checks SQL Server connectivity and returns failure when SQL is unavailable.
  - Forwarded headers trust only the local Nginx proxy, and application HTTPS redirection is conditional/disabled because Nginx owns the redirect in Track B.
  - Production exception handling, correlation IDs, structured logging, and explicit CORS origins are implemented.
  - `src/api/frontLineApi.csproj` can publish an executable named exactly `frontLineApi` for Linux. The current `<UseAppHost>false</UseAppHost>` must be removed or explicitly overridden.
  - A pinned `dotnet-ef` tool manifest and self-contained migration bundle exist.
  - The migration bundle obtains the production connection safely. It must not use the Windows trusted connection currently present in `FrontLineDbContextFactory`, and the database password must not appear in command arguments or logs.
  - Root-owned release, rollback, SQL-backup export, and export-cleanup scripts exist under a reviewed repository directory such as `ops/` and have automated tests.
  - `/etc/frontline/api.env` includes a strong `Passwordless__CodePepper` in addition to the Phase 6 settings. Do not print its value while checking it.
  - Angular has a real target-aware API base URL mechanism: local development uses `http://localhost:5178/api`, the temporary browser build uses `http://<VPS_IP>/api`, and Android production uses `https://api.<DOMAIN>/api`. The current hard-coded URL must not reach a release build.

**Current repository status when this manual was revised:** these items are not all implemented. Stop here and implement/review them as a separate code change before operating on production. The remaining sections define the required contract and the exact operator steps after that change is merged.

#### 8.2 — Required CI artifact contract

- [ ] Extend the existing `.github/workflows/pr.yml`; do not replace its API and Angular checks. For a successful push to `master`, CI must additionally:

  1. Restore for runtime `linux-x64`.
  2. Publish the API with `--configuration Release --runtime linux-x64 --self-contained true -p:UseAppHost=true`.
  3. Assert that the output contains executable `frontLineApi`.
  4. Build the self-contained EF migration bundle and include the required `appsettings.json` beside it.
  5. Package the release as `frontline-api-<FULL_COMMIT_SHA>.tar.gz`. Use a tar archive so Linux executable permissions survive artifact storage.
  6. Create a SHA-256 checksum file for the archive.
  7. Upload the archive and checksum as one immutable GitHub artifact named `frontline-api-<FULL_COMMIT_SHA>`.
  8. Validate deployment scripts with ShellCheck plus behavioral tests; `bash -n` alone checks syntax only.

Pin third-party GitHub Actions to reviewed full commit SHAs. Keep workflow permissions minimal: CI normally needs only `contents: read`.

- [ ] Add `.github/workflows/deploy-production.yml` with this contract:

  - Trigger only through `workflow_dispatch` and accept a full 40-character commit SHA.
  - Use `environment: production`.
  - Use `concurrency: production` with `cancel-in-progress: false`; never cancel a deployment during migration or release switching.
  - Use only a successful `push` run on `master` whose `head_sha` exactly equals the requested SHA. Never deploy an artifact merely because its name is similar, and never select a pull-request run.
  - Download only `frontline-api-<FULL_COMMIT_SHA>` from that validated CI run.
  - Recalculate and verify the packaged SHA-256 checksum before SSH upload.
  - Upload only to `/home/deploy/frontline-upload`; never upload directly into `/opt/frontline/releases`.
  - Use standard OpenSSH with strict host-key checking. Never use `StrictHostKeyChecking=no`, and never establish trust with `ssh-keyscan` inside the workflow.
  - Invoke only the fixed reviewed sudo gateway `/usr/local/sbin/frontline-release` with no arbitrary shell command or path arguments.
  - Poll the exact URL in the GitHub environment variable `API_HEALTH_URL` with bounded retries. Track A temporarily uses `http://<VPS_IP>/health/ready`; Track B must use `https://api.<DOMAIN>/health/ready`.
  - If readiness fails, invoke the fixed rollback gateway. Roll back only the binary symlink; never automatically restore the database.
  - Treat the first deployment specially: there is no previous release to restore, so stop the failed service and report failure.

The deployment job needs `contents: read` and `actions: read`. It must not receive repository write access.

#### 8.3 — Required privileged-script contract

- [ ] The reviewed root-owned release scripts must enforce all of the following without relying on the GitHub workflow for trust:

  - Acquire an exclusive deployment lock so two deployments cannot overlap.
  - Accept only fixed staging paths and a validated 40-character lowercase hexadecimal SHA from a manifest, not arbitrary command arguments.
  - Verify the checksum and reject unsafe archive paths before extraction.
  - Refuse to overwrite an existing release directory.
  - Create a uniquely named native SQL backup before migration; require `sqlcmd -b`, a non-empty file, and `RESTORE VERIFYONLY` success.
  - Run only the migration bundle packaged in the verified artifact.
  - Keep secrets out of arguments, output, and logs. Do not execute `/etc/frontline/api.env` as a shell script.
  - Own immutable release files as `root:frontline`, readable/executable but not writable by `frontline`. Only genuinely persistent runtime data under `/opt/frontline/shared` may be writable by the service account.
  - Atomically update `/opt/frontline/current` and retain `/opt/frontline/previous` when a previous release exists.
  - Restart `frontline-api` and preserve failed/current/previous release directories for diagnosis.
  - Export the verified pre-migration backup and its checksum temporarily to a deploy-readable directory after a successful release. Never upload database backups as GitHub artifacts.

#### 8.4 — Create a separate GitHub Actions SSH key

- [ ] On **Windows PowerShell**, generate a key used only by GitHub Actions:

```powershell
ssh-keygen -t ed25519 -f "$HOME\.ssh\frontline_github_actions" -C "frontline-github-actions"
```

For this automation-only key, leave the passphrase empty by pressing `Enter` twice. Protect the private key as a GitHub production-environment secret. If it is exposed, remove its public key from the VPS immediately and rotate the secret.

- [ ] Display the public key:

```powershell
Get-Content "$HOME\.ssh\frontline_github_actions.pub"
```

- [ ] While connected to the VPS as `deploy`, append that single public-key line to `/home/deploy/.ssh/authorized_keys`:

```bash
nano /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
```

Do not paste the private key onto the VPS.

#### 8.5 — Prepare fixed server locations and install reviewed scripts

- [ ] On the **Ubuntu VPS**, create the upload directory:

```bash
sudo install -d -m 700 -o deploy -g deploy /home/deploy/frontline-upload
```

- [ ] Copy the reviewed scripts from the repository to the VPS staging area using `scp`, then install them with fixed root ownership. Replace the example source filenames only with the actual reviewed files from the implementation change:

From **Windows PowerShell** in the repository root:

```powershell
scp .\ops\frontline-release deploy@<VPS_IP>:/home/deploy/frontline-upload/
scp .\ops\frontline-rollback deploy@<VPS_IP>:/home/deploy/frontline-upload/
scp .\ops\frontline-export-backup deploy@<VPS_IP>:/home/deploy/frontline-upload/
scp .\ops\frontline-clean-export deploy@<VPS_IP>:/home/deploy/frontline-upload/
```

Then, from the trusted administrator session on the **Ubuntu VPS**:

```bash
sudo install -m 755 -o root -g root /home/deploy/frontline-upload/frontline-release /usr/local/sbin/frontline-release
sudo install -m 755 -o root -g root /home/deploy/frontline-upload/frontline-rollback /usr/local/sbin/frontline-rollback
sudo install -m 755 -o root -g root /home/deploy/frontline-upload/frontline-export-backup /usr/local/sbin/frontline-export-backup
sudo install -m 755 -o root -g root /home/deploy/frontline-upload/frontline-clean-export /usr/local/sbin/frontline-clean-export
```

Do not continue if these files have not been implemented, reviewed, and tested in the repository.

#### 8.6 — Restore a separate administrator path before restricting `deploy`

Phase 2 added `deploy` to the unrestricted `sudo` group. That was acceptable during initial setup, but a CI-accessible deployment account must not keep general administrator access.

- [ ] Before removing that access, open a second terminal and prove that a separate administrator account such as `ubuntu` can log in using its own SSH key and run `sudo`:

```powershell
ssh -i "$HOME\.ssh\frontline_admin" ubuntu@<VPS_IP>
```

On the VPS in that second session:

```bash
sudo -v
id
```

Do not continue unless this works. If `ubuntu` currently returns `Permission denied (publickey)`, return to Phase 2 and install a dedicated admin public key first. Keep this administrator session open throughout the next steps.

- [ ] From the administrator session, create the restricted sudo policy:

```bash
sudo visudo -f /etc/sudoers.d/frontline-deploy
```

Paste exactly:

```sudoers
deploy ALL=(root) NOPASSWD: /usr/local/sbin/frontline-release "", /usr/local/sbin/frontline-rollback "", /usr/local/sbin/frontline-export-backup "", /usr/local/sbin/frontline-clean-export ""
```

Save and exit, then validate:

```bash
sudo visudo -cf /etc/sudoers.d/frontline-deploy
```

Expected result: `parsed OK`.

- [ ] Only after the separate administrator session and sudoers validation both succeed, remove `deploy` from the broad `sudo` group:

```bash
sudo gpasswd -d deploy sudo
id deploy
```

Close all old `deploy` sessions and reconnect so group membership is refreshed. Then inspect permissions:

```bash
sudo -l
sudo -n id
```

Expected results:

- `sudo -l` lists only the four fixed `/usr/local/sbin/frontline-*` gateways.
- `sudo -n id` fails. This failure is intentional and proves `deploy` no longer has general root access.

Keep the separate administrator connection open until a new `deploy` SSH connection works and the GitHub setup is complete.

#### 8.7 — Pin the VPS SSH host key

- [ ] From the trusted administrator session on the VPS, display the ED25519 host-key fingerprint and public key:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
sudo cat /etc/ssh/ssh_host_ed25519_key.pub
```

Record the fingerprint and the public key through this already trusted session. Build the known-hosts line using the exact host value the workflow will connect to:

```text
<VPS_IP> ssh-ed25519 <PUBLIC_KEY_DATA>
```

If SSH uses a non-default port, use `[<VPS_IP>]:<SSH_PORT>` at the start instead. Do not copy the `root@hostname` comment from the end of the `.pub` file; only the key type and key data are required after the host.

#### 8.8 — Configure the GitHub production environment

- [ ] In GitHub, open the repository and go to **Settings → Environments → New environment**. Create an environment named exactly `production`.

- [ ] Restrict deployment branches to `master`. Add a required reviewer if the repository visibility and GitHub plan support it. On some plans, required reviewers are available only for public repositories; the manual `Run workflow` action remains the minimum human gate.

- [ ] Under the `production` environment, add these **variables** because they are not secrets:

  - `SSH_HOST`: the same VPS IP or hostname used in the known-hosts line.
  - `SSH_PORT`: normally `22`.
  - `SSH_USER`: `deploy`.
  - `API_HEALTH_URL`: initially `http://<VPS_IP>/health/ready` for Track A. Immediately after Track B succeeds, change it to `https://api.<DOMAIN>/health/ready` and never downgrade it.

- [ ] Add these **secrets**:

  - `SSH_PRIVATE_KEY`: the complete contents of the Windows file `frontline_github_actions`—not the `.pub` file.
  - `SSH_KNOWN_HOSTS`: the complete pinned known-hosts line from Step 8.7.

Application, SQL, authentication, and Gmail secrets must remain only in `/etc/frontline/api.env` or other root-readable VPS configuration required by the reviewed scripts. Do not add them to GitHub.

#### 8.9 — Run the first production deployment

For Track A, read “production deployment” below as “infrastructure smoke deployment.” It becomes production/Android-ready only after Track B passes.

- [ ] Confirm the selected full commit SHA is on `master` and its CI run is successful.

- [ ] In GitHub, open **Actions → Deploy production → Run workflow**, paste the full commit SHA, and start the workflow. If the environment requires approval, open the waiting deployment and approve it only after confirming the SHA and CI result.

- [ ] Watch every workflow step. The deployment is successful only when checksum validation, SQL backup verification, migration, symlink switch, service restart, and public readiness polling all succeed. Do not rerun blindly after a failure; read the first failed step and the VPS logs.

#### 8.10 — Verify the first release manually

- [ ] On the **Ubuntu VPS**, inspect the release and service without opening a pager:

```bash
readlink -f /opt/frontline/current
sudo test -x /opt/frontline/current/frontLineApi && echo "Executable OK"
sudo systemd-analyze verify /etc/systemd/system/frontline-api.service
sudo systemctl status frontline-api --no-pager
sudo journalctl -u frontline-api --since "15 minutes ago" --no-pager
sudo tail -n 100 /var/log/nginx/error.log
```

Expected results:

- `current` resolves to `/opt/frontline/releases/<FULL_COMMIT_SHA>`.
- `Executable OK` appears.
- The service is `active (running)`.
- Logs contain no secret values, startup exception, repeated restart, database failure, or forwarded-header warning.

- [ ] From **Windows PowerShell**, verify the public endpoints for the active track.

Track A, non-sensitive smoke testing only:

```powershell
curl.exe --fail-with-body -i http://<VPS_IP>/health/live
curl.exe --fail-with-body -i http://<VPS_IP>/health/ready
curl.exe -i http://<VPS_IP>/api/auth/request-code
```

Both health endpoints must succeed, and the authentication path must return `403 Forbidden` from Nginx. Do not send a request body, email address, token, or real data.

Track B, required for Android and real users:

```powershell
curl.exe --fail-with-body -i https://api.<DOMAIN>/health/live
curl.exe --fail-with-body -i https://api.<DOMAIN>/health/ready
```

Both must return a successful HTTP status. Do not use `-k` or `--insecure`. After Track B, update the GitHub `API_HEALTH_URL` variable to HTTPS before the next deployment.

#### 8.11 — Copy the verified database backup off the VPS

- [ ] The release script must report the safe filename of the verified **pre-migration** `.bak` export and its `.sha256` file without printing database credentials. From **Windows PowerShell**, copy both files, replacing the placeholder with that exact filename:

```powershell
New-Item -ItemType Directory -Force 'D:\Backups\FrontLine' | Out-Null
scp deploy@<VPS_IP>:/home/deploy/frontline-backup-export/<BACKUP_FILE>.bak 'D:\Backups\FrontLine\'
scp deploy@<VPS_IP>:/home/deploy/frontline-backup-export/<BACKUP_FILE>.bak.sha256 'D:\Backups\FrontLine\'
Get-FileHash -Algorithm SHA256 'D:\Backups\FrontLine\<BACKUP_FILE>.bak'
Get-Content 'D:\Backups\FrontLine\<BACKUP_FILE>.bak.sha256'
```

The two SHA-256 values must match. If they do not, the deployment is not complete; delete only the corrupted Windows copy and transfer it again.

- [ ] After the hashes match, remove the temporary deploy-readable export through the fixed cleanup gateway:

```bash
sudo /usr/local/sbin/frontline-clean-export
```

Do not change permissions on `/var/opt/mssql/backups` and do not leave the exported copy under `/home/deploy`.

Track A smoke-deployment completion conditions:

- The exact CI-tested commit is the target of `/opt/frontline/current`.
- HTTP health checks succeed while HTTP authentication/result routes remain blocked.
- No real credentials, email codes, tokens, personal data, or gameplay data were transmitted.

Additional Track B production/Android completion conditions:

- The exact CI-tested commit is the target of `/opt/frontline/current`.
- Domain HTTPS health checks succeed without bypassing certificate verification, and the GitHub health URL is `https://api.<DOMAIN>/health/ready`.
- Domain HTTP redirects to domain HTTPS, while IP HTTP remains available only for health/non-sensitive smoke requests and continues to block sensitive routes.
- The domain certificate renewal timer and Nginx deploy hook are proven.
- The API, Nginx, and SQL Server are active, while public ports 5000 and 1433 remain closed.
- The verified pre-migration database backup and checksum exist on Windows.
- `deploy` has only the reviewed fixed sudo gateways, and a separate administrator login is proven.
- No application or database secret appears in GitHub, artifacts, logs, command arguments, or shell history.

### Phase 9 — Monitoring, Rollback, and Final Acceptance

- [ ] Optionally monitor `http://<VPS_IP>/health/live` for restricted Track A availability. During Track B, also monitor `https://api.<DOMAIN>/health/live` and add a certificate-expiry alert. The domain monitor is the production signal; do not remove the IP monitor unless Track A is deliberately retired.
- [ ] Keep at least five immutable API release directories.
- [ ] Rehearse binary rollback by repointing `/opt/frontline/current`, restarting the service, and verifying readiness.
- [ ] Rehearse database restore into a separate database; do not overwrite production during the test.
- [ ] Only after Track B succeeds, test from an Android build: login-code delivery, authentication, authenticated API access, match-result save, temporary offline storage, and later synchronization.
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

- [ ] Configure the Android production API base URL as `https://api.<DOMAIN>/api`. Keep the browser target separate: local development uses `http://localhost:5178/api`, while an intentional temporary browser test may use `http://<VPS_IP>/api`. The Android production build must not use HTTP, the raw VPS IP, localhost, a LAN IP, a temporary tunnel, or Capacitor `server.url`.
- [ ] Keep Android cleartext disabled. Do not add `android:usesCleartextTraffic="true"`, Capacitor `server.cleartext`, `android.allowMixedContent`, or certificate-bypass code. Keep `https://localhost` as the Capacitor CORS origin; it is not the API address.
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
- [ ] Test the internal build from Google Play on a physical Android device: install from the Play testing link, request a login code, authenticate, play a match, save a result, go offline, return online, and confirm synchronization through `https://api.<DOMAIN>/api`.
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
- Client endpoint profiles:
  - Local Angular development: `http://localhost:5178/api`.
  - Temporary browser/API Track A: `http://<VPS_IP>/api`; no sensitive requests.
  - Android/production Track B: `https://api.<DOMAIN>/api`.
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
- [ ] **Domain certificate renewal fails:** treat this as urgent. Verify `api.<DOMAIN>` still resolves to `<VPS_IP>`, there is no stale/broken `AAAA` record, public port 80 and the ACME webroot work, system time is correct, and the renewal timer and deploy hook are active. Restore automatic renewal and Nginx reload before expiry, then retest Android trust.
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
- [ ] The Android build authenticates and synchronizes a pending result through trusted `https://api.<DOMAIN>/api` without cleartext or certificate bypasses.
- [ ] Capacitor is installed and the Android project builds a signed release `.aab`.
- [ ] The Play Console app is created with the permanent package ID, Play App Signing, privacy policy, app access instructions, Data Safety, content rating, target audience, and store listing completed.
- [ ] Internal testing installs from Google Play and passes the login, gameplay, offline, and synchronization smoke test.
- [ ] If the account requires closed testing, production access is approved after the required tester period.
- [ ] The first production Play release is manually approved, reviewed by Google Play, and installable from the public listing.

## Assumptions and Accepted Risks

- A new OVH VPS with a stable public IPv4 address is available. Track A uses that IP directly; Track B uses a domain you control. If the IP changes, update the DNS `A` record and IP smoke configuration. Android keeps the domain URL and normally needs no rebuild.
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

- ASP.NET Core proxy and forwarded headers: https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer
- .NET application-host and deployment properties: https://learn.microsoft.com/en-us/dotnet/core/project-sdk/msbuild-props
- Nginx reverse proxy module: https://nginx.org/en/docs/http/ngx_http_proxy_module.html
- Nginx request limiting module: https://nginx.org/en/docs/http/ngx_http_limit_req_module.html
- Certbot with Nginx: https://certbot.eff.org/instructions
- Let's Encrypt HTTP-01 challenge: https://letsencrypt.org/docs/challenge-types/
- Let's Encrypt IPv6 validation behavior: https://letsencrypt.org/docs/ipv6-support/
- Nginx request and virtual-server selection: https://nginx.org/en/docs/http/request_processing.html
- Nginx rejected TLS handshakes: https://nginx.org/en/docs/http/ngx_http_ssl_module.html#ssl_reject_handshake
- Certbot renewal hooks: https://eff-certbot.readthedocs.io/en/stable/using.html#renewing-certificates
- Android network security configuration: https://developer.android.com/privacy-and-security/security-config
- Capacitor configuration and security: https://capacitorjs.com/docs/config and https://capacitorjs.com/docs/guides/security
- GitHub Actions deployments and environments: https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments
- GitHub Actions workflow artifacts: https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts
- GitHub Actions secure-use reference: https://docs.github.com/en/actions/reference/security/secure-use
- EF Core migration bundles: https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying
- SQL Server `RESTORE VERIFYONLY`: https://learn.microsoft.com/en-us/sql/t-sql/statements/restore-statements-verifyonly-transact-sql
- Ubuntu 24.04 sudoers argument matching: https://manpages.ubuntu.com/manpages/noble/man5/sudoers.5.html
- Google Play Console account setup: https://support.google.com/googleplay/android-developer/answer/6112435
- Create and set up a Play Console app: https://support.google.com/googleplay/android-developer/answer/9859152
- Play App Signing and upload keys: https://developer.android.com/studio/publish/app-signing
- Internal, closed, and open testing tracks: https://support.google.com/googleplay/android-developer/answer/9845334
- Personal-account testing requirements: https://support.google.com/googleplay/android-developer/answer/14151465
- Data Safety form: https://support.google.com/googleplay/android-developer/answer/10787469
- Target API level requirements: https://support.google.com/googleplay/android-developer/answer/11926878
