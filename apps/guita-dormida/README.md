# guita-dormida

Detector de capital ocioso sobre Wallbit. Corre manualmente (o como cron) y
reporta por Telegram cuánta plata tenés quieta y cuánto estás dejando de ganar.

## Qué hace

1. Lee saldo de checking, posiciones de inversión y wallets cripto.
2. Calcula un colchón dinámico a partir de tu gasto mensual real.
3. Detecta tres tipos de capital ocioso:
   - Checking con saldo muy por encima del colchón.
   - Wallets USDT/USDC sin movimiento reciente.
   - Posiciones de renta fija rindiendo por debajo de lo esperado.
4. Te manda un resumen accionable por Telegram.

No ejecuta trades. La acción la tomás vos manualmente desde el dashboard de Wallbit.

## Setup

### 1. Crear un bot de Telegram

1. En Telegram abrí [@BotFather](https://t.me/BotFather).
2. Mandá `/newbot` y seguí los pasos.
3. Copiá el token que te da (tiene formato `123456789:AAAA...`). Ese es
   `TELEGRAM_BOT_TOKEN`.

### 2. Obtener tu chat_id

1. Mandale un mensaje cualquiera al bot que creaste (por ejemplo `hola`).
2. Desde tu terminal:

   ```bash
   curl "https://api.telegram.org/bot<TU_TOKEN>/getUpdates"
   ```
3. En la respuesta JSON, buscá `message.chat.id`. Ese número es tu
   `TELEGRAM_CHAT_ID`.

### 3. Generar la API key en Wallbit

1. Entrá a tu dashboard de Wallbit → Settings → API Keys.
2. Generá una key con scope `read` (alcanza para esta app — no escribe).
3. Copiala. Ese valor es `WALLBIT_API_KEY`.

### 4. Configurar el `.env`

```bash
cp .env.example .env
# Editá .env y completá las tres variables requeridas.
```

El default es `DRY_RUN=true` para que tu primer run no mande un mensaje real.

### 5. Primer dry run

Desde la raíz del monorepo:

```bash
pnpm --filter @wallbit-lab/app-guita-dormida analyze:dry
```

Eso imprime el reporte en la consola sin tocar Telegram.

### 6. Correr de verdad

Cuando estés conforme, poné `DRY_RUN=false` en `.env` y corré:

```bash
pnpm --filter @wallbit-lab/app-guita-dormida analyze
```

### 7. Cron diario (opción A: tu máquina)

Para que corra solo a las 9:00 am cada día, agregá a tu `crontab -e`:

```cron
0 9 * * * cd /ruta/a/wallbit-lab && pnpm --filter @wallbit-lab/app-guita-dormida analyze >> /tmp/guita-dormida.log 2>&1
```

### 7. Cron diario (opción B: Vercel)

La app está preparada para correr como Serverless Function + Vercel Cron. El endpoint
`api/analyze.ts` expone la misma lógica por HTTP y `vercel.json` declara el cron
diario a las 12:00 UTC (= 9:00 ART, UTC-3).

#### Deploy inicial

1. Pusheá el repo a GitHub.
2. En [vercel.com](https://vercel.com) → **Add New... → Project** → importá el repo.
3. En la pantalla de configuración del proyecto, poné:
   - **Root Directory:** `apps/guita-dormida`
   - **Framework Preset:** Other
   - Dejá los overrides de build/install como están: `vercel.json` ya los define.
4. En **Environment Variables** cargá (marcá todas como Production):

   ```
   WALLBIT_API_KEY            = <tu key>
   TELEGRAM_BOT_TOKEN         = <tu token>
   TELEGRAM_CHAT_ID           = <tu chat id>
   ANALYSIS_DAYS              = 30
   IDLE_THRESHOLD_USD         = 500
   CHECKING_BUFFER_MULTIPLIER = 1.5
   DRY_RUN                    = true
   CRON_SECRET                = <string random largo, generalo con `openssl rand -hex 32`>
   ```

   Dejá `DRY_RUN=true` hasta confirmar que los primeros runs se ven bien en los
   logs. Cuando estés conforme, cambialo a `false` y redeployá (o editá la env
   var en el dashboard).

5. **Deploy.** Vercel va a correr `pnpm turbo build --filter=@wallbit-lab/app-guita-dormida`
   (que a su vez compila todos los packages del workspace que dependen).

#### Verificar

Una vez deployado, probá el endpoint manualmente:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" \
  https://<tu-proyecto>.vercel.app/api/analyze
```

Respuesta esperada (con `DRY_RUN=true`):

```json
{
  "ok": true,
  "dryRun": true,
  "analyzedAt": "2026-04-23T12:00:00.000Z",
  "totalIdleUSD": 0,
  "totalOpportunityCost": 0,
  "hasIdle": false,
  "idleAssetCount": 0
}
```

Sin el header `Authorization` correcto el endpoint devuelve 401. Si no seteás
`CRON_SECRET`, el endpoint queda público — no hacelo.

#### Cambiar el horario

Editá el cron en [vercel.json](./vercel.json). El formato es estándar (UTC).
Ejemplos:
- `0 12 * * *` → todos los días a las 12:00 UTC (9:00 ART).
- `0 12 * * 1-5` → sólo días hábiles.
- `0 */6 * * *` → cada 6 horas.

Commiteá y pusheá; Vercel redeploya y re-registra la cron.

#### Límites de plan

- **Hobby:** timeout 10s por función, crons granularidad diaria. Alcanza para esta
  app (el análisis tarda ~3-5 segundos con 3 endpoints de Wallbit + Telegram).
- **Pro:** timeout 60s (hasta 300s con `maxDuration`), crons intra-día.

Si hace falta más tiempo, agregá a `vercel.json`:

```json
"functions": { "api/analyze.ts": { "maxDuration": 60 } }
```

(requiere plan Pro o superior).

## Config disponible

| Variable                      | Default                     | Para qué                                                     |
| ----------------------------- | --------------------------- | ------------------------------------------------------------ |
| `WALLBIT_API_KEY`             | (requerido)                 | Auth contra la API de Wallbit.                               |
| `WALLBIT_API_BASE_URL`        | `https://api.wallbit.io`    | Base URL del API (override para sandbox/testing).            |
| `TELEGRAM_BOT_TOKEN`          | (requerido)                 | Token del bot de Telegram.                                   |
| `TELEGRAM_CHAT_ID`            | (requerido)                 | Chat donde mandar el reporte.                                |
| `ANALYSIS_DAYS`               | `30`                        | Ventana de análisis en días.                                 |
| `IDLE_THRESHOLD_USD`          | `500`                       | Mínimo USD para considerar algo ocioso.                      |
| `CHECKING_BUFFER_MULTIPLIER`  | `1.5`                       | Multiplicador sobre el gasto mensual para calcular colchón.  |
| `DRY_RUN`                     | `true` en `.env.example`    | Si `true`, sólo imprime en consola.                          |

## Tests

```bash
pnpm --filter @wallbit-lab/app-guita-dormida test
```
