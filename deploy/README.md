# Deployment (Docker + plain Kubernetes manifests)

Deployed services: `web`, `gateway`, `catalog`, `ordering`. AppHost is local-only and not deployed.
K8s Service names equal the Aspire resource names, and consumers get Aspire-style discovery env vars
(`services__catalog__http__0=http://catalog`, etc.) so `https+http://<name>` addresses resolve unchanged.

## Build images (context = repo root)

```bash
docker build -f deploy/Dockerfile.catalog  -t ecommerce/catalog:local  .
docker build -f deploy/Dockerfile.ordering -t ecommerce/ordering:local .
docker build -f deploy/Dockerfile.gateway  -t ecommerce/gateway:local  .
docker build -f deploy/Dockerfile.web      -t ecommerce/web:local      .
```

## Run on Docker Desktop Kubernetes

Enable Kubernetes in Docker Desktop; local images are visible to the cluster (deployments use `imagePullPolicy: IfNotPresent`).
For kind/minikube, load them (`kind load docker-image ...` / `minikube image load ...`).

```bash
kubectl kustomize deploy/k8s                      # render only
kubectl apply --dry-run=client -k deploy/k8s      # validate
kubectl apply -k deploy/k8s                       # deploy (only when you decide to)
kubectl -n ecommerce get pods
kubectl -n ecommerce port-forward svc/web 8080:80 # then http://localhost:8080
```

`ingress.yaml` (host `ecommerce.localhost`, class `nginx`) needs an ingress controller; otherwise use port-forward.

## Notes

- ServiceDefaults maps `/health` and `/alive` only when `ASPNETCORE_ENVIRONMENT=Development`, so the manifests set it.
  For production, change `MapDefaultEndpoints()` to expose them outside Development and set `Production`.
- Catalog and Ordering use an in-memory EF database: keep `replicas: 1`; data is lost on restart.
- Containers run as non-root (UID 64198), read-only root filesystem, `/tmp` emptyDir, all capabilities dropped; HTTP only on 8080 (TLS terminates at the ingress).
