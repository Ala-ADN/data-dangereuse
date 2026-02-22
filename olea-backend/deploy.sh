#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# deploy.sh — Pull latest image and restart services on VPS
# Usage: bash deploy.sh <image_tag>
# ──────────────────────────────────────────────────────────────
set -euo pipefail

IMAGE_TAG="${1:?Usage: deploy.sh <image_tag>}"
COMPOSE_FILE="docker-compose.prod.yml"

echo "═══════════════════════════════════════════════"
echo "  OLEA Insurance — Deploying $IMAGE_TAG"
echo "═══════════════════════════════════════════════"

# Pull latest image
echo "⬇  Pulling image..."
docker pull "$IMAGE_TAG"

# Tag as expected by compose
docker tag "$IMAGE_TAG" olea-backend:latest

# Stop existing containers (graceful)
echo "🔄 Restarting services..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans --timeout 15 || true

# Start fresh
docker compose -f "$COMPOSE_FILE" up -d

# Wait for health check
echo "⏳ Waiting for health check..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ API is healthy!"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "❌ Health check failed after 30s"
    docker compose -f "$COMPOSE_FILE" logs --tail=50
    exit 1
  fi
  sleep 1
done

# Prune old images
echo "🧹 Pruning dangling images..."
docker image prune -f

echo "═══════════════════════════════════════════════"
echo "  ✅ Deployment complete!"
echo "═══════════════════════════════════════════════"
