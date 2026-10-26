#!/bin/sh
# Nasadenie na serveri: stiahne posledný commit, prebuduje a reštartuje kontajner.
# Spúšťa ho GitHub Actions cez SSH (.github/workflows/deploy.yml), dá sa spustiť aj ručne:
#   ssh oracle-free-1 ~/docker/lexbeauty/deploy.sh
set -eu
cd "$(dirname "$0")"

git fetch --quiet origin main
git reset --hard origin/main

if [ ! -f .env ]; then
  echo "ADMIN_TOKEN=$(openssl rand -hex 16)" > .env
  chmod 600 .env
  echo "Vytvorený .env s novým ADMIN_TOKEN"
fi

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --remove-orphans
docker image prune -f >/dev/null

# počkať, kým web odpovedá
for i in $(seq 1 30); do
  if curl -fs -o /dev/null http://127.0.0.1:8093/api/services; then
    echo "Nasadené: $(git log -1 --format='%h %s')"
    exit 0
  fi
  sleep 2
done
echo "Web po nasadení neodpovedá" >&2
docker compose logs --tail=50 web >&2
exit 1
