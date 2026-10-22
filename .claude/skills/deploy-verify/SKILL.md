---
name: deploy-verify
description: Roll out the app to the local Docker Desktop Kubernetes cluster and verify it really works (Blazor interactivity, inter-service calls), not just that pods are Running. Use after the user confirms a deployment, after every rebuild, and when "the page loads but nothing works".
---

# Deploy and verify on Kubernetes

Only after `k8s-manifests` validation and the user's explicit confirmation to apply. Pod `Running` and HTTP 200 are not proof of success.

## Rollout
1. Build with a **new tag** per rebuild (`docker build -f deploy/Dockerfile.<svc> -t ecommerce/<svc>:<tag> .`). Reusing `:local` with `IfNotPresent` redeploys the node's cached old image, even after `rollout restart`.
2. Point the manifest at the tag, then `kubectl apply -k deploy/k8s` (or `kubectl set image` for a quick test, and then fix the manifest so it does not drift).
3. `kubectl rollout status -n ecommerce deploy/<svc>` and `kubectl wait --for=condition=ready pod --all -n ecommerce --timeout=120s`.
4. Confirm the pod runs the new image: `kubectl get pod -n ecommerce -l app.kubernetes.io/name=<svc> -o jsonpath='{..imageID}'` or `MSYS_NO_PATHCONV=1 kubectl exec -n ecommerce deploy/<svc> -- ls /app/...`.

## Smoke test (all must pass)
1. `kubectl port-forward -n ecommerce svc/web 8080:80` in the background. It dies when the pod is replaced: restart it after every rollout and wait until it answers.
2. `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/_framework/blazor.web.js` must be `200`. A 404 means the page renders but is never interactive.
3. Drive the page in a real browser (Playwright from the scratchpad, or the `playwright` skill): capture console errors, failed requests and HTTP >= 400; confirm the `_blazor` WebSocket connects ("WebSocket connected"); perform the feature action (type, click) and assert the DOM changes.
4. Chain check: `kubectl logs -n ecommerce deploy/web|gateway|catalog|ordering --tail=30` shows 200s for Web -> Gateway -> Catalog/Ordering; run the feature's end-to-end journey (e.g. add to cart, place order) through the forwarded URL.
5. `kubectl get pods -n ecommerce` all `1/1 Running`, 0 unexpected restarts.

## Troubleshooting map
- Page loads, buttons/search do nothing -> `blazor.web.js` 404 -> image missing `_framework` (see `k8s-manifests` Dockerfile rules) or stale image.
- Rolled out but behaviour unchanged -> cached image tag; use a new tag.
- Probes failing with 404 on `/health` -> app not in Development (see `k8s-manifests`).
- `kubectl exec ... ls /app` fails with a `C:/Program Files/Git/...` path -> prefix `MSYS_NO_PATHCONV=1` (Git Bash).
- Not visible in Docker Desktop containers -> look under the Kubernetes tab / Images; pods are inside the cluster.
- `kubectl apply --dry-run=client` fails to reach the API -> enable Kubernetes in Docker Desktop.

## Report
List: tag deployed, pod status, each smoke-test step with result, and what was not tested. Then `DEPLOY: READY` or `DEPLOY: BLOCKED <reason>`. Never push images or apply to a non-local cluster without confirmation.
