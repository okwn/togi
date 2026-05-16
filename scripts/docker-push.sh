#!/bin/bash
set -e

REGISTRY=${REGISTRY:-ghcr.io}
IMAGE_PREFIX=${IMAGE_PREFIX:-${{ github.repository }}/}

echo "Pushing Docker images..."

docker push $REGISTRY/$IMAGE_PREFIX/togi-api:latest
docker push $REGISTRY/$IMAGE_PREFIX/togi-worker:latest
docker push $REGISTRY/$IMAGE_PREFIX/togi-web:latest

echo "All images pushed successfully"