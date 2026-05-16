#!/bin/bash
set -e

echo "Building Docker images..."

echo "Building API..."
docker build -f apps/api/Dockerfile --target runner -t togi-api:latest .

echo "Building Worker..."
docker build -f apps/worker/Dockerfile --target runner -t togi-worker:latest .

echo "Building Web..."
docker build -f apps/web/Dockerfile --target runner -t togi-web:latest .

echo "All images built successfully"