# LEX | Kozmetické štúdio – web

Web štúdia Beauty by Lex (Stupava) s online rezerváciou napojenou na [Booqme](https://booqme.app/sk/rezervacia/beauty-by-lex).

## Spustenie

Stačí Node.js 22.13+ (používa vstavaný `node:sqlite`, žiadne závislosti).

```sh
ADMIN_TOKEN=tajneheslo STUDIO_PHONE="+421 903 xxx xxx" npm start
# http://localhost:3000        – web
# http://localhost:3000/admin  – správa rezervácií
```

### Docker

```sh
docker compose up -d --build                 # http://localhost:3090
HOST_PORT=4000 docker compose up -d          # iný port na hostiteľovi
```

Databáza je vo volume `lexbeauty-data`, takže prežije reštart aj nový build.

### Produkcia – https://lexbeauty.pidiman.sk

Beží na `oracle-free-1` v `~/docker/lexbeauty` za Caddy (`~/docker/proxy/Caddyfile`, blok `lexbeauty.pidiman.sk`).
Každý push do `main` sa nasadí automaticky (`.github/workflows/deploy.yml`): GitHub Actions sa pripojí
do Tailscale a cez SSH spustí na serveri `deploy.sh`, ktorý stiahne posledný commit a prebuduje kontajner
(`docker-compose.prod.yml`: sieť `web`, port `127.0.0.1:8093`). Ručne: `ssh oracle-free-1 ~/docker/lexbeauty/deploy.sh`.

Secrets repozitára: `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`, `DEPLOY_SSH_KEY` (kľúč s `command=` obmedzeným
na `deploy.sh`), `DEPLOY_KNOWN_HOSTS`, `DEPLOY_HOST` (Tailscale IP servera), `DEPLOY_USER`.
`ADMIN_TOKEN` je v `~/docker/lexbeauty/.env` na serveri – pri prvom nasadení sa vygeneroval.

| Premenná | Popis |
|---|---|
| `PORT` | port servera (predvolene 3000) |
| `ADMIN_TOKEN` | heslo do `/admin`; bez neho sa pri štarte vygeneruje dočasné a vypíše do konzoly |
| `STUDIO_PHONE` | telefón zobrazený v kontakte |
| `DB_PATH` | cesta k SQLite databáze (predvolene `data/lexbeauty.db`) |

## Ako to funguje

- **Synchronizácia s Booqme** (`src/booqme.js`) – pri štarte a každých 30 min sa z verejného rezervačného formulára načítajú služby, ceny, dĺžky a voľné dni a uložia sa do DB. Voľné časy pre konkrétny deň sa načítavajú živo (cache 5 min). Ručne: `npm run sync`.
- **Databáza** (`src/db.js`) – tabuľky `services`, `available_dates`, `slots`, `bookings`, `sync_log`.
- **Rezervácia** – klient vyberie službu → deň → čas → vyplní údaje. Server pred uložením overí v Booqme, že termín je stále voľný, a uloží rezerváciu do tabuľky `bookings` so stavom `nova`. Rezervácia sa **nezapisuje automaticky do Booqme** – štúdio ju potvrdí v `/admin` (a zapíše do svojho kalendára).
- **Obsah** – texty ošetrení sú v `src/content.js`, fotky v `public/img/`.
