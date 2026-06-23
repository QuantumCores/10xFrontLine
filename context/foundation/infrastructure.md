---
project: Front Line
researched_at: 2026-06-21
recommended_platform: OVHcloud VPS
runner_up: Microsoft Azure
context_type: mvp
tech_stack:
  language: C#
  framework: ASP.NET Core
  runtime: .NET 10
  database: SQL Server Express
---

## Recommendation

**Deploy the backend on an OVHcloud VPS.**

The Angular 22 application is packaged as an Android application by Capacitor, so it does not require web hosting. OVHcloud was selected for the ASP.NET Core 10 API and SQL Server Express because the developer already operates OVH VPS instances, wants a low and predictable MVP cost, and explicitly accepted the additional operational work. Azure is the runner-up because it provides the strongest managed .NET and SQL Server fit.

## Platform Comparison

Scores measure agent-operability, not the final user preference. Pass = 2, Partial = 1, Fail = 0. Platforms without a practical ASP.NET Core 10 backend path were filtered from the shortlist.

| Platform | CLI-first | Managed | Agent-readable docs | Stable deploy API | MCP / integration | Total | Backend fit |
|---|---|---|---|---|---|---:|---|
| AWS | Pass | Pass | Pass | Pass | Pass | 10/10 | Exact stack through App Runner container and RDS SQL Server, but comparatively complex and costly |
| Azure | Pass | Pass | Pass | Pass | Pass | 10/10 | Best managed fit through App Service and Azure SQL |
| Railway | Pass | Pass | Pass | Pass | Partial | 9/10 | Native .NET 10 build; no managed SQL Server |
| Render | Partial | Pass | Pass | Pass | Pass | 9/10 | Docker required; no managed SQL Server |
| Cloudflare | Pass | Pass | Pass | Pass | Pass | 10/10 | .NET requires Containers and SQL Server remains external |
| Fly.io | Pass | Partial | Pass | Pass | Partial | 8/10 | Docker-compatible; no managed SQL Server |
| OVHcloud VPS | Partial | Fail | Partial | Partial | Partial | 4/10 | Exact runtime control and lowest familiar cost; application operations are self-managed |
| Vercel | Pass | Pass | Pass | Pass | Pass | Filtered | No supported ASP.NET Core runtime |
| Netlify | Partial | Pass | Pass | Partial | Pass | Filtered | No supported ASP.NET Core runtime |

AWS supports the exact backend through an ECR image on App Runner with RDS SQL Server. It offers excellent APIs and automation, but IAM, VPC networking, container maintenance, and an always-on licensed RDS instance are excessive for this three-week MVP. Its managed remote MCP server was still preview during research; Agent Toolkit for AWS is the newer integration. See [App Runner image services](https://docs.aws.amazon.com/apprunner/latest/dg/service-source-image.html), [App Runner VPC networking](https://docs.aws.amazon.com/apprunner/latest/dg/network-vpc.html), and [RDS for SQL Server](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_SQLServer.html).

Azure runs .NET 10 natively on Linux App Service and supplies managed Azure SQL. Its SQL serverless free allowance can materially reduce MVP cost, although App Service has a continuous cost floor and deployment slots require a higher tier. It is the best fallback if VPS maintenance starts delaying product work. See [App Service .NET configuration](https://learn.microsoft.com/en-us/azure/app-service/configure-language-dotnetcore) and the [Azure SQL free offer](https://learn.microsoft.com/en-us/azure/azure-sql/database/free-offer).

Railway detects the project's `net10.0` target and provides a direct `railway up` workflow, strong logs, Markdown documentation, and a stable API. SQL Server would need a self-managed container or an external Azure SQL database, weakening both managed-operation and co-location goals. Its MCP integration is a work in progress. See [Railway .NET support](https://railpack.com/languages/dotnet/) and [Railway databases](https://docs.railway.com/databases).

Render hosts the API as a Docker web service and provides managed deployment, logs, WebSockets, and rollback APIs. Its managed data products are PostgreSQL and Redis-compatible storage, not SQL Server. See [Render Docker services](https://render.com/docs/docker) and [Render rollbacks](https://render.com/docs/rollbacks).

Cloudflare has excellent CLI, API, documentation, and MCP support, but ASP.NET Core needs Cloudflare Containers and Hyperdrive does not support SQL Server. It adds adaptation without helping this backend-only workload. See [Cloudflare Containers](https://developers.cloudflare.com/containers/) and [Hyperdrive database support](https://developers.cloudflare.com/hyperdrive/reference/supported-databases-and-features/).

Fly.io can run the API in a .NET 10 Linux container and offers deterministic CLI deployments. It has no managed SQL Server, and rollback requires selecting and redeploying an earlier image. Its MCP commands were experimental during research. See [Fly.io .NET support](https://fly.io/docs/languages-and-frameworks/dotnet/) and [Fly.io MCP](https://fly.io/docs/flyctl/mcp/).

OVHcloud VPS supports the exact API runtime, unrestricted background processes, and a co-located SQL Server Express instance. Entry VPS pricing observed in the Polish catalog began around 27.65 PLN/month before VAT. OVH supplies infrastructure snapshots and daily backup options, but it does not supply application deployment, application rollback, OS patching, or database-aware backup. See the [OVHcloud VPS offering](https://www.ovhcloud.com/en/vps/), [OVHcloud CLI](https://github.com/ovh/ovhcloud-cli), and [VPS snapshot restore](https://github.com/ovh/ovhcloud-cli/blob/main/doc/ovhcloud_vps_snapshot_restore.md).

Vercel and Netlify were removed because the Android application does not need web hosting and neither platform runs the ASP.NET Core API natively.

### Shortlisted Platforms

#### 1. OVHcloud VPS (Selected)

OVHcloud wins by explicit user choice, existing operational familiarity, predictable low cost, and full control of .NET 10 and SQL Server Express. This choice deliberately accepts a lower managed-platform score.

#### 2. Microsoft Azure

Azure is the strongest managed alternative. App Service plus Azure SQL removes most server and database maintenance and should be selected if manual operations threaten the MVP deadline.

#### 3. AWS

AWS provides work-relevant learning and an exact managed architecture through App Runner and RDS SQL Server. It ranks below Azure for this MVP because VPC/IAM setup and RDS cost add complexity without a product requirement that needs AWS.

## Anti-Bias Cross-Check: OVHcloud VPS

### Devil's Advocate — Weaknesses

1. The API and database share one failure domain; a VPS outage, full disk, bad upgrade, or memory exhaustion can take down both.
2. SQL Server competes with ASP.NET Core and the OS for limited RAM and I/O. An undersized VPS can become unreliable even at low request volume.
3. OVH snapshots are not a substitute for transaction-consistent SQL Server backups. A crash-consistent snapshot can restore an unusable or stale database.
4. TLS renewal, firewall policy, OS and SQL patching, monitoring, deployment scripts, and restore testing are developer responsibilities.
5. Reverting a versioned application release does not undo a database migration; incompatible schema changes can make rollback fail.

### Pre-Mortem — How This Could Fail

Six months after launch, the VPS had become a fragile pet server. The team initially chose a small plan because request volume was low, but SQL Server consumed most available memory and the kernel began terminating the API under load. Automated OS updates restarted services during active play, while an expired or misconfigured certificate prevented result synchronization from Android devices. Deployments copied files over the running release, leaving a mixture of old and new assemblies after one interrupted upload. A later schema migration succeeded, but the new API failed to start; restoring the previous binaries did not restore schema compatibility. Daily VPS backups existed, yet nobody had tested a SQL-aware restore, and the available snapshot was older than expected. Match results were lost during recovery. The monthly infrastructure bill remained low, but manual diagnosis, patching, backup verification, and release repair consumed more time than the managed Azure alternative would have cost.

### Unknown Unknowns

- A Windows Server VPS licence does not include a SQL Server licence; use SQL Server Express or separately license a paid edition.
- SQL Server Express has database size and compute/memory limits that must be checked against future match-history growth.
- Infrastructure snapshots and native SQL backups solve different recovery problems; both need separate retention and restore tests.
- OVH does not provide a platform-native preview environment or atomic application deployment for a VPS.
- The Android client needs a stable HTTPS API hostname and certificate chain; changing the endpoint after publishing requires client configuration planning.

## Operational Story

- **Preview deploys**: There is no OVH-native application preview. Pull requests run build/tests only. Any end-to-end staging environment requires a separate service instance, hostname, and database; do not share production data.
- **Secrets**: Store API secrets in `/etc/frontline/api.env`, owned by root with mode `600`, and load them through the systemd unit's `EnvironmentFile`. Never place secrets in the release directory or repository. Rotate them by updating the file, restarting the service, and invalidating the old credential.
- **Rollback**: Publish each release to `/opt/frontline/releases/<release-id>`, atomically repoint `/opt/frontline/current`, and restart `frontline-api`. This should take under a minute after the scripts exist. Database migrations require a separately tested backward-compatible or restore procedure.
- **Approval**: An agent may build artifacts, run checks, inspect read-only logs, and prepare a release. A human approves the production symlink switch, schema migration, primary-secret rotation, firewall change, SQL restore, snapshot restore, or destructive operation.
- **Logs**: Read the API with `journalctl -u frontline-api --since "1 hour ago" --no-pager`; follow it with `journalctl -u frontline-api -f`. Read proxy errors from `/var/log/nginx/error.log`. Infrastructure state and backup metadata can be inspected through the OVHcloud CLI/API.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| VPS is a single failure domain | Devil's advocate | M | H | Keep tested off-host backups and document rebuild/restore onto a clean VPS |
| API and SQL Server exhaust RAM or disk I/O | Devil's advocate | M | H | Start with measured headroom, enable resource alerts, and resize before sustained pressure |
| Snapshot is not database-consistent | Devil's advocate | H | H | Run scheduled native SQL backups, copy them off-host, and test restoration monthly |
| Interrupted copy creates a mixed release | Pre-mortem | M | H | Upload to a new immutable release directory and switch an atomic symlink only after validation |
| Schema migration prevents application rollback | Devil's advocate | M | H | Use backward-compatible migrations and take a verified SQL backup before each migration |
| OS, runtime, or SQL patches are missed | Pre-mortem | M | H | Establish a monthly patch window with a pre-patch snapshot and post-patch health check |
| TLS expires or Android rejects the certificate | Pre-mortem | L | H | Automate ACME renewal and monitor expiry externally from a second system |
| SQL Server licensing is misunderstood | Unknown unknowns | L | H | Use Express for MVP and document its limits; obtain licensing review before changing edition |
| SQL Server Express limits are exceeded | Unknown unknowns | L | M | Monitor database size and resource use; define Azure SQL migration as the escape path |
| Manual operations consume MVP time | Research finding | M | M | Time-box VPS automation; move to Azure if deployment and recovery are not repeatable within one day |

## Getting Started

1. Provision an OVHcloud Linux VPS in the nearest suitable EU location. Size it for SQL Server rather than request count, restrict inbound traffic to SSH and HTTPS, and create an unprivileged deployment account.
2. Install Nginx, systemd service configuration, and a supported SQL Server Express release. Pin the SQL Server version and follow Microsoft's supported Linux or container procedure; do not rely on an unversioned database image.
3. Produce the exact .NET 10 artifact from the repository root: `dotnet publish src/api/frontLineApi.csproj -c Release -r linux-x64 --self-contained true -o artifacts/api`.
4. Upload the artifact into a new `/opt/frontline/releases/<release-id>` directory, validate configuration and database connectivity, atomically update `/opt/frontline/current`, then run `systemctl restart frontline-api` and inspect `journalctl -u frontline-api`.
5. Before accepting users, automate native SQL backups to off-host storage, test a full restore, enable external HTTPS/expiry monitoring, and write the release/rollback commands as a repeatable script.

## Out of Scope

The following were not evaluated or implemented in this research:

- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture such as multi-region availability, HA, or disaster-recovery orchestration
- Google Play release and Android signing
