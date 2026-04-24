#!/bin/bash
set -e

IMAGE_NAME="ghcr.io/holgerengels/synx"
TAG="latest"

cd "$(dirname "$0")/.."

echo "Building docker image..."
docker build -f deploy/app.docker -t "$IMAGE_NAME:$TAG" .

echo "Pushing to registry..."
docker push "$IMAGE_NAME:$TAG"

echo "Done."
