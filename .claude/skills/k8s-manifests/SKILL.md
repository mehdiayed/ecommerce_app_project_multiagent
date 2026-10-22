---
name: k8s-manifests
description: Create or update Dockerfiles and plain Kubernetes manifests for the Aspire services (web, gateway, catalog, ordering) under deploy/. Use for any feature that adds or changes a service, endpoint, port, env var or dependency, and whenever deploy/ is missing.
---

# Dockerfiles and K8s manifests — project conventions

Complements the generic `kubernetes-skill` (hardening, API drift). Read that one too.

## First, check what exists
Glob `deploy/**`, `**/Dockerfile*`, `**/Chart.yaml`. If nothing exists, create everything below; "no artifacts" is never a valid `DEPLOY: READY`. If a feature adds no service/endpoint/env var, say "no infra change needed" and still confirm the existing manifests match the code.

## Layout (plain manifests, no Helm unless asked)
```
deploy/Dockerfile.<svc>        one per service: web, gateway, catalog, ordering
deploy/k8s/namespace.yaml      namespace ecommerce, PSA restricted
deploy/k8s/<svc>.yaml          Deployment + ClusterIP Service
deploy/k8s/ingress.yaml        web only (nginx, host ecommerce.localhost)
deploy/k8s/kustomization.yaml  ties everything, namespace ecommerce
deploy/README.md               build, load, apply, port-forward
.dockerignore                  bin/ obj/ .git logs
```
AppHost and ServiceDefaults are never deployed (ServiceDefaults is copied into each build).

## Dockerfile rules
- Multi-stage: `mcr.microsoft.com/dotnet/sdk:10.0` build, `aspnet:10.0` runtime. Build context = repo root; copy csproj files first for restore caching, then sources; `dotnet publish -c Release -o /app /p:UseAppHost=false`.
- Run as non-root (`USER 64198`), `ASPNETCORE_URLS=http://+:8080`, `EXPOSE 8080`.
- Blazor Server (web): after building, the image must contain `/app/wwwroot/_framework/blazor.web.js`. Do not use `--no-restore` on the publish (an image built that way lacked it). Check: `MSYS_NO_PATHCONV=1 docker run --rm --entrypoint ls <image> /app/wwwroot`.
- A new service needs its own Dockerfile, manifest, kustomization entry, and a Gateway route + cluster in `appsettings.json` (see CLAUDE.md).

## Manifest rules
- Service names are exactly the Aspire resource names (`web`, `gateway`, `catalog`, `ordering`) so `https+http://<name>` works. Service port 80 -> targetPort 8080.
- Service discovery env vars on consumers: `services__<name>__http__0=http://<name>` (Web -> gateway; Gateway -> catalog, ordering; Ordering -> catalog). Add one whenever a feature adds a service-to-service call.
- Probes: startup + liveness `/alive`, readiness `/health`. `MapDefaultEndpoints()` only maps them in Development, so Deployments set `ASPNETCORE_ENVIRONMENT=Development` (documented trade-off) unless `Extensions.cs` was changed.
- Resources: requests and limits on every container.
- securityContext: `runAsNonRoot`, `readOnlyRootFilesystem`, drop ALL capabilities, no privilege escalation, `seccompProfile: RuntimeDefault`; `/tmp` as emptyDir; no service-account token.
- Catalog and Ordering use an in-memory DB: 1 replica, data lost on restart. Say it again if a feature adds persistence.
- Images: tag every build uniquely (e.g. `ecommerce/web:v2`), never rely on `:local` + `IfNotPresent` — the node keeps the old image. Update the tag in the manifest (or `kustomize edit set image`) so `kubectl apply -k` and the cluster agree.

## Validate (never apply without the user's confirmation)
1. `docker build -f deploy/Dockerfile.<svc> -t ecommerce/<svc>:<tag> .` for each changed service.
2. `kubectl kustomize deploy/k8s` renders; then `kubectl apply --dry-run=client -k deploy/k8s`. If the API server is unreachable, say the dry-run was not run.
3. Hand over to `deploy-verify` for the real rollout and smoke test.
