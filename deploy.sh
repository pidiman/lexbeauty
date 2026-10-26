#!/bin/sh
# Nasadenie z lokálneho počítača na oracle-free-1: skopíruje projekt, prebuduje a reštartuje kontajner.
set -eu
cd "$(dirname "$0")"

HOST=${DEPLOY_HOST:-oracle-free-1}
DIR=docker/lexbeauty

rsync -az --delete \
  --exclude .git --exclude node_modules --exclude data --exclude .env --exclude .DS_Store \
  ./ "$HOST:$DIR/"

ssh "$HOST" "cd $DIR && sh -eu" <<'EOF'
if [ ! -f .env ]; then
  echo "ADMIN_TOKEN=$(openssl rand -hex 16)" > .env
  chmod 600 .env
  echo "Vytvorený .env s novým ADMIN_TOKEN (cat ~/docker/lexbeauty/.env)"
fi
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --remove-orphans
docker image prune -f >/dev/null
for i in $(seq 1 30); do
  if curl -fs -o /dev/null http://127.0.0.1:8093/api/services; then
    echo "Nasadené"
    exit 0
  fi
  sleep 2
done
echo "Web po nasadení neodpovedá" >&2
docker compose logs --tail=50 web >&2
exit 1
EOF
