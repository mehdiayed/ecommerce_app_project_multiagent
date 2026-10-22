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

## Multi-agent pipeline (repo root, Node.js, no dependencies)

Separate from the .NET app: `npm start` (`node orchestrator/cli.js run`) runs 6 agents (`agents/`) over an event bus (`orchestrator/event-bus.js`). Agents emit `hook:*` events whose handlers live in `hooks/` and are bound by `config/agents.json` via `orchestrator/hook-registry.js` — the loops (Migration⇄Code Scan, QA→Migration) are implemented in those hook files, not in the agents. Default `mode: simulate` (`config/pipeline.json`) fakes work; `--mode=real` runs the shell commands listed there. Test the loops with `--fast --fail-scan=N --fail-qa=N`. Output goes to gitignored `logs/` (`events.jsonl`, `status.json`, `report.md`). See README.md.
