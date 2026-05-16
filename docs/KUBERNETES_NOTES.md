# Kubernetes Deployment Notes

> **Warning:** This is a draft/future plan. Not implemented yet. Do not deploy to Kubernetes based on this document.

This document outlines the approach for deploying TOGI to Kubernetes. It serves as a planning reference and should be updated as implementation progresses.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Kubernetes Cluster                         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   togi-api   │  │   togi-api   │  │   togi-api   │          │
│  │   (deploy)   │  │   (deploy)   │  │   (deploy)   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                │                │                    │
│  ┌──────┴────────────────┴────────────────┴───────┐             │
│  │              Service: togi-api-svc             │             │
│  │           (type: LoadBalancer)                 │             │
│  └─────────────────────────┬─────────────────────┘             │
│                            │                                    │
│  ┌─────────────────────────┴─────────────────────┐             │
│  │              Ingress (Telegram webhook)        │             │
│  └─────────────────────────────────────────────────┘             │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ togi-worker  │  │ togi-worker  │  │ togi-worker  │         │
│  │   (deploy)   │  │   (deploy)   │  │   (deploy)   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  ┌────────────────────────────────────────────────┐             │
│  │              Service: togi-worker-svc          │             │
│  └────────────────────────────────────────────────┘             │
│                                                                 │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐                │
│  │postgres│  │ redis  │  │pgbounce│  │metrics │                │
│  │(statef)│  │(statef)│  │(statef)│  │(statef)│                │
│  └────────┘  └────────┘  └────────┘  └────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Deployment Manifests

### API Deployment

```yaml
# k8s/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: togi-api
  namespace: togi
spec:
  replicas: 3
  selector:
    matchLabels:
      app: togi-api
  template:
    metadata:
      labels:
        app: togi-api
    spec:
      containers:
        - name: api
          image: togi-api:latest
          ports:
            - containerPort: 4310
          env:
            - name: API_PORT
              value: "4310"
            - name: POSTGRES_HOST
              value: "pgbouncer"
            - name: POSTGRES_PORT
              value: "5432"
            - name: REDIS_HOST
              value: "redis"
            - name: REDIS_PORT
              value: "6379"
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          readinessProbe:
            httpGet:
              path: /ready
              port: 4310
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 4310
            initialDelaySeconds: 30
            periodSeconds: 10
```

### Worker Deployment

```yaml
# k8s/worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: togi-worker
  namespace: togi
spec:
  replicas: 2
  selector:
    matchLabels:
      app: togi-worker
  template:
    metadata:
      labels:
        app: togi-worker
    spec:
      containers:
        - name: worker
          image: togi-worker:latest
          ports:
            - containerPort: 4390
          env:
            - name: WORKER_METRICS_PORT
              value: "4390"
            - name: POSTGRES_HOST
              value: "postgres"
            - name: REDIS_HOST
              value: "redis"
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 1Gi
```

### Horizontal Pod Autoscaler

```yaml
# k8s/api-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: togi-api-hpa
  namespace: togi
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: togi-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

---

## Services

### API Service

```yaml
# k8s/api-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: togi-api-svc
  namespace: togi
spec:
  type: LoadBalancer
  selector:
    app: togi-api
  ports:
    - port: 4310
      targetPort: 4310
```

### Worker Metrics Service

```yaml
# k8s/worker-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: togi-worker-svc
  namespace: togi
spec:
  type: ClusterIP
  selector:
    app: togi-worker
  ports:
    - port: 4390
      targetPort: 4390
```

---

## ConfigMap

```yaml
# k8s/config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: togi-config
  namespace: togi
data:
  NODE_ENV: "production"
  API_PORT: "4310"
  REDIS_DEGRADED_MODE: "fail_open"
  DB_DEGRADED_MODE: "fail_closed"
  # Queue concurrency settings
  ASYNC_ANALYSIS_CONCURRENCY: "5"
  AUDIT_EVENTS_CONCURRENCY: "10"
  REPORT_GENERATION_CONCURRENCY: "2"
```

---

## Secrets

```yaml
# k8s/secrets.yaml (use sealed-secrets or external secrets operator in production)
apiVersion: v1
kind: Secret
metadata:
  name: togi-secrets
  namespace: togi
type: Opaque
stringData:
  POSTGRES_PASSWORD: "change-me"
  REDIS_PASSWORD: "change-me"
  TELEGRAM_BOT_TOKEN: "change-me"
  TELEGRAM_WEBHOOK_SECRET: "change-me"
  JWT_SECRET: "change-me-at-least-32-chars"
```

---

## Namespace

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: togi
```

---

## TODO Checklist

- [ ] Create Helm chart for TOGI
- [ ] Add PostgreSQL external database support (currently assumes in-cluster)
- [ ] Add Redis Cluster support
- [ ] Configure sealed-secrets for secret management
- [ ] Add ingress for webhook endpoint
- [ ] Add metrics scraping with Prometheus operator
- [ ] Add Grafana dashboard
- [ ] Test HPA scaling under load
- [ ] Add pod disruption budget
- [ ] Add network policies
- [ ] Test rolling deployment
- [ ] Document GitOps workflow (ArgoCD or Flux)

---

## Load Testing Before Production

Before deploying to Kubernetes, validate:

1. **API throughput:** 500 req/s normal, 1000 req/s peak
2. **Webhook latency:** < 50ms p50, < 120ms p95
3. **Queue processing:** No backlog growth under peak load
4. **HPA scaling:** Verify scale-out happens before queue backlog grows

---

## Useful Commands

```bash
# Check API pods
kubectl get pods -n togi -l app=togi-api

# Check worker pods
kubectl get pods -n togi -l app=togi-worker

# View API logs
kubectl logs -n togi -l app=togi-api --tail=100 -f

# Check HPA status
kubectl get hpa -n togi

# Scale API manually
kubectl scale deployment togi-api -n togi --replicas=5

# Port forward for local testing
kubectl port-forward -n togi svc/togi-api-svc 4310:4310
```

---

## External Services

For production, consider:

| Service | Purpose | Alternative |
|---------|---------|-------------|
| Cloud SQL (PostgreSQL) | Managed DB | Self-hosted with pgBouncer |
| Memorystore (Redis) | Managed Redis | Self-hosted Redis Cluster |
| Cloud Load Balancer | Expose API | MetalLB + Ingress |
| Cloud Managed Prometheus | Metrics | Self-hosted Prometheus |
| ArgoCD | GitOps | Flux |

---

## Migration Path

1. **Phase 1:** Deploy to Kubernetes with Docker Compose migration (keep same architecture)
2. **Phase 2:** Move to managed services (Cloud SQL, Memorystore)
3. **Phase 3:** Add GitOps workflow
4. **Phase 4:** Add multi-region deployment