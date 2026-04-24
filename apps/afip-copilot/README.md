# afip-copilot

Asistente fiscal para inversores argentinos con cuenta en Wallbit. Telegram bot de single-user con Postgres persistente.

## Qué hace

- `/status` — Consolida el portfolio (stocks + roboadvisor + cash) y proyecta **Bienes Personales 2025** con TC BNA comprador del día.
- `/ledger [year]` — Ledger de dividendos cobrados con FX lock al `pay_date` + proyección del impuesto Art. 94 LIG.
- `/ingest` — Ingesta manual de dividendos (últimos 90 días) desde la API de Wallbit.
- `/simulate <SYMBOL> <SHARES>` — Simula una venta: ganancia FIFO, impuesto cedular 15%, neto post-tax.
- `/import_cost_basis` — Importa cost basis histórico desde un CSV (columnas: `date,symbol,shares,price_usd,side`).
- `/export [year]` — Exporta `dividend-ledger-{year}.csv` + `tax-summary-{year}.md` para el contador.
- `pnpm cron:weekly` — Snapshot semanal con reporte de deltas por Telegram.

## Setup

### 1. Crear bot en Telegram

1. Hablar con [@BotFather](https://t.me/botfather) → `/newbot` → copiar el token.
2. Obtener tu `chat_id`: mandar cualquier mensaje al bot, luego ir a `https://api.telegram.org/bot<TOKEN>/getUpdates`.

### 2. Postgres local

```bash
docker run -d \
  --name afip-copilot-pg \
  -e POSTGRES_USER=afip \
  -e POSTGRES_PASSWORD=afip \
  -e POSTGRES_DB=afip_copilot \
  -p 5432:5432 \
  postgres:16
```

### 3. Variables de entorno

```bash
cp .env.example .env
# Completar: WALLBIT_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
```

### 4. Migraciones

```bash
pnpm db:push
```

### 5. Arrancar el bot

```bash
pnpm dev
```

## Cron semanal

```bash
pnpm cron:weekly
```

Para automatizar (systemd timer, Railway cron, etc.), configurar para que corra `pnpm --filter @wallbit-lab/app-afip-copilot cron:weekly` semanalmente.

## Variables de entorno

| Variable | Descripción | Default |
|---|---|---|
| `WALLBIT_API_KEY` | API key de Wallbit | **requerido** |
| `TELEGRAM_BOT_TOKEN` | Token del bot de BotFather | **requerido** |
| `TELEGRAM_CHAT_ID` | Tu chat_id de Telegram | **requerido** |
| `DATABASE_URL` | URL de Postgres | **requerido** |
| `FISCAL_YEAR` | Año fiscal a proyectar | `2025` |
| `CONTRIBUYENTE_CUMPLIDOR` | Beneficio alícuota diferenciada BP | `false` |
| `REIBP_ADHERIDO` | Adherido al REIBP (Ley 27.743) | `false` |
| `COST_BASIS_METHOD` | Método de cost basis | `FIFO` |
| `DIVIDEND_TX_TYPES` | Tipos de tx de dividendos (CSV) | `DIVIDEND` |
| `CASH_AR_BANK_ARS` | Saldo banco AR exento BP (ARS) | — |
| `TITULOS_PUBLICOS_AR_ARS` | Títulos públicos AR exentos BP (ARS) | — |
| `TAXPAYER_NAME` | Nombre para el export al contador | — |
| `TAXPAYER_CUIT` | CUIT para el export al contador | — |

## Notas importantes

- **Single-user**: una instancia = un `WALLBIT_API_KEY` + un `TELEGRAM_CHAT_ID`. Mensajes de otros chats se ignoran silenciosamente.
- **BP 2025 estimado**: los valores de MNI y tramos 2025 son estimados (+31,3% IPC sobre 2024) hasta que ARCA publique la RG definitiva. El bot lo aclara en cada respuesta.
- **Tipos de transacción Wallbit**: usar `/probe_tx_types` para descubrir el valor real de `Transaction.type` para dividendos y actualizar `DIVIDEND_TX_TYPES`.
- **TC BNA**: se fetchea de `bna.com.ar` y se cachea en `fx_rates_daily`. Si el BNA cambia su HTML, el scraper puede necesitar ajuste.
