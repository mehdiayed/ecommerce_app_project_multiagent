# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

.NET 10 microservices e-commerce demo orchestrated with .NET Aspire. All projects live under `src/`. There is no solution file, one test project (`src/ECommerce.Web.Tests`, xUnit, covers the Web product filter; not referenced by AppHost), and no `.gitignore` (so `obj/`/`bin/` show up as untracked — don't commit them).

## Commands

```bash
dotnet run --project src/ECommerce.AppHost        # starts every service + Aspire dashboard (URL with login token printed in console)
dotnet build src/ECommerce.AppHost                # builds AppHost and all referenced projects
dotnet run --project src/ECommerce.Catalog.Api    # run a single service standalone (note: Ordering/Gateway/Web need AppHost for service discovery)
```

## Architecture

Request flow: `Web (Blazor Server) → Gateway (YARP) → { Catalog, Ordering }`, and `Ordering → Catalog` (synchronous HTTP).

- **ECommerce.AppHost** — Aspire orchestrator (`AppHost.cs`). Defines the graph with `WithReference`/`WaitFor`. The resource name string (`"catalog"`, `"ordering"`, `"gateway"`) *is* the hostname used by service discovery, so renaming a resource requires updating every `https+http://<name>` address (Web `Program.cs`, Ordering `Program.cs`, Gateway `appsettings.json` clusters).
- **ECommerce.ServiceDefaults** — shared project referenced by every service; `AddServiceDefaults()` wires telemetry, health checks (`MapDefaultEndpoints()` → `/health`, `/alive`), standard resilience, and service discovery. Every new service must call both.
- **ECommerce.Gateway** — YARP reverse proxy configured entirely in `appsettings.json` (`ReverseProxy` section). Routes `/catalog/**` and `/ordering/**` and strips the prefix via `PathRemovePrefix`; destinations are resolved through `AddServiceDiscoveryDestinationResolver()`. New backend services need a route + cluster here.
- **ECommerce.Catalog.Api / ECommerce.Ordering.Api** — minimal APIs; endpoints are in `Endpoints/*Endpoints.cs` as `Map*Endpoints()` extension methods (under `/api/products`, `/api/orders`). Each uses EF Core **InMemory** database (data is lost on restart), created/seeded at startup via `EnsureCreated()` (Catalog seed lives in `CatalogDbContext`). Ordering serializes enums as strings.
- **Ordering → Catalog** — `Services/CatalogServiceClient.cs` is a typed `HttpClient` (`https+http://catalog`); order creation validates each product synchronously and snapshots name/price into `OrderItem`.
- **ECommerce.Web** — Blazor Server (interactive server render mode). Pages in `Components/Pages`; typed clients `CatalogApiClient`/`OrderingApiClient` in `Services/` both point at `https+http://gateway`, so paths must include the gateway prefix (`/catalog/...`, `/ordering/...`).

Each project has its own `README.md` with more detail.

## Multi-agent workflow (Markdown only)

7 sub-agents live in `.claude/agents/*.md` (orchestrator, monitoring, migration, codescan, qa, devops, docs) and 8 slash commands in `.claude/commands/*.md`. Sub-agents cannot call each other, so `/orchestrate <feature>` makes the main session run the loops (Migration ⇄ Code Scan, QA → Migration, then DevOps dry-run → Docs & Sync), print a status matrix and log to the git-ignored `logs/`. The usage guide with prompts is `docs/TECHNICAL.md`; third-party skills install via `scripts/install-skills.sh|ps1`, and three project skills live in `.claude/skills/` (`csharp-unit-test`, `k8s-manifests`, `deploy-verify`) — they record the lessons learned (no vacuous `DEPLOY: READY`, Blazor `_framework/blazor.web.js` check, unique image tags, smoke tests) and must be updated when a feature teaches a new one; Dockerfiles/manifests are in `deploy/`. When editing agent or command files, keep the verdict formats (`VERDICT: OK|KO`, `QA RESULT: PASS|FAIL`, `DEPLOY: READY|BLOCKED`) — `orchestrate.md` depends on them. The README block between `docs:sync` markers is maintained by the `docs` agent.
